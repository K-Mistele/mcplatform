# Interactive Walkthrough - Core Infrastructure & MCP Tools Implementation Plan

## Overview

Implementing foundational backend infrastructure and end-user-facing MCP tools that enable customers to deliver guided, step-by-step walkthroughs through their MCP servers. The system uses a many-to-many architecture with sophisticated progress tracking that survives content changes.

## Current State Analysis

### Key Discoveries:
- **MCP Infrastructure**: Mature patterns in `packages/dashboard/src/lib/mcp/index.ts:78-94` for tool registration
- **Tool Implementation**: Complete reference in `packages/dashboard/src/lib/mcp/tools/support.ts:88-160`
- **Database Patterns**: Established conventions with `nanoid` IDs, `bigint` timestamps, organization scoping
- **Authentication**: Dual system with sub-tenant OAuth for end-user identification
- **Progress Tracking**: UI components exist for progress visualization

### Key Patterns to Follow:
- VHost-based routing via `getMcpServerConfiguration` (mcp/index.ts:101-143)
- Tool registration with conditional logic based on server configuration
- Database operations with proper organization/server scoping
- Analytics tracking via `tool_calls` table integration

## What We're NOT Doing

- Dashboard UI components (separate sub-feature)
- Content management interface (separate sub-feature) 
- Advanced analytics dashboards (future phase)
- Rich media support or conditional branching (future phase)
- Any database migration execution (user will handle this)

## Implementation Approach

**Single-Phase Strategy**: Implement all database tables, utility functions, and MCP tools simultaneously to deliver complete backend functionality. Tools are conditionally registered only when servers have linked walkthroughs and walkthrough tools enabled.

## Phase 1: Complete Backend Infrastructure

### Overview
Implement all database tables, shared utilities, and MCP tools to provide complete walkthrough functionality for existing MCP servers.

### Changes Required:

#### 1. Database Schema Extensions
**File**: `packages/database/src/schema.ts`
**Changes**: Add four new tables and extend existing mcp_servers table

**A. Add walkthrough status enum:**
```typescript
const walkthroughStatusValues = ['not_started', 'in_progress', 'completed'] as const
export const walkthroughStatus = pgEnum('walkthrough_status', walkthroughStatusValues)
```

**B. Add walkthroughs table:**
```typescript
export const walkthroughs = pgTable('walkthroughs', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `wt_${nanoid(10)}`),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    firstStepId: text('first_step_id'),
    version: integer('version').default(1).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
}, (t) => [
    index('walkthroughs_organization_id_idx').on(t.organizationId),
    index('walkthroughs_is_published_idx').on(t.isPublished)
])
```

**C. Add mcp_server_walkthroughs junction table:**
```typescript
export const mcpServerWalkthroughs = pgTable('mcp_server_walkthroughs', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `msw_${nanoid(10)}`),
    mcpServerId: text('mcp_server_id')
        .references(() => mcpServers.id, { onDelete: 'cascade' })
        .notNull(),
    walkthroughId: text('walkthrough_id')
        .references(() => walkthroughs.id, { onDelete: 'cascade' })
        .notNull(),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    displayOrder: integer('display_order').default(0),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    assignedAt: bigint('assigned_at', { mode: 'number' }).$defaultFn(() => Date.now()),
}, (t) => [
    unique('mcp_server_walkthrough_unique').on(t.mcpServerId, t.walkthroughId),
    index('mcp_server_walkthroughs_server_id_idx').on(t.mcpServerId),
    index('mcp_server_walkthroughs_walkthrough_id_idx').on(t.walkthroughId),
    index('mcp_server_walkthroughs_display_order_idx').on(t.displayOrder)
])
```

**D. Add walkthrough_steps table:**
```typescript
export const walkthroughSteps = pgTable('walkthrough_steps', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `ws_${nanoid(10)}`),
    walkthroughId: text('walkthrough_id')
        .references(() => walkthroughs.id, { onDelete: 'cascade' })
        .notNull(),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    title: text('title').notNull(),
    sectionTitle: text('section_title'),
    content: text('content').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    nextStepId: text('next_step_id').references((): AnyPgColumn => walkthroughSteps.id, { onDelete: 'set null' }),
    displayOrder: integer('display_order').default(0),
}, (t) => [
    index('walkthrough_steps_walkthrough_id_idx').on(t.walkthroughId),
    index('walkthrough_steps_display_order_idx').on(t.displayOrder),
    index('walkthrough_steps_next_step_id_idx').on(t.nextStepId)
])
```

**E. Add walkthrough_progress table:**
```typescript
export const walkthroughProgress = pgTable('walkthrough_progress', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `wp_${nanoid(10)}`),
    mcpServerUserId: text('mcp_server_user_id')
        .references(() => mcpServerUser.id, { onDelete: 'cascade' })
        .notNull(),
    walkthroughId: text('walkthrough_id')
        .references(() => walkthroughs.id, { onDelete: 'cascade' })
        .notNull(),
    mcpServerId: text('mcp_server_id')
        .references(() => mcpServers.id, { onDelete: 'cascade' })
        .notNull(),
    currentStepId: text('current_step_id')
        .references(() => walkthroughSteps.id, { onDelete: 'cascade' })
        .notNull(),
    status: walkthroughStatus('status').default('not_started'),
    completedSteps: jsonb('completed_steps').$type<string[]>().default([]),
    startedAt: bigint('started_at', { mode: 'number' }),
    completedAt: bigint('completed_at', { mode: 'number' }),
    version: integer('version').notNull(),
}, (t) => [
    unique('user_walkthrough_progress_unique').on(t.mcpServerUserId, t.walkthroughId),
    index('walkthrough_progress_user_id_idx').on(t.mcpServerUserId),
    index('walkthrough_progress_walkthrough_id_idx').on(t.walkthroughId),
    index('walkthrough_progress_status_idx').on(t.status)
])
```

**F. Extend mcpServers table:**
```typescript
// Add to existing mcpServers table definition
walkthroughToolsEnabled: boolean('walkthrough_tools_enabled').default(false).notNull(),
```

**G. Add foreign key reference for firstStepId:**
```typescript
// Add after walkthrough_steps table definition
export const walkthroughsRelations = relations(walkthroughs, ({ one, many }) => ({
    firstStep: one(walkthroughSteps, {
        fields: [walkthroughs.firstStepId],
        references: [walkthroughSteps.id],
    }),
    steps: many(walkthroughSteps),
    serverAssignments: many(mcpServerWalkthroughs),
}))

export const walkthroughStepsRelations = relations(walkthroughSteps, ({ one }) => ({
    walkthrough: one(walkthroughs, {
        fields: [walkthroughSteps.walkthroughId],
        references: [walkthroughs.id],
    }),
    nextStep: one(walkthroughSteps, {
        fields: [walkthroughSteps.nextStepId],
        references: [walkthroughSteps.id],
    }),
}))
```

#### 2. Database Schema Exports
**File**: `packages/database/index.ts`
**Changes**: Export new table schemas and types

```typescript
// Add to existing exports
export type {
    Walkthrough,
    WalkthroughStep, 
    WalkthroughProgress,
    McpServerWalkthrough
} from './src/schema'

export {
    walkthroughs,
    walkthroughSteps,
    walkthroughProgress,
    mcpServerWalkthroughs,
    walkthroughStatus
} from './src/schema'
```

#### 3. Shared Progress Calculation Utility
**File**: `packages/dashboard/src/lib/mcp/walkthrough-utils.ts` (NEW FILE)
**Changes**: Create shared utility functions for walkthrough operations

```typescript
import { db } from '@/lib/db'
import { and, eq, isNull } from 'drizzle-orm'
import * as schema from 'database'

export interface WalkthroughStepInfo {
    id: string
    title: string
    content: string
    displayOrder: number
    sectionTitle: string | null
}

export interface ProgressInfo {
    currentStepId: string | null
    completedSteps: string[]
    status: 'not_started' | 'in_progress' | 'completed'
    nextStep: WalkthroughStepInfo | null
    allSteps: WalkthroughStepInfo[]
}

/**
 * Calculate the next step for a user in a walkthrough using dynamic algorithm
 * that survives walkthrough content changes
 */
export async function calculateNextStep(
    mcpServerUserId: string,
    walkthroughId: string
): Promise<WalkthroughStepInfo | null> {
    // Fetch user progress and all walkthrough steps concurrently
    const [progressResult, allSteps] = await Promise.all([
        db
            .select({ completedSteps: schema.walkthroughProgress.completedSteps })
            .from(schema.walkthroughProgress)
            .where(
                and(
                    eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                    eq(schema.walkthroughProgress.walkthroughId, walkthroughId)
                )
            )
            .limit(1),
        db
            .select({
                id: schema.walkthroughSteps.id,
                title: schema.walkthroughSteps.title,
                content: schema.walkthroughSteps.content,
                displayOrder: schema.walkthroughSteps.displayOrder,
                sectionTitle: schema.walkthroughSteps.sectionTitle
            })
            .from(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.walkthroughId, walkthroughId))
            .orderBy(schema.walkthroughSteps.displayOrder)
    ])

    const completedSteps = progressResult[0]?.completedSteps ?? []
    
    // Find first step not in completed array
    const nextStep = allSteps.find(step => !completedSteps.includes(step.id))
    return nextStep ?? null
}

/**
 * Get comprehensive progress information for a user's walkthrough
 */
export async function getWalkthroughProgress(
    mcpServerUserId: string,
    walkthroughId: string
): Promise<ProgressInfo | null> {
    const [progressResult, allSteps] = await Promise.all([
        db
            .select()
            .from(schema.walkthroughProgress)
            .where(
                and(
                    eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                    eq(schema.walkthroughProgress.walkthroughId, walkthroughId)
                )
            )
            .limit(1),
        db
            .select({
                id: schema.walkthroughSteps.id,
                title: schema.walkthroughSteps.title,
                content: schema.walkthroughSteps.content,
                displayOrder: schema.walkthroughSteps.displayOrder,
                sectionTitle: schema.walkthroughSteps.sectionTitle
            })
            .from(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.walkthroughId, walkthroughId))
            .orderBy(schema.walkthroughSteps.displayOrder)
    ])

    if (!progressResult[0]) return null

    const progress = progressResult[0]
    const nextStep = await calculateNextStep(mcpServerUserId, walkthroughId)

    return {
        currentStepId: progress.currentStepId,
        completedSteps: progress.completedSteps,
        status: progress.status,
        nextStep,
        allSteps
    }
}

/**
 * Check if a server has any enabled walkthroughs assigned
 */
export async function serverHasWalkthroughs(mcpServerId: string): Promise<boolean> {
    const result = await db
        .select({ count: schema.mcpServerWalkthroughs.id })
        .from(schema.mcpServerWalkthroughs)
        .innerJoin(
            schema.walkthroughs,
            eq(schema.mcpServerWalkthroughs.walkthroughId, schema.walkthroughs.id)
        )
        .where(
            and(
                eq(schema.mcpServerWalkthroughs.mcpServerId, mcpServerId),
                eq(schema.mcpServerWalkthroughs.isEnabled, true),
                eq(schema.walkthroughs.isPublished, true)
            )
        )
        .limit(1)
    
    return result.length > 0
}
```

#### 4. MCP Tools Implementation
**File**: `packages/dashboard/src/lib/mcp/tools/walkthrough.ts` (NEW FILE)
**Changes**: Implement all 5 walkthrough MCP tools following established patterns

```typescript
import { z } from 'zod'
import { db } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import * as schema from 'database'
import type { McpServer, McpServerConfig } from '../types'
import { calculateNextStep, getWalkthroughProgress, serverHasWalkthroughs } from '../walkthrough-utils'

interface WalkthroughToolParams {
    server: McpServer
    serverConfig: McpServerConfig
    trackingId: string | null
    email: string | null
    mcpServerUserId: string
    serverSessionId: string
}

export async function registerWalkthroughTools(params: WalkthroughToolParams) {
    const { server, serverConfig } = params
    
    // Only register tools if server has walkthrough tools enabled and has walkthroughs
    if (!serverConfig.walkthroughToolsEnabled) return
    
    const hasWalkthroughs = await serverHasWalkthroughs(serverConfig.id)
    if (!hasWalkthroughs) return
    
    // Register all walkthrough tools
    registerListWalkthroughsTool(params)
    registerSelectWalkthroughTool(params)
    registerNextWalkthroughStepTool(params)
    registerGetWalkthroughStatusTool(params)
    registerResetWalkthroughProgressTool(params)
}

function registerListWalkthroughsTool({
    server,
    serverConfig,
    mcpServerUserId,
    serverSessionId
}: WalkthroughToolParams) {
    server.registerTool(
        'list_walkthroughs',
        {
            title: 'List Available Walkthroughs',
            description: 'List all available walkthroughs for this MCP server',
            inputSchema: z.object({}).shape
        },
        async () => {
            // Track tool call
            await db.insert(schema.toolCalls).values({
                toolName: 'list_walkthroughs',
                input: {},
                output: 'walkthroughs_listed',
                mcpServerId: serverConfig.id,
                mcpServerSessionId: serverSessionId,
                mcpServerUserId
            })

            // Fetch available walkthroughs
            const walkthroughs = await db
                .select({
                    id: schema.walkthroughs.id,
                    title: schema.walkthroughs.title,
                    description: schema.walkthroughs.description,
                    stepCount: schema.walkthroughSteps.id // We'll count these
                })
                .from(schema.walkthroughs)
                .innerJoin(
                    schema.mcpServerWalkthroughs,
                    eq(schema.walkthroughs.id, schema.mcpServerWalkthroughs.walkthroughId)
                )
                .leftJoin(
                    schema.walkthroughSteps,
                    eq(schema.walkthroughs.id, schema.walkthroughSteps.walkthroughId)
                )
                .where(
                    and(
                        eq(schema.mcpServerWalkthroughs.mcpServerId, serverConfig.id),
                        eq(schema.mcpServerWalkthroughs.isEnabled, true),
                        eq(schema.walkthroughs.isPublished, true)
                    )
                )
                .orderBy(schema.mcpServerWalkthroughs.displayOrder)

            // Group and count steps
            const walkthroughMap = new Map<string, any>()
            for (const row of walkthroughs) {
                if (!walkthroughMap.has(row.id)) {
                    walkthroughMap.set(row.id, {
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        stepCount: 0
                    })
                }
                if (row.stepCount) {
                    walkthroughMap.get(row.id)!.stepCount++
                }
            }

            const availableWalkthroughs = Array.from(walkthroughMap.values())

            if (availableWalkthroughs.length === 0) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No walkthroughs are currently available for this server.'
                    }]
                }
            }

            const walkthroughList = availableWalkthroughs
                .map(wt => `• **${wt.title}** (${wt.stepCount} steps)\n  ID: ${wt.id}\n  ${wt.description || 'No description'}`)
                .join('\n\n')

            return {
                content: [{
                    type: 'text',
                    text: `Available Walkthroughs:\n\n${walkthroughList}\n\nUse the \`select_walkthrough\` tool with a walkthrough ID to start or resume a walkthrough.`
                }]
            }
        }
    )
}

function registerSelectWalkthroughTool({
    server,
    serverConfig,
    email,
    mcpServerUserId,
    serverSessionId
}: WalkthroughToolParams) {
    const inputSchema = z.object({
        walkthrough_id: z.string().describe('The ID of the walkthrough to start or resume'),
        resume_if_exists: z.boolean().default(true).describe('Whether to resume existing progress if found')
    })

    server.registerTool(
        'select_walkthrough',
        {
            title: 'Start or Resume Walkthrough',
            description: 'Start a new walkthrough or resume an existing one',
            inputSchema: inputSchema.shape
        },
        async (args) => {
            // Validate authentication
            if (!email) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Authentication required. Please log in to start a walkthrough.'
                    }]
                }
            }

            // Track tool call
            await db.insert(schema.toolCalls).values({
                toolName: 'select_walkthrough',
                input: args,
                output: 'walkthrough_selected',
                mcpServerId: serverConfig.id,
                mcpServerSessionId: serverSessionId,
                mcpServerUserId
            })

            // Verify walkthrough exists and is available on this server
            const walkthroughAssignment = await db
                .select({
                    walkthroughId: schema.walkthroughs.id,
                    title: schema.walkthroughs.title,
                    version: schema.walkthroughs.version,
                    firstStepId: schema.walkthroughs.firstStepId
                })
                .from(schema.walkthroughs)
                .innerJoin(
                    schema.mcpServerWalkthroughs,
                    eq(schema.walkthroughs.id, schema.mcpServerWalkthroughs.walkthroughId)
                )
                .where(
                    and(
                        eq(schema.walkthroughs.id, args.walkthrough_id),
                        eq(schema.mcpServerWalkthroughs.mcpServerId, serverConfig.id),
                        eq(schema.mcpServerWalkthroughs.isEnabled, true),
                        eq(schema.walkthroughs.isPublished, true)
                    )
                )
                .limit(1)

            if (!walkthroughAssignment[0]) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Walkthrough not found or not available on this server. Use `list_walkthroughs` to see available options.'
                    }]
                }
            }

            const walkthrough = walkthroughAssignment[0]

            // Check for existing progress
            let existingProgress = await db
                .select()
                .from(schema.walkthroughProgress)
                .where(
                    and(
                        eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                        eq(schema.walkthroughProgress.walkthroughId, args.walkthrough_id)
                    )
                )
                .limit(1)

            if (existingProgress[0] && args.resume_if_exists) {
                // Resume existing progress
                const nextStep = await calculateNextStep(mcpServerUserId, args.walkthrough_id)
                
                if (!nextStep) {
                    return {
                        content: [{
                            type: 'text',
                            text: `🎉 You've already completed the "${walkthrough.title}" walkthrough! Use \`get_walkthrough_status\` to review your progress.`
                        }]
                    }
                }

                return {
                    content: [{
                        type: 'text',
                        text: `📚 Resuming "${walkthrough.title}" walkthrough...\n\n📝 **${nextStep.title}**\n\n${nextStep.content}\n\nUse \`next_walkthrough_step\` when you've completed this step.`
                    }]
                }
            }

            // Start new walkthrough or create fresh progress
            if (!walkthrough.firstStepId) {
                return {
                    content: [{
                        type: 'text',
                        text: 'This walkthrough has no steps configured. Please contact support.'
                    }]
                }
            }

            // Get first step content
            const firstStep = await db
                .select({
                    id: schema.walkthroughSteps.id,
                    title: schema.walkthroughSteps.title,
                    content: schema.walkthroughSteps.content
                })
                .from(schema.walkthroughSteps)
                .where(eq(schema.walkthroughSteps.id, walkthrough.firstStepId))
                .limit(1)

            if (!firstStep[0]) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Walkthrough configuration error. Please contact support.'
                    }]
                }
            }

            // Create or update progress record
            const now = Date.now()
            await db
                .insert(schema.walkthroughProgress)
                .values({
                    mcpServerUserId,
                    walkthroughId: args.walkthrough_id,
                    mcpServerId: serverConfig.id,
                    currentStepId: firstStep[0].id,
                    status: 'in_progress',
                    completedSteps: [],
                    startedAt: now,
                    version: walkthrough.version
                })
                .onConflictDoUpdate({
                    target: [schema.walkthroughProgress.mcpServerUserId, schema.walkthroughProgress.walkthroughId],
                    set: {
                        currentStepId: firstStep[0].id,
                        status: 'in_progress',
                        completedSteps: [],
                        startedAt: now,
                        version: walkthrough.version,
                        completedAt: null
                    }
                })

            return {
                content: [{
                    type: 'text',
                    text: `📚 Starting "${walkthrough.title}" walkthrough...\n\n📝 **${firstStep[0].title}**\n\n${firstStep[0].content}\n\nUse \`next_walkthrough_step\` when you've completed this step.`
                }]
            }
        }
    )
}

function registerNextWalkthroughStepTool({
    server,
    serverConfig,
    email,
    mcpServerUserId,
    serverSessionId
}: WalkthroughToolParams) {
    server.registerTool(
        'next_walkthrough_step',
        {
            title: 'Advance to Next Step',
            description: 'Mark current step as completed and advance to the next step in the walkthrough',
            inputSchema: z.object({}).shape
        },
        async () => {
            if (!email) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Authentication required. Please log in to continue the walkthrough.'
                    }]
                }
            }

            // Track tool call
            await db.insert(schema.toolCalls).values({
                toolName: 'next_walkthrough_step',
                input: {},
                output: 'step_advanced',
                mcpServerId: serverConfig.id,
                mcpServerSessionId: serverSessionId,
                mcpServerUserId
            })

            // Get current progress
            const progressResult = await db
                .select()
                .from(schema.walkthroughProgress)
                .where(
                    and(
                        eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                        eq(schema.walkthroughProgress.status, 'in_progress')
                    )
                )
                .limit(1)

            if (!progressResult[0]) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No active walkthrough found. Use `select_walkthrough` to start a walkthrough first.'
                    }]
                }
            }

            const progress = progressResult[0]

            // Mark current step as completed and calculate next step
            const updatedCompletedSteps = [...progress.completedSteps, progress.currentStepId]
            const nextStep = await calculateNextStep(mcpServerUserId, progress.walkthroughId)

            if (!nextStep) {
                // Walkthrough completed
                await db
                    .update(schema.walkthroughProgress)
                    .set({
                        status: 'completed',
                        completedSteps: updatedCompletedSteps,
                        completedAt: Date.now()
                    })
                    .where(eq(schema.walkthroughProgress.id, progress.id))

                const walkthrough = await db
                    .select({ title: schema.walkthroughs.title })
                    .from(schema.walkthroughs)
                    .where(eq(schema.walkthroughs.id, progress.walkthroughId))
                    .limit(1)

                return {
                    content: [{
                        type: 'text',
                        text: `🎉 Congratulations! You've completed the "${walkthrough[0]?.title}" walkthrough!\n\nUse \`list_walkthroughs\` to explore other available walkthroughs.`
                    }]
                }
            }

            // Update progress with completed step and new current step
            await db
                .update(schema.walkthroughProgress)
                .set({
                    currentStepId: nextStep.id,
                    completedSteps: updatedCompletedSteps
                })
                .where(eq(schema.walkthroughProgress.id, progress.id))

            return {
                content: [{
                    type: 'text',
                    text: `✅ Step completed!\n\n📝 **${nextStep.title}**\n\n${nextStep.content}\n\nUse \`next_walkthrough_step\` when you've completed this step.`
                }]
            }
        }
    )
}

function registerGetWalkthroughStatusTool({
    server,
    serverConfig,
    email,
    mcpServerUserId,
    serverSessionId
}: WalkthroughToolParams) {
    const inputSchema = z.object({
        walkthrough_id: z.string().describe('The ID of the walkthrough to check status for')
    })

    server.registerTool(
        'get_walkthrough_status',
        {
            title: 'Get Walkthrough Status',
            description: 'Get current progress status for a specific walkthrough',
            inputSchema: inputSchema.shape
        },
        async (args) => {
            if (!email) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Authentication required. Please log in to check walkthrough status.'
                    }]
                }
            }

            // Track tool call
            await db.insert(schema.toolCalls).values({
                toolName: 'get_walkthrough_status',
                input: args,
                output: 'status_retrieved',
                mcpServerId: serverConfig.id,
                mcpServerSessionId: serverSessionId,
                mcpServerUserId
            })

            const progressInfo = await getWalkthroughProgress(mcpServerUserId, args.walkthrough_id)

            if (!progressInfo) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No progress found for this walkthrough. Use `select_walkthrough` to start it.'
                    }]
                }
            }

            const walkthrough = await db
                .select({ title: schema.walkthroughs.title })
                .from(schema.walkthroughs)
                .where(eq(schema.walkthroughs.id, args.walkthrough_id))
                .limit(1)

            const totalSteps = progressInfo.allSteps.length
            const completedCount = progressInfo.completedSteps.length
            const progressPercent = Math.round((completedCount / totalSteps) * 100)

            let statusText = `📊 **Walkthrough Status**: ${walkthrough[0]?.title}\n\n`
            statusText += `**Overall Progress**: ${completedCount}/${totalSteps} steps (${progressPercent}%)\n`
            statusText += `**Status**: ${progressInfo.status.replace('_', ' ')}\n\n`

            if (progressInfo.nextStep) {
                statusText += `**Next Step**: ${progressInfo.nextStep.title}\n\n`
            }

            statusText += '**All Steps**:\n'
            for (const step of progressInfo.allSteps) {
                const isCompleted = progressInfo.completedSteps.includes(step.id)
                const isCurrent = step.id === progressInfo.currentStepId
                const icon = isCompleted ? '✅' : (isCurrent ? '▶️' : '⭕')
                statusText += `${icon} ${step.title}\n`
            }

            return {
                content: [{
                    type: 'text',
                    text: statusText
                }]
            }
        }
    )
}

function registerResetWalkthroughProgressTool({
    server,
    serverConfig,
    email,
    mcpServerUserId,
    serverSessionId
}: WalkthroughToolParams) {
    const inputSchema = z.object({
        walkthrough_id: z.string().describe('The ID of the walkthrough to reset'),
        confirm: z.boolean().describe('Must be true to confirm the reset action')
    })

    server.registerTool(
        'reset_walkthrough_progress',
        {
            title: 'Reset Walkthrough Progress',
            description: 'Reset all progress for a specific walkthrough. This action cannot be undone.',
            inputSchema: inputSchema.shape
        },
        async (args) => {
            if (!email) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Authentication required. Please log in to reset walkthrough progress.'
                    }]
                }
            }

            if (!args.confirm) {
                return {
                    content: [{
                        type: 'text',
                        text: '⚠️ This action will delete all your progress for this walkthrough and cannot be undone. To proceed, call this tool again with confirm=true.'
                    }]
                }
            }

            // Track tool call
            await db.insert(schema.toolCalls).values({
                toolName: 'reset_walkthrough_progress',
                input: args,
                output: 'progress_reset',
                mcpServerId: serverConfig.id,
                mcpServerSessionId: serverSessionId,
                mcpServerUserId
            })

            // Check if progress exists
            const existingProgress = await db
                .select({ id: schema.walkthroughProgress.id })
                .from(schema.walkthroughProgress)
                .where(
                    and(
                        eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId),
                        eq(schema.walkthroughProgress.walkthroughId, args.walkthrough_id)
                    )
                )
                .limit(1)

            if (!existingProgress[0]) {
                return {
                    content: [{
                        type: 'text',
                        text: 'No progress found for this walkthrough. Nothing to reset.'
                    }]
                }
            }

            // Delete progress record
            await db
                .delete(schema.walkthroughProgress)
                .where(eq(schema.walkthroughProgress.id, existingProgress[0].id))

            const walkthrough = await db
                .select({ title: schema.walkthroughs.title })
                .from(schema.walkthroughs)
                .where(eq(schema.walkthroughs.id, args.walkthrough_id))
                .limit(1)

            return {
                content: [{
                    type: 'text',
                    text: `🧹 Progress reset successfully for "${walkthrough[0]?.title}". You can start the walkthrough fresh using \`select_walkthrough\`.`
                }]
            }
        }
    )
}
```

#### 5. Tool Registration Integration
**File**: `packages/dashboard/src/lib/mcp/index.ts`
**Changes**: Add walkthrough tools to the main registration function

```typescript
// Import walkthrough tools
import { registerWalkthroughTools } from './tools/walkthrough'

// Add to registerMcpServerToolsFromConfig function (line ~93)
export function registerMcpServerToolsFromConfig({
    server,
    serverConfig,
    trackingId,
    email,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    trackingId: string | null
    email: string | null
    mcpServerUserId: string
    serverSessionId: string
}) {
    // Register existing tools
    registerMcpSupportTool({ server, serverConfig, trackingId, email, mcpServerUserId, serverSessionId })
    
    // Register walkthrough tools (conditionally)
    registerWalkthroughTools({ server, serverConfig, trackingId, email, mcpServerUserId, serverSessionId })
}
```

#### 6. Test Requirements Documentation
**File**: `packages/dashboard/tests/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/documentation.md` (NEW FILE)
**Changes**: Comprehensive test requirements for walkthrough infrastructure

```markdown
# Walkthrough Core Infrastructure Test Requirements

## Overview
Test requirements for the Interactive Walkthrough Core Infrastructure & MCP Tools implementation.

## Database Schema Tests

### Table Creation Tests
- [ ] **Enum Creation**: Verify `walkthrough_status` enum is created with correct values
- [ ] **Table Structure**: Verify all 4 tables are created with correct columns and types
- [ ] **Indexes**: Verify all specified indexes are created for query performance
- [ ] **Foreign Keys**: Verify all foreign key relationships work correctly
- [ ] **Self-Reference**: Verify `walkthrough_steps.next_step_id` self-reference works
- [ ] **Unique Constraints**: Verify unique constraints prevent duplicate assignments and progress records

### Data Integrity Tests  
- [ ] **Organization Scoping**: Verify all tables properly scope data to organizations
- [ ] **Cascade Deletions**: Verify cascade deletes work correctly when parent records are deleted
- [ ] **JSONB Fields**: Verify `completedSteps` JSONB array handles empty arrays and step IDs correctly

## Shared Utility Tests

### Progress Calculation Algorithm Tests
- [ ] **Basic Next Step**: calculateNextStep returns first uncompleted step
- [ ] **All Steps Completed**: calculateNextStep returns null when all steps completed  
- [ ] **Content Change Resilience**: Algorithm works after steps are reordered via displayOrder
- [ ] **Empty Progress**: Algorithm works correctly for users with no progress
- [ ] **Partial Progress**: Algorithm correctly skips completed steps based on completedSteps array

### Server Walkthrough Detection Tests
- [ ] **Has Walkthroughs**: serverHasWalkthroughs returns true for servers with enabled, published walkthroughs
- [ ] **No Walkthroughs**: Returns false for servers with no walkthrough assignments
- [ ] **Disabled Walkthroughs**: Returns false for servers with only disabled walkthrough assignments
- [ ] **Unpublished Walkthroughs**: Returns false for servers with only unpublished walkthroughs

## MCP Tools Registration Tests

### Conditional Registration Tests
- [ ] **Tools Enabled + Has Walkthroughs**: All 5 tools registered when server has walkthroughToolsEnabled=true and assigned walkthroughs
- [ ] **Tools Disabled**: No tools registered when walkthroughToolsEnabled=false
- [ ] **No Walkthroughs**: No tools registered when server has no walkthrough assignments
- [ ] **Tools Enabled + No Walkthroughs**: No tools registered when server has no walkthroughs but tools enabled

## MCP Tools Functionality Tests

### list_walkthroughs Tool Tests
- [ ] **Basic Listing**: Returns all available walkthroughs for server with correct ordering
- [ ] **Step Counting**: Correctly counts and displays step counts for each walkthrough
- [ ] **Filtering**: Only shows enabled and published walkthroughs
- [ ] **Empty State**: Returns appropriate message when no walkthroughs available
- [ ] **Analytics Tracking**: Tool call is logged to tool_calls table

### select_walkthrough Tool Tests
- [ ] **Start New Walkthrough**: Creates progress record and returns first step content
- [ ] **Resume Existing**: Resumes from correct step when resume_if_exists=true
- [ ] **Fresh Start**: Creates new progress when resume_if_exists=false
- [ ] **Walkthrough Not Found**: Returns error for invalid walkthrough_id
- [ ] **Authentication Required**: Returns error when user not authenticated
- [ ] **Completed Walkthrough**: Returns completion message for already completed walkthroughs
- [ ] **Version Tracking**: Progress record stores correct walkthrough version

### next_walkthrough_step Tool Tests
- [ ] **Step Advancement**: Correctly marks current step complete and advances to next step
- [ ] **Progress Tracking**: Updates completedSteps array correctly
- [ ] **Walkthrough Completion**: Marks walkthrough complete when last step reached
- [ ] **No Active Walkthrough**: Returns error when user has no active walkthrough
- [ ] **Authentication Required**: Returns error when user not authenticated
- [ ] **Dynamic Calculation**: Uses calculateNextStep algorithm correctly

### get_walkthrough_status Tool Tests  
- [ ] **Progress Display**: Shows correct step completion status and overall progress
- [ ] **Current Step**: Identifies current/next step correctly
- [ ] **Completion Percentage**: Calculates and displays correct completion percentage  
- [ ] **Step List**: Shows all steps with correct completion status indicators
- [ ] **No Progress**: Returns appropriate message when no progress exists
- [ ] **Authentication Required**: Returns error when user not authenticated

### reset_walkthrough_progress Tool Tests
- [ ] **Confirmation Required**: Returns warning when confirm=false
- [ ] **Progress Reset**: Successfully deletes progress record when confirm=true
- [ ] **No Progress**: Returns appropriate message when no progress to reset
- [ ] **Authentication Required**: Returns error when user not authenticated

## Integration Tests

### End-to-End Workflow Tests
- [ ] **Complete Walkthrough**: User can list → select → advance through all steps → complete walkthrough
- [ ] **Resume Workflow**: User can start walkthrough, stop, and resume from correct step later
- [ ] **Status Checking**: User can check status at any point and get accurate information
- [ ] **Reset and Restart**: User can reset progress and start walkthrough fresh

### Authentication Integration Tests
- [ ] **OAuth Flow**: Tools work correctly with OAuth-authenticated users
- [ ] **Non-OAuth**: Tools handle non-OAuth authentication appropriately
- [ ] **Session Management**: Tools integrate correctly with existing session tracking

### Database Transaction Tests
- [ ] **Atomic Updates**: Progress updates are atomic (completedSteps, currentStepId, status updated together)
- [ ] **Concurrent Access**: Multiple users can progress through same walkthrough without conflicts
- [ ] **Error Rollback**: Database operations rollback correctly on error

## Performance Tests
- [ ] **Large Step Count**: Tools perform adequately with walkthroughs having 50+ steps
- [ ] **Multiple Walkthroughs**: Server performs adequately with 20+ assigned walkthroughs
- [ ] **Query Performance**: All queries complete within 200ms under normal load

## Security Tests
- [ ] **Organization Isolation**: Users can only access walkthroughs from their organization
- [ ] **Server Scoping**: Users can only access walkthroughs assigned to current server
- [ ] **Progress Isolation**: Users can only view/modify their own progress records
```

### Success Criteria:

**Automated Verification**
- [ ] No linter errors after running `bunx @biomejs/biome check .`
- [ ] All database tables created successfully after migration
- [ ] All 5 MCP tools register successfully when conditions are met
- [ ] Tools do not register when conditions are not met

**Manual Verification**  
- [ ] Feature works as expected when tested in MCP client environment
- [ ] Feature works as expected when testing with Puppeteer against running dev server
- [ ] Edge case handling verified manually (authentication errors, missing data, etc.)
- [ ] No regressions in existing MCP server functionality
- [ ] Progress calculation algorithm survives walkthrough content changes
- [ ] All tools return properly formatted MCP responses

## Performance Considerations

**Database Query Optimization:**
- All junction table queries use proper indexes for server-walkthrough lookups
- Progress queries use user and walkthrough indexes for fast access
- Linked-list traversal minimized by using displayOrder-based calculation

**Memory Usage:**
- Walkthrough content loaded on-demand, not cached in memory initially
- Large completedSteps arrays handled efficiently via JSONB operations

## Migration Notes

**Database Migration Steps:**
1. User generates migration: `cd packages/database && bun run db:generate`
2. User runs migration: `cd packages/database && bun run db:migrate`
3. Verify schema changes in database
4. Test tool registration with new server configuration field

**Post-Migration Setup:**
- No existing data migrations required (new feature)
- Existing MCP servers default to walkthroughToolsEnabled=false
- Dashboard users can enable walkthrough tools via server configuration

## References
* Original requirements: `specifications/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/requirements.md`
* Technical specification: `specifications/03-interactive-walkthrough/thoughts/technical-specification.md`
* Parent feature: `specifications/03-interactive-walkthrough/feature.md`
* Similar MCP tool implementation: `packages/dashboard/src/lib/mcp/tools/support.ts:88-160`
* Database schema patterns: `packages/database/src/schema.ts`
* Tool registration: `packages/dashboard/src/lib/mcp/index.ts:78-94`