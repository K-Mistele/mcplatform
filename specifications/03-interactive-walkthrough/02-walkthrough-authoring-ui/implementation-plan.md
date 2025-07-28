---
date: 2025-07-28T16:59:26-05:00
researcher: Claude
git_commit: 9121094b45df345b34f4ed58f223d5bd829f27ee
branch: master
repository: mcplatform
topic: "Walkthrough Authoring & Management UI Implementation Strategy"
tags: [implementation, strategy, walkthrough-authoring, ui, content-management]
status: complete
last_updated: 2025-07-28
last_updated_by: Claude
type: implementation_strategy
---

# Walkthrough Authoring & Management UI Implementation Plan

## Overview

This implementation creates a comprehensive dashboard interface that allows MCPlatform customers to create, edit, and manage interactive walkthroughs through a dedicated full-page editing environment. The system enables customers to author structured content using a four-field approach with real-time preview capabilities and sophisticated step management.

## Current State Analysis

### What Exists Now
- **Complete database schema** with structured content support in `packages/database/src/schema.ts:212-240`
- **Fully functional MCP tools** for end-user walkthrough consumption in `packages/dashboard/src/lib/mcp/tools/walkthrough.ts`
- **Robust progress tracking utilities** in `packages/dashboard/src/lib/mcp/walkthrough-utils.ts`
- **Versioned JSONB content structure** supporting four distinct fields: `introductionForAgent`, `contextForAgent`, `contentForUser`, `operationsForAgent`

### What's Missing
- Dashboard navigation item for "Walkthroughs"
- Management pages for CRUD operations on walkthroughs  
- oRPC actions for walkthrough authoring (no walkthrough actions exist in `packages/dashboard/src/lib/orpc/actions.ts`)
- Full-page editor with three-panel layout (navigator, editor, preview)
- Structured content editing interface for the four-field system

### Key Discoveries
- **Database schema** supports versioned JSONB with four distinct fields (`packages/database/src/schema.ts:6-27`)
- **oRPC pattern** uses `.actionable({})` for server actions with proper organization scoping (`packages/dashboard/src/lib/orpc/actions.ts:21-37`)
- **Navigation structure** follows established pattern in `packages/dashboard/src/components/app-sidebar.tsx:31-72`
- **Three-panel layouts** exist using responsive grid patterns in existing detail pages
- **TanStack Table** is used extensively for data management interfaces (`packages/dashboard/src/components/mcp-servers-table.tsx:173-363`)

### Critical Issue Identified
- **Schema mismatch**: Utility functions in `packages/dashboard/src/lib/mcp/walkthrough-utils.ts` reference deprecated `instructions` field instead of new `contentFields` structure
- **Migration incomplete**: Data may exist in old format requiring migration to structured content

## What We're NOT Doing

- Auto-save functionality (requirements specify manual save with visual feedback)
- Advanced collaborative editing features
- Rich text editing beyond basic markdown for user content
- Advanced template validation or debugging tools
- Analytics integration (future enhancement)
- Walkthrough versioning beyond draft/published status
- Mobile responsive design optimization (desktop-first approach)

## Implementation Approach

Multi-phase implementation focusing on core authoring experience first, then enhancing with preview capabilities. The approach follows MCPlatform's established patterns with Server Components for data fetching, oRPC actions for mutations, and three-panel layout using responsive grid systems.

## Phase 1: Core Infrastructure and Navigation

### Overview
Establish the foundation with navigation, basic CRUD operations, and walkthrough management interface.

### Changes Required:

#### 1. Navigation Infrastructure
**File**: `packages/dashboard/src/components/app-sidebar.tsx`
**Changes**: Add "Walkthroughs" navigation item

```typescript
// Add to navigation items array at line 35
{
    title: 'Walkthroughs',
    url: '/dashboard/walkthroughs',
    icon: BookOpenIcon
}
```

#### 2. oRPC Actions
**File**: `packages/dashboard/src/lib/orpc/actions.ts`  
**Changes**: Add comprehensive walkthrough management actions

```typescript
// Walkthrough CRUD Actions
export const createWalkthroughAction = base
    .input(z.object({
        title: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
        isPublished: z.boolean().default(false)
    }))
    .handler(async ({ input }) => {
        const session = await requireSession()
        const [walkthrough] = await db.insert(schema.walkthroughs)
            .values({ 
                ...input, 
                organizationId: session.session.activeOrganizationId,
                status: input.isPublished ? 'published' : 'draft'
            })
            .returning()
        
        revalidatePath('/dashboard/walkthroughs')
        return walkthrough
    })
    .actionable({})

export const updateWalkthroughAction = base
    .input(z.object({
        id: z.string(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']).optional(),
        isPublished: z.boolean().optional()
    }))
    .handler(async ({ input }) => {
        const session = await requireSession()
        const [walkthrough] = await db.update(schema.walkthroughs)
            .set({ 
                ...input, 
                status: input.isPublished !== undefined 
                    ? (input.isPublished ? 'published' : 'draft') 
                    : undefined,
                updatedAt: Date.now()
            })
            .where(and(
                eq(schema.walkthroughs.id, input.id),
                eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
            ))
            .returning()
        
        revalidatePath('/dashboard/walkthroughs')
        revalidatePath(`/dashboard/walkthroughs/${input.id}`)
        return walkthrough
    })
    .actionable({})

export const deleteWalkthroughAction = base
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
        const session = await requireSession()
        
        // Delete steps first (cascade)
        await db.delete(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.walkthroughId, input.id))
        
        // Delete walkthrough
        await db.delete(schema.walkthroughs)
            .where(and(
                eq(schema.walkthroughs.id, input.id),
                eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
            ))
        
        revalidatePath('/dashboard/walkthroughs')
        return { success: true }
    })
    .actionable({})
```

#### 3. Step Management Actions
**File**: `packages/dashboard/src/lib/orpc/actions.ts`
**Changes**: Add step CRUD operations

```typescript
export const createWalkthroughStepAction = base
    .input(z.object({
        walkthroughId: z.string(),
        title: z.string().min(1).max(200).default('New Step'),
        contentFields: z.object({
            version: z.literal('v1'),
            introductionForAgent: z.string().default(''),
            contextForAgent: z.string().default(''),
            contentForUser: z.string().default(''),
            operationsForAgent: z.string().default('')
        }).default({
            version: 'v1',
            introductionForAgent: '',
            contextForAgent: '',
            contentForUser: '',
            operationsForAgent: ''
        })
    }))
    .handler(async ({ input }) => {
        const session = await requireSession()
        
        // Get current max display order
        const maxOrder = await db.select({ max: sql`MAX(${schema.walkthroughSteps.displayOrder})` })
            .from(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.walkthroughId, input.walkthroughId))
        
        const [step] = await db.insert(schema.walkthroughSteps)
            .values({
                ...input,
                displayOrder: (maxOrder[0]?.max ?? 0) + 1
            })
            .returning()
        
        revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
        return step
    })
    .actionable({})

export const updateWalkthroughStepAction = base
    .input(z.object({
        id: z.string(),
        title: z.string().optional(),
        contentFields: z.object({
            version: z.literal('v1'),
            introductionForAgent: z.string().optional(),
            contextForAgent: z.string().optional(),
            contentForUser: z.string().optional(),
            operationsForAgent: z.string().optional()
        }).optional()
    }))
    .handler(async ({ input }) => {
        const session = await requireSession()
        
        const [step] = await db.update(schema.walkthroughSteps)
            .set({ 
                ...input,
                updatedAt: Date.now()
            })
            .where(eq(schema.walkthroughSteps.id, input.id))
            .returning()
        
        revalidatePath(`/dashboard/walkthroughs/${step.walkthroughId}`)
        return step
    })
    .actionable({})

export const deleteWalkthroughStepAction = base
    .input(z.object({ id: z.string() }))
    .handler(async ({ input }) => {
        const session = await requireSession()
        
        // Get step to find walkthrough ID
        const step = await db.select()
            .from(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.id, input.id))
            .limit(1)
        
        if (!step[0]) {
            throw errors.RESOURCE_NOT_FOUND({ message: 'Step not found' })
        }
        
        await db.delete(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.id, input.id))
        
        revalidatePath(`/dashboard/walkthroughs/${step[0].walkthroughId}`)
        return { success: true }
    })
    .actionable({})
```

#### 4. Main Walkthroughs List Page
**File**: `packages/dashboard/src/app/dashboard/walkthroughs/page.tsx`
**Changes**: Create new walkthrough management page

```typescript
import { Suspense } from 'react'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { schema } from '@mcplatform/database'
import { eq } from 'drizzle-orm'
import { WalkthroughsClient } from '@/components/walkthroughs-client'

export default async function WalkthroughsPage() {
    const session = await requireSession()
    
    const walkthroughsPromise = db.select({
        id: schema.walkthroughs.id,
        title: schema.walkthroughs.title,
        description: schema.walkthroughs.description,
        type: schema.walkthroughs.type,
        status: schema.walkthroughs.status,
        createdAt: schema.walkthroughs.createdAt,
        stepCount: sql<number>`COUNT(${schema.walkthroughSteps.id})`
    })
    .from(schema.walkthroughs)
    .leftJoin(schema.walkthroughSteps, eq(schema.walkthroughs.id, schema.walkthroughSteps.walkthroughId))
    .where(eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId))
    .groupBy(schema.walkthroughs.id)
    .orderBy(desc(schema.walkthroughs.createdAt))
    
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <Suspense fallback={<div>Loading walkthroughs...</div>}>
                    <WalkthroughsClient walkthroughsPromise={walkthroughsPromise} />
                </Suspense>
            </div>
        </div>
    )
}
```

#### 5. Walkthroughs Data Table Component
**File**: `packages/dashboard/src/components/walkthroughs-client.tsx`
**Changes**: Create comprehensive walkthrough management interface

```typescript
'use client'

import { use, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PlusIcon, BookOpenIcon, Settings2Icon, Users2Icon, ChevronRightIcon } from '@tabler/icons-react'
import { DataTable } from '@/components/data-table'
import { CreateWalkthroughModal } from '@/components/create-walkthrough-modal'
import type { ColumnDef } from '@tanstack/react-table'

const walkthrough_type_config = {
    course: { icon: '📚', label: 'Course', description: 'Educational content with progressive learning' },
    installer: { icon: '⚙️', label: 'Installer', description: 'Step-by-step installation and setup' },
    troubleshooting: { icon: '🔧', label: 'Troubleshooting', description: 'Problem diagnosis and resolution' },
    integration: { icon: '🔗', label: 'Integration', description: 'Connecting with external tools and services' },
    quickstart: { icon: '⚡', label: 'Quick Start', description: 'Fast-track setup and basic usage' }
}

type WalkthroughTableData = {
    id: string
    title: string
    description: string | null
    type: 'course' | 'installer' | 'troubleshooting' | 'integration' | 'quickstart'
    status: 'draft' | 'published' | 'archived'
    createdAt: number
    stepCount: number
}

export function WalkthroughsClient({ 
    walkthroughsPromise 
}: { 
    walkthroughsPromise: Promise<WalkthroughTableData[]> 
}) {
    const walkthroughs = use(walkthroughsPromise)
    const [createModalOpen, setCreateModalOpen] = useState(false)
    
    const columns: ColumnDef<WalkthroughTableData>[] = [
        {
            accessorKey: 'title',
            header: 'Title',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <BookOpenIcon className="h-4 w-4 text-muted-foreground" />
                    <a 
                        href={`/dashboard/walkthroughs/${row.original.id}/edit`}
                        className="font-medium hover:underline"
                    >
                        {row.getValue('title')}
                    </a>
                </div>
            )
        },
        {
            accessorKey: 'type',
            header: 'Type',
            cell: ({ row }) => {
                const type = row.getValue('type') as keyof typeof walkthrough_type_config
                const config = walkthrough_type_config[type]
                return (
                    <Badge variant="secondary" className="gap-1">
                        <span>{config.icon}</span>
                        {config.label}
                    </Badge>
                )
            }
        },
        {
            accessorKey: 'description',
            header: 'Description',
            cell: ({ row }) => {
                const description = row.getValue('description') as string | null
                return (
                    <div className="max-w-[300px] truncate text-muted-foreground">
                        {description || 'No description'}
                    </div>
                )
            }
        },
        {
            accessorKey: 'stepCount',
            header: 'Steps',
            cell: ({ row }) => (
                <Badge variant="outline">
                    {row.getValue('stepCount')} steps
                </Badge>
            )
        },
        {
            accessorKey: 'createdAt',
            header: 'Created',
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(row.getValue('createdAt')), { addSuffix: true })}
                </span>
            )
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const status = row.getValue('status') as string
                return (
                    <Badge variant={status === 'published' ? 'default' : 'secondary'}>
                        {status}
                    </Badge>
                )
            }
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        asChild
                    >
                        <a href={`/dashboard/walkthroughs/${row.original.id}/edit`}>
                            Edit
                            <ChevronRightIcon className="ml-1 h-3 w-3" />
                        </a>
                    </Button>
                </div>
            )
        }
    ]
    
    if (walkthroughs.length === 0) {
        return (
            <Card className="border-dashed">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <BookOpenIcon className="h-6 w-6" />
                    </div>
                    <CardTitle>No walkthroughs yet</CardTitle>
                    <CardDescription>
                        Create your first interactive walkthrough to guide users through your products
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <Button onClick={() => setCreateModalOpen(true)}>
                        <PlusIcon className="mr-2 h-4 w-4" />
                        Create Walkthrough
                    </Button>
                </CardContent>
            </Card>
        )
    }
    
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Walkthroughs</h1>
                    <p className="text-muted-foreground">
                        Create and manage interactive guides for your users
                    </p>
                </div>
                <Button onClick={() => setCreateModalOpen(true)}>
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Create Walkthrough
                </Button>
            </div>
            
            <DataTable
                columns={columns}
                data={walkthroughs}
                searchKey="title"
                searchPlaceholder="Search walkthroughs..."
            />
            
            <CreateWalkthroughModal 
                open={createModalOpen}
                onOpenChange={setCreateModalOpen}
            />
        </div>
    )
}
```

### Success Criteria:

**Automated verification**
- [ ] no linter errors

**Manual Verification**
- [ ] Navigation shows "Walkthroughs" item in sidebar
- [ ] Walkthroughs page displays data table with existing walkthroughs
- [ ] Empty state shows when no walkthroughs exist
- [ ] Create walkthrough modal opens and functions
- [ ] Created walkthroughs appear in the list
- [ ] Edit links navigate to correct URLs

## Phase 2: Create/Edit Modal and Basic Forms

### Overview
Implement walkthrough creation and basic metadata editing through modal forms.

### Changes Required:

#### 1. Create Walkthrough Modal
**File**: `packages/dashboard/src/components/create-walkthrough-modal.tsx`
**Changes**: Create modal for walkthrough creation

```typescript
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useServerAction } from '@orpc/react/hooks'
import { onError, onSuccess } from '@orpc/client'
import { isDefinedError } from '@orpc/client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { createWalkthroughAction } from '@/lib/orpc/actions'

const formSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
    description: z.string().max(500, 'Description must be less than 500 characters').optional(),
    type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
    isPublished: z.boolean().default(false)
})

const walkthrough_types = [
    { value: 'course', label: '📚 Course', description: 'Educational content with progressive learning' },
    { value: 'installer', label: '⚙️ Installer', description: 'Step-by-step installation and setup' },
    { value: 'troubleshooting', label: '🔧 Troubleshooting', description: 'Problem diagnosis and resolution' },
    { value: 'integration', label: '🔗 Integration', description: 'Connecting with external tools and services' },
    { value: 'quickstart', label: '⚡ Quick Start', description: 'Fast-track setup and basic usage' }
]

export function CreateWalkthroughModal({ 
    open, 
    onOpenChange 
}: { 
    open: boolean
    onOpenChange: (open: boolean) => void 
}) {
    const router = useRouter()
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            type: 'course',
            isPublished: false
        }
    })
    
    const { execute, status } = useServerAction(createWalkthroughAction, {
        interceptors: [
            onSuccess((result) => {
                toast.success('Walkthrough created successfully')
                onOpenChange(false)
                form.reset()
                router.push(`/dashboard/walkthroughs/${result.id}/edit`)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to create walkthrough')
                }
            })
        ]
    })
    
    const onSubmit = (data: z.infer<typeof formSchema>) => {
        execute(data)
    }
    
    const selectedType = walkthrough_types.find(t => t.value === form.watch('type'))
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Create Walkthrough</DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter walkthrough title..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Describe what users will learn..."
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select walkthrough type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {walkthrough_types.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedType && (
                                        <p className="text-sm text-muted-foreground">
                                            {selectedType.description}
                                        </p>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <FormField
                            control={form.control}
                            name="isPublished"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                        <FormLabel>Publish immediately</FormLabel>
                                        <div className="text-sm text-muted-foreground">
                                            Make this walkthrough available to users
                                        </div>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                        
                        <div className="flex justify-end gap-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={() => onOpenChange(false)}
                                disabled={status === 'pending'}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={status === 'pending'}
                            >
                                {status === 'pending' ? 'Creating...' : 'Create Walkthrough'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
```

### Success Criteria:

**Automated verification**
- [ ] no linter errors

**Manual Verification**
- [ ] Create walkthrough modal opens with proper form fields
- [ ] Form validation works for title and description length limits
- [ ] Walkthrough type selection shows descriptions
- [ ] Form submission creates walkthrough and redirects to editor
- [ ] Error handling displays appropriate messages

## Phase 3: Full-Page Editor with Three-Panel Layout

### Overview
Implement the comprehensive editing interface with steps navigator, content editor, and preview panel.

### Changes Required:

#### 1. Walkthrough Editor Page
**File**: `packages/dashboard/src/app/dashboard/walkthroughs/[walkthroughId]/edit/page.tsx`
**Changes**: Create full-page editor route

```typescript
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth/session'
import { db } from '@/lib/db'
import { schema } from '@mcplatform/database'
import { eq, and } from 'drizzle-orm'
import { WalkthroughEditor } from '@/components/walkthrough-editor'

export default async function WalkthroughEditPage({
    params,
    searchParams
}: {
    params: { walkthroughId: string }
    searchParams: { step?: string }
}) {
    const session = await requireSession()
    
    const walkthroughPromise = db.select()
        .from(schema.walkthroughs)
        .where(and(
            eq(schema.walkthroughs.id, params.walkthroughId),
            eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
        ))
        .limit(1)
        .then(results => results[0] || null)
    
    const stepsPromise = db.select()
        .from(schema.walkthroughSteps)
        .where(eq(schema.walkthroughSteps.walkthroughId, params.walkthroughId))
        .orderBy(schema.walkthroughSteps.displayOrder)
    
    const walkthrough = await walkthroughPromise
    if (!walkthrough) {
        notFound()
    }
    
    return (
        <div className="h-screen flex flex-col">
            <Suspense fallback={<div>Loading editor...</div>}>
                <WalkthroughEditor
                    walkthroughPromise={walkthroughPromise}
                    stepsPromise={stepsPromise}
                    selectedStepId={searchParams.step}
                />
            </Suspense>
        </div>
    )
}
```

#### 2. Three-Panel Editor Component
**File**: `packages/dashboard/src/components/walkthrough-editor.tsx`
**Changes**: Create comprehensive editing interface

```typescript
'use client'

import { use, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useServerAction } from '@orpc/react/hooks'
import { onError, onSuccess } from '@orpc/client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeftIcon, SaveIcon, EyeIcon, SettingsIcon } from '@tabler/icons-react'

import { StepsNavigator } from '@/components/steps-navigator'
import { ContentEditor } from '@/components/content-editor'
import { PreviewPanel } from '@/components/preview-panel'
import { updateWalkthroughAction } from '@/lib/orpc/actions'

type Walkthrough = {
    id: string
    title: string
    description: string | null
    type: 'course' | 'installer' | 'troubleshooting' | 'integration' | 'quickstart'
    status: 'draft' | 'published' | 'archived'
}

type WalkthroughStep = {
    id: string
    walkthroughId: string
    title: string
    contentFields: {
        version: 'v1'
        introductionForAgent: string
        contextForAgent: string
        contentForUser: string
        operationsForAgent: string
    }
    displayOrder: number
}

const walkthrough_type_config = {
    course: { icon: '📚', label: 'Course' },
    installer: { icon: '⚙️', label: 'Installer' },
    troubleshooting: { icon: '🔧', label: 'Troubleshooting' },
    integration: { icon: '🔗', label: 'Integration' },
    quickstart: { icon: '⚡', label: 'Quick Start' }
}

export function WalkthroughEditor({
    walkthroughPromise,
    stepsPromise,
    selectedStepId
}: {
    walkthroughPromise: Promise<Walkthrough | null>
    stepsPromise: Promise<WalkthroughStep[]>
    selectedStepId?: string
}) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const walkthrough = use(walkthroughPromise)
    const steps = use(stepsPromise)
    
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
    
    if (!walkthrough) {
        return <div>Walkthrough not found</div>
    }
    
    const currentStep = selectedStepId 
        ? steps.find(step => step.id === selectedStepId)
        : steps[0]
    
    const typeConfig = walkthrough_type_config[walkthrough.type]
    
    const { execute: updateWalkthrough } = useServerAction(updateWalkthroughAction, {
        interceptors: [
            onSuccess(() => {
                setSaveStatus('saved')
                toast.success('Walkthrough saved')
            }),
            onError(() => {
                setSaveStatus('error')
                toast.error('Failed to save walkthrough')
            })
        ]
    })
    
    const handleStepSelect = useCallback((stepId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('step', stepId)
        router.push(`?${params.toString()}`)
    }, [router, searchParams])
    
    const handleSave = useCallback(() => {
        setSaveStatus('saving')
        // This will be enhanced in later phases
        setSaveStatus('saved')
    }, [])
    
    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" asChild>
                        <a href="/dashboard/walkthroughs">
                            <ArrowLeftIcon className="mr-2 h-4 w-4" />
                            Back to Walkthroughs
                        </a>
                    </Button>
                    
                    <Separator orientation="vertical" className="h-6" />
                    
                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="gap-1">
                            <span>{typeConfig.icon}</span>
                            {typeConfig.label}
                        </Badge>
                        <div>
                            <h1 className="text-lg font-semibold">{walkthrough.title}</h1>
                            {walkthrough.description && (
                                <p className="text-sm text-muted-foreground">
                                    {walkthrough.description}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                        {saveStatus === 'saving' && 'Saving...'}
                        {saveStatus === 'saved' && 'All changes saved'}
                        {saveStatus === 'error' && 'Error saving'}
                    </div>
                    
                    <Button variant="outline" size="sm" onClick={handleSave}>
                        <SaveIcon className="mr-2 h-4 w-4" />
                        Save
                    </Button>
                    
                    <Button variant="outline" size="sm">
                        <EyeIcon className="mr-2 h-4 w-4" />
                        Preview
                    </Button>
                    
                    <Button variant="outline" size="sm">
                        <SettingsIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            
            {/* Three-Panel Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Steps Navigator - Left Panel */}
                <div className="w-80 border-r bg-muted/30">
                    <StepsNavigator
                        steps={steps}
                        selectedStepId={currentStep?.id}
                        onStepSelect={handleStepSelect}
                        walkthroughId={walkthrough.id}
                    />
                </div>
                
                {/* Content Editor - Center Panel */}
                <div className="flex-1 overflow-y-auto">
                    {currentStep ? (
                        <ContentEditor
                            step={currentStep}
                            walkthroughType={walkthrough.type}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <div className="text-center">
                                <p className="text-lg mb-2">No steps yet</p>
                                <p>Add your first step to get started</p>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Preview Panel - Right Panel */}
                <div className="w-96 border-l bg-muted/30">
                    <PreviewPanel
                        step={currentStep}
                        walkthrough={walkthrough}
                    />
                </div>
            </div>
        </div>
    )
}
```

#### 3. Steps Navigator Component
**File**: `packages/dashboard/src/components/steps-navigator.tsx`
**Changes**: Create step management interface

```typescript
'use client'

import { useState } from 'react'
import { useServerAction } from '@orpc/react/hooks'
import { onError, onSuccess } from '@orpc/client'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { PlusIcon, Trash2Icon, GripVerticalIcon } from '@tabler/icons-react'

import { createWalkthroughStepAction } from '@/lib/orpc/actions'

type WalkthroughStep = {
    id: string
    walkthroughId: string
    title: string
    contentFields: {
        version: 'v1'
        introductionForAgent: string
        contextForAgent: string
        contentForUser: string
        operationsForAgent: string
    }
    displayOrder: number
}

export function StepsNavigator({
    steps,
    selectedStepId,
    onStepSelect,
    walkthroughId
}: {
    steps: WalkthroughStep[]
    selectedStepId?: string
    onStepSelect: (stepId: string) => void
    walkthroughId: string
}) {
    const { execute: createStep, status } = useServerAction(createWalkthroughStepAction, {
        interceptors: [
            onSuccess((result) => {
                toast.success('Step created')
                onStepSelect(result.id)
            }),
            onError(() => {
                toast.error('Failed to create step')
            })
        ]
    })
    
    const handleCreateStep = () => {
        createStep({
            walkthroughId,
            title: `Step ${steps.length + 1}`,
            contentFields: {
                version: 'v1',
                introductionForAgent: '',
                contextForAgent: '',
                contentForUser: '',
                operationsForAgent: ''
            }
        })
    }
    
    const getCompletionIndicators = (step: WalkthroughStep) => {
        const fields = step.contentFields
        return [
            { key: 'intro', icon: '💬', filled: !!fields.introductionForAgent.trim() },
            { key: 'context', icon: '📝', filled: !!fields.contextForAgent.trim() },
            { key: 'content', icon: '🔧', filled: !!fields.contentForUser.trim() },
            { key: 'operations', icon: '⚡', filled: !!fields.operationsForAgent.trim() }
        ]
    }
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold">Steps</h2>
                    <Badge variant="outline">{steps.length}</Badge>
                </div>
                <Button 
                    onClick={handleCreateStep}
                    disabled={status === 'pending'}
                    size="sm"
                    className="w-full"
                >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add Step
                </Button>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {steps.map((step, index) => {
                        const isSelected = step.id === selectedStepId
                        const indicators = getCompletionIndicators(step)
                        
                        return (
                            <div
                                key={step.id}
                                className={`group relative p-3 rounded-md cursor-pointer transition-colors ${
                                    isSelected 
                                        ? 'bg-primary text-primary-foreground' 
                                        : 'hover:bg-muted'
                                }`}
                                onClick={() => onStepSelect(step.id)}
                            >
                                <div className="flex items-start gap-2">
                                    <GripVerticalIcon className="h-4 w-4 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium">
                                                {index + 1}
                                            </span>
                                            <span className="font-medium truncate">
                                                {step.title}
                                            </span>
                                        </div>
                                        <div className="flex gap-1">
                                            {indicators.map(({ key, icon, filled }) => (
                                                <span
                                                    key={key}
                                                    className={`text-xs ${
                                                        filled 
                                                            ? 'opacity-100' 
                                                            : 'opacity-30'
                                                    }`}
                                                >
                                                    {icon}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </ScrollArea>
        </div>
    )
}
```

### Success Criteria:

**Automated verification**
- [ ] no linter errors

**Manual Verification**
- [ ] Full-page editor loads with three-panel layout
- [ ] Header shows walkthrough metadata and action buttons
- [ ] Steps navigator shows all steps with completion indicators
- [ ] Clicking steps updates URL and selects step
- [ ] Add step button creates new step and selects it
- [ ] Content editor panel displays (implementation in Phase 4)
- [ ] Preview panel displays (implementation in Phase 4)

## Phase 4: Structured Content Editor and Manual Save

### Overview
Implement the four-field content editing interface with manual save functionality and visual feedback.

### Changes Required:

#### 1. Content Editor Component
**File**: `packages/dashboard/src/components/content-editor.tsx`
**Changes**: Create structured content editing interface

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'
import { useServerAction } from '@orpc/react/hooks'
import { onError, onSuccess } from '@orpc/client'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from '@tabler/icons-react'

import { updateWalkthroughStepAction } from '@/lib/orpc/actions'

type WalkthroughStep = {
    id: string
    walkthroughId: string
    title: string
    contentFields: {
        version: 'v1'
        introductionForAgent: string
        contextForAgent: string
        contentForUser: string
        operationsForAgent: string
    }
    displayOrder: number
}

type WalkthroughType = 'course' | 'installer' | 'troubleshooting' | 'integration' | 'quickstart'

// Field requirements by walkthrough type
const fieldRequirements = {
    course: { contentForUser: true },
    installer: { contentForUser: true, operationsForAgent: true },
    troubleshooting: { contentForUser: true, contextForAgent: true },
    integration: { contentForUser: true, contextForAgent: true, operationsForAgent: true },
    quickstart: { contentForUser: true }
}

export function ContentEditor({
    step,
    walkthroughType
}: {
    step: WalkthroughStep
    walkthroughType: WalkthroughType
}) {
    const [formData, setFormData] = useState({
        title: step.title,
        contentFields: { ...step.contentFields }
    })
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [collapsedSections, setCollapsedSections] = useState({
        introduction: true,
        context: true,
        operations: true
    })
    
    const requirements = fieldRequirements[walkthroughType] || {}
    
    const { execute: updateStep, status } = useServerAction(updateWalkthroughStepAction, {
        interceptors: [
            onSuccess(() => {
                setHasUnsavedChanges(false)
                toast.success('Step saved')
            }),
            onError(() => {
                toast.error('Failed to save step')
            })
        ]
    })
    
    // Update form data when step changes
    useEffect(() => {
        setFormData({
            title: step.title,
            contentFields: { ...step.contentFields }
        })
        setHasUnsavedChanges(false)
    }, [step.id, step.title, step.contentFields])
    
    const handleFieldChange = useCallback((field: string, value: string) => {
        setFormData(prev => {
            if (field === 'title') {
                return { ...prev, title: value }
            } else {
                return {
                    ...prev,
                    contentFields: { ...prev.contentFields, [field]: value }
                }
            }
        })
        setHasUnsavedChanges(true)
    }, [])
    
    const handleSave = useCallback(() => {
        updateStep({
            id: step.id,
            title: formData.title,
            contentFields: formData.contentFields
        })
    }, [updateStep, step.id, formData])
    
    const toggleSection = useCallback((section: keyof typeof collapsedSections) => {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }))
    }, [])
    
    // Auto-save on Ctrl+S
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (hasUnsavedChanges) {
                    handleSave()
                }
            }
        }
        
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleSave, hasUnsavedChanges])
    
    return (
        <div className="p-6 space-y-6">
            {/* Step Metadata */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Step Content</h2>
                    <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                            <Badge variant="outline" className="text-amber-600">
                                Unsaved changes
                            </Badge>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={!hasUnsavedChanges || status === 'pending'}
                            className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded disabled:opacity-50"
                        >
                            {status === 'pending' ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="step-title">Step Title</Label>
                    <Input
                        id="step-title"
                        value={formData.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        placeholder="Enter step title..."
                    />
                </div>
            </div>
            
            {/* Introduction for Agent */}
            <Collapsible
                open={!collapsedSections.introduction}
                onOpenChange={() => toggleSection('introduction')}
            >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 border rounded-md hover:bg-muted/50">
                    {collapsedSections.introduction ? (
                        <ChevronRightIcon className="h-4 w-4" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                    )}
                    <span className="font-medium">💬 Introduction for Agent</span>
                    <Badge variant="outline" className="ml-auto">
                        Optional
                    </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                    <div className="space-y-2 p-3 border rounded-md bg-muted/20">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                            <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <p>
                                Brief context about what this step accomplishes and its learning objectives.
                                This helps the AI agent understand the purpose and context.
                            </p>
                        </div>
                        <Textarea
                            value={formData.contentFields.introductionForAgent}
                            onChange={(e) => handleFieldChange('introductionForAgent', e.target.value)}
                            placeholder="Guide the user through creating their first agent. This step focuses on..."
                            rows={3}
                        />
                        <div className="text-xs text-muted-foreground text-right">
                            {formData.contentFields.introductionForAgent.length}/500
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
            
            {/* Context for Agent */}
            <Collapsible
                open={!collapsedSections.context}
                onOpenChange={() => toggleSection('context')}
            >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 border rounded-md hover:bg-muted/50">
                    {collapsedSections.context ? (
                        <ChevronRightIcon className="h-4 w-4" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                    )}
                    <span className="font-medium">📝 Context for Agent</span>
                    <Badge variant={requirements.contextForAgent ? "default" : "outline"}>
                        {requirements.contextForAgent ? "Required" : "Optional"}
                    </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                    <div className="space-y-2 p-3 border rounded-md bg-muted/20">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                            <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <p>
                                Background knowledge, key concepts, related documentation, and search terms 
                                the agent can use to provide better assistance.
                            </p>
                        </div>
                        <Textarea
                            value={formData.contentFields.contextForAgent}
                            onChange={(e) => handleFieldChange('contextForAgent', e.target.value)}
                            placeholder="Key concepts: AI agents, autonomous decision-making&#10;Related docs: /docs/agents/overview&#10;Search terms: 'Mastra agent', 'AI agent framework'"
                            rows={4}
                        />
                        <div className="text-xs text-muted-foreground text-right">
                            {formData.contentFields.contextForAgent.length}/1000
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
            
            {/* Content for User */}
            <div className="space-y-2">
                <div className="flex items-center gap-2 p-3 border rounded-md bg-primary/5">
                    <span className="font-medium">🔧 Content for User</span>
                    <Badge variant="default">Required</Badge>
                </div>
                <div className="p-3 border rounded-md">
                    <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                        <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p>
                            The actual instructional content to present to the user. 
                            Supports markdown formatting for rich content.
                        </p>
                    </div>
                    <Textarea
                        value={formData.contentFields.contentForUser}
                        onChange={(e) => handleFieldChange('contentForUser', e.target.value)}
                        placeholder="# Creating Your Financial Agent&#10;&#10;Let's create a simple agent that will help users analyze financial transaction data.&#10;&#10;```typescript&#10;import { Agent } from '@mastra/core/agent'&#10;// ... rest of code example&#10;```"
                        rows={10}
                        className="font-mono text-sm"
                    />
                    <div className="text-xs text-muted-foreground text-right mt-2">
                        {formData.contentFields.contentForUser.length}/2000
                    </div>
                </div>
            </div>
            
            {/* Operations for Agent */}
            <Collapsible
                open={!collapsedSections.operations}
                onOpenChange={() => toggleSection('operations')}
            >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 border rounded-md hover:bg-muted/50">
                    {collapsedSections.operations ? (
                        <ChevronRightIcon className="h-4 w-4" />
                    ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                    )}
                    <span className="font-medium">⚡ Operations for Agent</span>
                    <Badge variant={requirements.operationsForAgent ? "default" : "outline"}>
                        {requirements.operationsForAgent ? "Required" : "Optional"}
                    </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                    <div className="space-y-2 p-3 border rounded-md bg-muted/20">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-3">
                            <InfoIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <p>
                                Specific actions the agent should perform: file operations, tool calls, 
                                validations, and other concrete tasks.
                            </p>
                        </div>
                        <Textarea
                            value={formData.contentFields.operationsForAgent}
                            onChange={(e) => handleFieldChange('operationsForAgent', e.target.value)}
                            placeholder="CREATE: src/mastra/agents/financial-agent.ts&#10;READ: Check if src/mastra/ directory exists, create if missing&#10;VALIDATE: Ensure agent imports are correct&#10;NEXT_STEP_PREP: Mention that tools will be added in the next step"
                            rows={4}
                        />
                        <div className="text-xs text-muted-foreground text-right">
                            {formData.contentFields.operationsForAgent.length}/1000
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    )
}
```

#### 2. Preview Panel Component
**File**: `packages/dashboard/src/components/preview-panel.tsx`
**Changes**: Create basic preview interface

```typescript
'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EyeIcon, EditIcon, ChevronLeftIcon, ChevronRightIcon } from '@tabler/icons-react'

type WalkthroughStep = {
    id: string
    walkthroughId: string
    title: string
    contentFields: {
        version: 'v1'
        introductionForAgent: string
        contextForAgent: string
        contentForUser: string
        operationsForAgent: string
    }
    displayOrder: number
}

type Walkthrough = {
    id: string
    title: string
    description: string | null
    type: 'course' | 'installer' | 'troubleshooting' | 'integration' | 'quickstart'
    status: 'draft' | 'published' | 'archived'
}

export function PreviewPanel({
    step,
    walkthrough
}: {
    step?: WalkthroughStep
    walkthrough: Walkthrough
}) {
    const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit')
    
    if (!step) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                    <EyeIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Select a step to preview</p>
                </div>
            </div>
        )
    }
    
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Preview</h3>
                    <div className="flex gap-1">
                        <Button
                            variant={previewMode === 'edit' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewMode('edit')}
                        >
                            <EditIcon className="h-3 w-3" />
                        </Button>
                        <Button
                            variant={previewMode === 'preview' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewMode('preview')}
                        >
                            <EyeIcon className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
                
                <div className="flex justify-between">
                    <Button variant="outline" size="sm" disabled>
                        <ChevronLeftIcon className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                        Next
                        <ChevronRightIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            
            <ScrollArea className="flex-1">
                <div className="p-4">
                    {previewMode === 'edit' ? (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-medium mb-2">Step Title</h4>
                                <div className="p-3 bg-muted rounded text-sm">
                                    {step.title}
                                </div>
                            </div>
                            
                            {step.contentFields.introductionForAgent && (
                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                        💬 Introduction for Agent
                                    </h4>
                                    <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
                                        {step.contentFields.introductionForAgent}
                                    </div>
                                </div>
                            )}
                            
                            {step.contentFields.contextForAgent && (
                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                        📝 Context for Agent
                                    </h4>
                                    <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
                                        {step.contentFields.contextForAgent}
                                    </div>
                                </div>
                            )}
                            
                            <div>
                                <h4 className="font-medium mb-2 flex items-center gap-2">
                                    🔧 Content for User
                                    <Badge variant="default" className="text-xs">Required</Badge>
                                </h4>
                                <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
                                    {step.contentFields.contentForUser || (
                                        <span className="text-muted-foreground italic">
                                            No content yet
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {step.contentFields.operationsForAgent && (
                                <div>
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                        ⚡ Operations for Agent
                                    </h4>
                                    <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">
                                        {step.contentFields.operationsForAgent}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 border rounded-lg">
                                <h4 className="font-medium mb-2">Template Preview</h4>
                                <div className="text-sm text-muted-foreground mb-4">
                                    This is how the content will appear to the AI agent:
                                </div>
                                <div className="bg-gray-50 p-4 rounded font-mono text-xs space-y-2">
                                    <div>
                                        <strong>Walkthrough:</strong> {walkthrough.title}
                                    </div>
                                    <div>
                                        <strong>Step:</strong> {step.title}
                                    </div>
                                    <div className="border-t pt-2">
                                        {step.contentFields.introductionForAgent && (
                                            <div className="mb-2">
                                                <strong>Context:</strong><br />
                                                {step.contentFields.introductionForAgent}
                                            </div>
                                        )}
                                        {step.contentFields.contextForAgent && (
                                            <div className="mb-2">
                                                <strong>Background:</strong><br />
                                                {step.contentFields.contextForAgent}
                                            </div>
                                        )}
                                        <div className="mb-2">
                                            <strong>User Content:</strong><br />
                                            <div className="bg-white p-2 rounded">
                                                {step.contentFields.contentForUser}
                                            </div>
                                        </div>
                                        {step.contentFields.operationsForAgent && (
                                            <div>
                                                <strong>Operations:</strong><br />
                                                {step.contentFields.operationsForAgent}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
```

### Success Criteria:

**Automated verification**
- [ ] no linter errors

**Manual Verification**
- [ ] Content editor displays four collapsible sections with proper labels
- [ ] Required/optional badges display based on walkthrough type
- [ ] Manual save button works and shows proper status feedback
- [ ] Unsaved changes indicator appears when content is modified
- [ ] Ctrl+S keyboard shortcut triggers save
- [ ] Preview panel shows structured field view and basic template preview
- [ ] Character limits display and update in real-time
- [ ] Field validation works properly

## Phase 5: Fix Schema Migration and Utility Functions

### Overview
Address the critical schema mismatch where utility functions reference deprecated `instructions` field instead of new `contentFields` structure.

### Changes Required:

#### 1. Update Walkthrough Utilities
**File**: `packages/dashboard/src/lib/mcp/walkthrough-utils.ts`
**Changes**: Fix references to use contentFields instead of instructions

```typescript
// Replace lines 16, 80, 92, 340, 367 that reference step.instructions
// with step.contentFields.contentForUser

// Example changes:
// OLD: step.instructions
// NEW: step.contentFields.contentForUser

// Function: getWalkthroughStepsWithProgress (around line 340)
steps: steps.map(step => ({
    id: step.id,
    title: step.title,
    // OLD: instructions: step.instructions,
    contentFields: step.contentFields, // Use full structured content
    displayOrder: step.displayOrder,
    isCompleted: progress?.some(p => p.stepId === step.id && p.isCompleted) || false
}))

// Function: getWalkthroughDetails (around line 367)  
currentStep: currentStep ? {
    id: currentStep.id,
    title: currentStep.title,
    // OLD: instructions: currentStep.instructions,
    contentFields: currentStep.contentFields, // Use full structured content
    displayOrder: currentStep.displayOrder
} : null
```

#### 2. Update MCP Tools Content Rendering
**File**: `packages/dashboard/src/lib/mcp/tools/walkthrough.ts`
**Changes**: Update step content rendering to use structured fields

```typescript
// In get_current_step tool, replace simple instructions with structured template
// Around line 150-160, replace:
// OLD: step.instructions
// NEW: Render structured content using a simple template

const renderStepContent = (step: any): string => {
    const fields = step.contentFields
    
    let content = ''
    
    if (fields.introductionForAgent) {
        content += `## Step Context\n${fields.introductionForAgent}\n\n`
    }
    
    if (fields.contextForAgent) {
        content += `## Background Information\n${fields.contextForAgent}\n\n`
    }
    
    content += `## User Content\n${fields.contentForUser}\n\n`
    
    if (fields.operationsForAgent) {
        content += `## Operations to Perform\n${fields.operationsForAgent}\n\n`
    }
    
    return content
}

// Update the tool response to use:
instructions: renderStepContent(step)
```

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] no TypeScript errors about missing instructions field

**Manual Verification**  
- [ ] MCP walkthrough tools continue to work properly
- [ ] Step content renders properly in MCP tool responses
- [ ] No references to deprecated instructions field remain

## Phase 6: Enhanced Features and Polish

### Overview
Add remaining features like step reordering, deletion, and improved preview capabilities.

### Changes Required:

#### 1. Step Reordering and Deletion
**File**: `packages/dashboard/src/components/steps-navigator.tsx`
**Changes**: Add drag-and-drop reordering and deletion

```typescript
// Add reorder action to oRPC actions.ts first:
export const reorderWalkthroughStepsAction = base
    .input(z.object({
        walkthroughId: z.string(),
        stepIds: z.array(z.string())
    }))
    .handler(async ({ input }) => {
        const session = await requireSession()
        
        // Update display order based on array position
        for (let i = 0; i < input.stepIds.length; i++) {
            await db.update(schema.walkthroughSteps)
                .set({ displayOrder: i + 1 })
                .where(eq(schema.walkthroughSteps.id, input.stepIds[i]))
        }
        
        revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
        return { success: true }
    })
    .actionable({})

// Then add drag-and-drop functionality using @dnd-kit
// Add delete step buttons with confirmation dialogs
// Update steps-navigator.tsx with DndContext, SortableContext, etc.
```

#### 2. Nunjucks Template Rendering
**File**: `packages/dashboard/src/lib/template-engine.ts`
**Changes**: Implement template rendering system

```typescript
import nunjucks from 'nunjucks'

const env = nunjucks.configure({ autoescape: true })

export function renderWalkthroughStep(
    step: WalkthroughStep,
    walkthrough: Walkthrough
): string {
    const template = `
{# Agent Instruction Prompt #}
This is an interactive walkthrough to guide users through {{ walkthroughTitle }}.
You are an expert instructor helping users learn step by step.

{% if introductionForAgent %}
## Step Context
{{ introductionForAgent }}
{% endif %}

{% if contextForAgent %}
## Background Information
{{ contextForAgent }}
{% endif %}

{% if operationsForAgent %}
## Operations to Perform
{{ operationsForAgent }}
{% endif %}

## User Content
Present the following content to the user:

<StepContent>
{{ contentForUser }}
</StepContent>

## Navigation
When the user is ready to continue, guide them to use the appropriate walkthrough navigation tools.
`

    return env.renderString(template, {
        walkthroughTitle: walkthrough.title,
        stepTitle: step.title,
        ...step.contentFields
    })
}
```

#### 3. Enhanced Preview Panel
**File**: `packages/dashboard/src/components/preview-panel.tsx`
**Changes**: Add Nunjucks template rendering to preview

```typescript
// Import template engine and add rendered template view
import { renderWalkthroughStep } from '@/lib/template-engine'

// Add template rendering in preview mode:
{previewMode === 'preview' && (
    <div className="space-y-4">
        <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">Final Template Output</h4>
            <div className="bg-gray-50 p-4 rounded font-mono text-xs whitespace-pre-wrap">
                {renderWalkthroughStep(step, walkthrough)}
            </div>
        </div>
    </div>
)}
```

### Success Criteria:

**Automated verification**
- [ ] no linter errors

**Manual Verification**
- [ ] Steps can be reordered using drag and drop
- [ ] Step deletion works with proper confirmation
- [ ] Template preview shows final Nunjucks output
- [ ] All features work together seamlessly

## Performance Considerations

- **Debounced auto-save**: 2-second delay after last keystroke to prevent excessive server requests
- **Code splitting**: Lazy load markdown editor and preview components for faster initial load
- **Optimistic updates**: Immediate UI feedback with server sync for better user experience

## Migration Notes

The existing `walkthroughSteps` table data needs migration from `instructions` field to `contentFields` structure. A migration script should:

1. Read existing steps with `instructions` field
2. Convert to structured format with content in `contentForUser` field
3. Set other fields to empty strings
4. Update `contentFields` column with versioned structure

## References 

* Original requirements: `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/requirements.md`
* Feature specification: `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/feature.md`
* Database schema: `packages/database/src/schema.ts:212-240`
* Existing MCP tools: `packages/dashboard/src/lib/mcp/tools/walkthrough.ts`
* Current navigation: `packages/dashboard/src/components/app-sidebar.tsx:31-72`
* oRPC patterns: `packages/dashboard/src/lib/orpc/actions.ts:21-37`