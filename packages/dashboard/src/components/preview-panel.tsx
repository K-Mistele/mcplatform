'use client'

import { MarkdownRenderer } from '@/components/support-tickets/markdown-renderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import useLocalStorage from '@/hooks/use-local-storage'
import { renderWalkthroughStep } from '@/lib/template-engine'
import type { Walkthrough, WalkthroughStep } from 'database'
import { EyeIcon } from 'lucide-react'

interface PreviewPanelProps {
    walkthrough: Walkthrough
    step: WalkthroughStep | null
}

type PreviewMode = 'raw' | 'rendered'

export function PreviewPanel({ walkthrough, step }: PreviewPanelProps) {
    const [previewMode, setPreviewMode] = useLocalStorage<PreviewMode>('walkthrough-preview-mode', 'raw')

    if (!step) {
        return (
            <div className="h-full flex items-center justify-center p-6">
                <div className="text-center">
                    <EyeIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">Select a step to preview</h3>
                    <p className="text-muted-foreground">Choose a step from the navigator to see the preview</p>
                </div>
            </div>
        )
    }

    const renderedTemplate = renderWalkthroughStep(walkthrough, step)

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Preview</h3>
                    <div className="flex rounded-md border">
                        <Button
                            variant={previewMode === 'raw' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPreviewMode('raw')}
                            className="rounded-r-none border-r"
                        >
                            Raw Template
                        </Button>
                        <Button
                            variant={previewMode === 'rendered' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setPreviewMode('rendered')}
                            className="rounded-l-none"
                        >
                            Rich Preview
                        </Button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    {previewMode === 'raw' ? 'Raw template output for AI agent' : 'Rendered markdown preview'}
                </p>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-4">
                    {previewMode === 'raw' ? (
                        <div className="space-y-4">
                            <div className="bg-muted border rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <Badge variant="secondary" className="text-xs">
                                        Raw Template
                                    </Badge>
                                </div>
                                <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed overflow-x-auto">
                                    {renderedTemplate}
                                </pre>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This is the raw template that will be sent to AI agents.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-background border rounded-lg p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Badge variant="secondary" className="text-xs">
                                        Rendered Preview
                                    </Badge>
                                </div>
                                <MarkdownRenderer content={renderedTemplate} className="max-w-none" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This is how the content appears when rendered as rich text.
                            </p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
