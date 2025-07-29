'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Form, FormControl, FormDescription, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { updateWalkthroughStepAction } from '@/lib/orpc/actions'
import { zodResolver } from '@hookform/resolvers/zod'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import useLocalStorage from '@/hooks/use-local-storage'
import type { Walkthrough, WalkthroughStep } from 'database'
import { ChevronDownIcon, ChevronRightIcon, InfoIcon, SaveIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

const contentEditorSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
    contentFields: z.object({
        version: z.literal('v1'),
        introductionForAgent: z.string().optional(),
        contextForAgent: z.string().optional(),
        contentForUser: z.string().optional(),
        operationsForAgent: z.string().optional()
    })
})

type ContentEditorFormData = z.infer<typeof contentEditorSchema>

interface ContentEditorProps {
    walkthrough: Walkthrough
    step: WalkthroughStep
    onSaveStatusChange: (status: 'saved' | 'saving' | 'error' | 'unsaved') => void
}

const walkthroughFieldRequirements = {
    course: {
        introductionForAgent: false,
        contextForAgent: true,
        contentForUser: true,
        operationsForAgent: false
    },
    installer: {
        introductionForAgent: false,
        contextForAgent: true,
        contentForUser: true,
        operationsForAgent: true
    },
    troubleshooting: {
        introductionForAgent: true,
        contextForAgent: true,
        contentForUser: true,
        operationsForAgent: true
    },
    integration: {
        introductionForAgent: false,
        contextForAgent: true,
        contentForUser: true,
        operationsForAgent: true
    },
    quickstart: {
        introductionForAgent: false,
        contextForAgent: false,
        contentForUser: true,
        operationsForAgent: false
    }
} as const

export function ContentEditor({ walkthrough, step, onSaveStatusChange }: ContentEditorProps) {
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        introduction: false,
        context: false,
        operations: false
    })
    const [hasDraft, setHasDraft] = useState(false)
    const [showDraftAlert, setShowDraftAlert] = useState(false)
    const isUserInteracting = useRef(false)
    const lastStepId = useRef(step.id)

    const requirements = walkthroughFieldRequirements[walkthrough.type!] || {
        introductionForAgent: false,
        contextForAgent: false,
        contentForUser: true,
        operationsForAgent: false
    }
    const draftKey = `walkthrough-step-draft-${step.id}`
    const [draftData, setDraftData, draftChecked] = useLocalStorage<ContentEditorFormData | null>(draftKey, null)

    const form = useForm<ContentEditorFormData>({
        resolver: zodResolver(contentEditorSchema),
        defaultValues: {
            title: step.title,
            contentFields: {
                version: 'v1',
                introductionForAgent: (step.contentFields as any)?.introductionForAgent || '',
                contextForAgent: (step.contentFields as any)?.contextForAgent || '',
                contentForUser: (step.contentFields as any)?.contentForUser || '',
                operationsForAgent: (step.contentFields as any)?.operationsForAgent || ''
            }
        }
    })

    const { execute: updateStep } = useServerAction(updateWalkthroughStepAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Step saved successfully')
                onSaveStatusChange('saved')
                // Clear draft after successful save
                setDraftData(null)
                setHasDraft(false)
                setShowDraftAlert(false)
            }),
            onError((error) => {
                onSaveStatusChange('error')
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to save step')
                }
            })
        ]
    })

    // Separate draft detection from form reset to avoid race conditions
    useEffect(() => {
        if (!draftChecked) return
        
        let hasDraftData = false

        if (draftData) {
            const defaultValues = {
                title: step.title,
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: (step.contentFields as any)?.introductionForAgent || '',
                    contextForAgent: (step.contentFields as any)?.contextForAgent || '',
                    contentForUser: (step.contentFields as any)?.contentForUser || '',
                    operationsForAgent: (step.contentFields as any)?.operationsForAgent || ''
                }
            }
            // Compare draft with remote data to see if draft is different
            const isDifferent = JSON.stringify(draftData) !== JSON.stringify(defaultValues)
            if (isDifferent) {
                hasDraftData = true
            }
        }

        // Only update draft state, don't reset form here
        setHasDraft(hasDraftData)
        setShowDraftAlert(hasDraftData)
    }, [step.id, draftKey, draftData, draftChecked])

    // Form reset logic - only when step actually changes and user is not typing
    useEffect(() => {
        const stepChanged = lastStepId.current !== step.id
        lastStepId.current = step.id

        if (stepChanged && !isUserInteracting.current) {
            const defaultValues = {
                title: step.title,
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: (step.contentFields as any)?.introductionForAgent || '',
                    contextForAgent: (step.contentFields as any)?.contextForAgent || '',
                    contentForUser: (step.contentFields as any)?.contentForUser || '',
                    operationsForAgent: (step.contentFields as any)?.operationsForAgent || ''
                }
            }
            form.reset(defaultValues)
            onSaveStatusChange('saved')
        }
    }, [step.id, step.title, step.contentFields, form, onSaveStatusChange])

    // Auto-save to localStorage when form changes (only user changes, not programmatic)
    useEffect(() => {
        const subscription = form.watch((data) => {
            // Only save if form is dirty and user is actively interacting
            if (form.formState.isDirty && isUserInteracting.current) {
                setDraftData(data as ContentEditorFormData)
                setHasDraft(true)
                onSaveStatusChange('unsaved')
                // Hide the draft alert once user starts editing (they've made their choice)
                setShowDraftAlert(false)
            }
        })
        return () => subscription.unsubscribe()
    }, [form, setDraftData, onSaveStatusChange])

    // Keyboard shortcut for save
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                if (form.formState.isDirty) {
                    handleSave()
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [form.formState.isDirty])

    const handleSave = () => {
        const data = form.getValues()
        onSaveStatusChange('saving')
        updateStep({
            stepId: step.id,
            title: data.title,
            contentFields: data.contentFields
        })
    }

    const restoreDraft = () => {
        if (draftData) {
            form.reset(draftData)
            setShowDraftAlert(false)
            // Mark form as dirty since we're loading unsaved changes
            form.setValue('title', draftData.title, { shouldDirty: true })
            if (draftData.contentFields) {
                Object.entries(draftData.contentFields).forEach(([key, value]) => {
                    form.setValue(`contentFields.${key}` as any, value, { shouldDirty: true })
                })
            }
            // Update status to unsaved since we're showing draft content
            onSaveStatusChange('unsaved')
            toast.success('Draft restored')
        }
    }

    const discardDraft = () => {
        setDraftData(null)
        setHasDraft(false)
        setShowDraftAlert(false)
        
        // Reset form to remote data
        const defaultValues = {
            title: step.title,
            contentFields: {
                version: 'v1' as const,
                introductionForAgent: (step.contentFields as any)?.introductionForAgent || '',
                contextForAgent: (step.contentFields as any)?.contextForAgent || '',
                contentForUser: (step.contentFields as any)?.contentForUser || '',
                operationsForAgent: (step.contentFields as any)?.operationsForAgent || ''
            }
        }
        form.reset(defaultValues)
        toast.success('Draft discarded')
    }

    const toggleSection = (section: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [section]: !prev[section]
        }))
    }

    const getCharacterCount = (value: string) => value.length

    // User interaction handlers
    const handleInputFocus = () => {
        isUserInteracting.current = true
    }

    const handleInputBlur = () => {
        // Small delay to allow form state to settle
        setTimeout(() => {
            isUserInteracting.current = false
        }, 100)
    }

    return (
        <div className="h-full flex flex-col">
            <ScrollArea className="flex-1">
                <div className="p-6 max-w-4xl mx-auto">
                    {/* Draft Alert */}
                    {showDraftAlert && (
                        <Alert className="mb-6">
                            <InfoIcon className="h-4 w-4" />
                            <AlertDescription className="flex items-center justify-between">
                                <span>You have unsaved changes from a previous session.</span>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={restoreDraft}>
                                        Restore
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={discardDraft}>
                                        Discard
                                    </Button>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">Edit Step Content</h2>
                            <p className="text-muted-foreground mt-1">
                                Configure the content for this walkthrough step
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button onClick={handleSave} disabled={!form.formState.isDirty}>
                                <SaveIcon className="h-4 w-4 mr-2" />
                                Save Changes
                            </Button>
                        </div>
                    </div>

                    <Form {...form}>
                        <form className="space-y-6">
                            {/* Step Title */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg">Step Title</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <FormField
                                        control={form.control}
                                        name="title"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Enter a clear, descriptive title for this step"
                                                        {...field}
                                                        onFocus={handleInputFocus}
                                                        onBlur={handleInputBlur}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    {getCharacterCount(field.value)}/200 characters
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            {/* Introduction for Agent */}
                            <Collapsible
                                open={expandedSections.introduction}
                                onOpenChange={() => toggleSection('introduction')}
                            >
                                <Card>
                                    <CollapsibleTrigger asChild>
                                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">💬</span>
                                                    <div>
                                                        <CardTitle className="text-lg">
                                                            Introduction for Agent
                                                        </CardTitle>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            Brief context and learning objectives for this step
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {requirements.introductionForAgent ? (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Required
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Optional
                                                        </Badge>
                                                    )}
                                                    {expandedSections.introduction ? (
                                                        <ChevronDownIcon className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRightIcon className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <CardContent>
                                            <FormField
                                                control={form.control}
                                                name="contentFields.introductionForAgent"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Provide context about what this step accomplishes and what the user should learn..."
                                                                rows={4}
                                                                {...field}
                                                                onFocus={handleInputFocus}
                                                                onBlur={handleInputBlur}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            {getCharacterCount(field.value || '')} characters
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>

                            {/* Context for Agent */}
                            <Collapsible open={expandedSections.context} onOpenChange={() => toggleSection('context')}>
                                <Card>
                                    <CollapsibleTrigger asChild>
                                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">📝</span>
                                                    <div>
                                                        <CardTitle className="text-lg">Context for Agent</CardTitle>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            Background knowledge and search terms for the agent
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {requirements.contextForAgent ? (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Required
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Optional
                                                        </Badge>
                                                    )}
                                                    {expandedSections.context ? (
                                                        <ChevronDownIcon className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRightIcon className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <CardContent>
                                            <FormField
                                                control={form.control}
                                                name="contentFields.contextForAgent"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Provide background information, relevant terms, and where the agent can find more details..."
                                                                rows={4}
                                                                {...field}
                                                                onFocus={handleInputFocus}
                                                                onBlur={handleInputBlur}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            {getCharacterCount(field.value || '')} characters
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>

                            {/* Content for User */}
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg">🔧</span>
                                        <div>
                                            <CardTitle className="text-lg">Content for User</CardTitle>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Main instructional content that users will see
                                            </p>
                                        </div>
                                        <Badge variant="destructive" className="text-xs ml-auto">
                                            Required
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <FormField
                                        control={form.control}
                                        name="contentFields.contentForUser"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Enter the main content that users will see and interact with during this step..."
                                                        rows={6}
                                                        {...field}
                                                        onFocus={handleInputFocus}
                                                        onBlur={handleInputBlur}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    {getCharacterCount(field.value || '')} characters • Supports
                                                    Markdown
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>

                            {/* Operations for Agent */}
                            <Collapsible
                                open={expandedSections.operations}
                                onOpenChange={() => toggleSection('operations')}
                            >
                                <Card>
                                    <CollapsibleTrigger asChild>
                                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">⚡</span>
                                                    <div>
                                                        <CardTitle className="text-lg">Operations for Agent</CardTitle>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            Specific actions the agent should perform
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {requirements.operationsForAgent ? (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Required
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Optional
                                                        </Badge>
                                                    )}
                                                    {expandedSections.operations ? (
                                                        <ChevronDownIcon className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRightIcon className="h-4 w-4" />
                                                    )}
                                                </div>
                                            </div>
                                        </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <CardContent>
                                            <FormField
                                                control={form.control}
                                                name="contentFields.operationsForAgent"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="List specific operations like file creation, tool usage, API calls, etc..."
                                                                rows={4}
                                                                {...field}
                                                                onFocus={handleInputFocus}
                                                                onBlur={handleInputBlur}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            {getCharacterCount(field.value || '')} characters
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </CardContent>
                                    </CollapsibleContent>
                                </Card>
                            </Collapsible>
                        </form>
                    </Form>
                </div>
            </ScrollArea>
        </div>
    )
}
