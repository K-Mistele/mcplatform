'use client'

import { useState } from 'react'
import { EyeIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { renderWalkthroughStep } from '@/lib/template-engine'
import type { Walkthrough, WalkthroughStep } from 'database'

interface PreviewPanelProps {
    walkthrough: Walkthrough
    step: WalkthroughStep | null
}

export function PreviewPanel({ walkthrough, step }: PreviewPanelProps) {
    const [previewMode, setPreviewMode] = useState<'edit' | 'template'>('edit')

    if (!step) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                    <EyeIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Select a step to preview</h3>
                    <p className="text-muted-foreground">
                        Choose a step from the navigator to see the preview
                    </p>
                </div>
            </div>
        )
    }

    const contentFields = step.contentFields as any
    const renderedTemplate = renderWalkthroughStep(walkthrough, step)

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Preview</h3>
                    <div className="flex rounded-md border">
                        <Button
                            variant={previewMode === 'edit' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPreviewMode('edit')}
                            className="rounded-r-none border-r"
                        >
                            Edit View
                        </Button>
                        <Button
                            variant={previewMode === 'template' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPreviewMode('template')}
                            className="rounded-l-none"
                        >
                            AI Template
                        </Button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    {previewMode === 'edit' 
                        ? 'Structured content breakdown'
                        : 'Final template output for AI agent'
                    }
                </p>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-4">
                    {previewMode === 'edit' ? (
                        <div className="space-y-4">
                            {/* Step Title */}
                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" className="text-xs">
                                        Step {step.displayOrder}
                                    </Badge>
                                </div>
                                <h4 className="font-semibold text-primary">
                                    {step.title}
                                </h4>
                            </div>

                            {/* Introduction for Agent */}
                            {contentFields?.introductionForAgent?.trim() && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span>💬</span>
                                        <h5 className="font-medium text-sm">Introduction for Agent</h5>
                                    </div>
                                    <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                                        {contentFields.introductionForAgent}
                                    </div>
                                </div>
                            )}

                            {/* Context for Agent */}
                            {contentFields?.contextForAgent?.trim() && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span>📝</span>
                                        <h5 className="font-medium text-sm">Context for Agent</h5>
                                    </div>
                                    <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                                        {contentFields.contextForAgent}
                                    </div>
                                </div>
                            )}

                            {/* Content for User */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span>🔧</span>
                                    <h5 className="font-medium text-sm">Content for User</h5>
                                    <Badge variant="destructive" className="text-xs">Required</Badge>
                                </div>
                                {contentFields?.contentForUser?.trim() ? (
                                    <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm whitespace-pre-wrap">
                                        {contentFields.contentForUser}
                                    </div>
                                ) : (
                                    <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3 text-sm text-destructive">
                                        No user content provided. This field is required.
                                    </div>
                                )}
                            </div>

                            {/* Operations for Agent */}
                            {contentFields?.operationsForAgent?.trim() && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span>⚡</span>
                                        <h5 className="font-medium text-sm">Operations for Agent</h5>
                                    </div>
                                    <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                                        {contentFields.operationsForAgent}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-muted border rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Badge variant="secondary" className="text-xs">AI Agent View</Badge>
                                </div>
                                <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                                    {renderedTemplate}
                                </pre>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This is how the step content will appear to AI agents using the walkthrough tools.
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}