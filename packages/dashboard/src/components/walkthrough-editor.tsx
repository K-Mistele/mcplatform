'use client'

import type { Walkthrough, WalkthroughStep } from 'database'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { use, useState } from 'react'
import { ContentEditor } from './content-editor'
import { PreviewPanel } from './preview-panel'
import { StepsNavigator } from './steps-navigator'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable'
import { Separator } from './ui/separator'

const walkthroughTypeConfig = {
    course: { icon: '📚', label: 'Course' },
    installer: { icon: '⚙️', label: 'Installer' },
    troubleshooting: { icon: '🔧', label: 'Troubleshooting' },
    integration: { icon: '🔗', label: 'Integration' },
    quickstart: { icon: '⚡', label: 'Quickstart' }
} as const

interface WalkthroughEditorProps {
    walkthroughPromise: Promise<Walkthrough>
    stepsPromise: Promise<WalkthroughStep[]>
    selectedStepId: string | null
}

export function WalkthroughEditor({ walkthroughPromise, stepsPromise, selectedStepId }: WalkthroughEditorProps) {
    const walkthrough = use(walkthroughPromise)
    const steps = use(stepsPromise)
    const router = useRouter()
    const searchParams = useSearchParams()
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'unsaved'>('saved')

    // Determine current step - use selectedStepId from URL or first step
    const currentStep = selectedStepId ? steps.find((step) => step.id === selectedStepId) : steps[0]

    const typeConfig = walkthroughTypeConfig[walkthrough.type!] || {
        icon: '📄',
        label: 'Unknown'
    }

    const handleStepSelect = (stepId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('step', stepId)
        router.push(`?${params.toString()}`)
    }

    const handleSaveStatusChange = (status: 'saved' | 'saving' | 'error' | 'unsaved') => {
        setSaveStatus(status)
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="border-b bg-background px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/dashboard/walkthroughs">
                                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                                Back
                            </Link>
                        </Button>
                        <Separator orientation="vertical" className="h-6" />
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{typeConfig.icon}</span>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-semibold">{walkthrough.title}</h1>
                                    <Badge variant="secondary">{typeConfig.label}</Badge>
                                </div>
                                {walkthrough.description && (
                                    <p className="text-sm text-muted-foreground mt-1">{walkthrough.description}</p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    saveStatus === 'saved'
                                        ? 'bg-green-500'
                                        : saveStatus === 'saving'
                                          ? 'bg-blue-500'
                                          : saveStatus === 'unsaved'
                                            ? 'bg-yellow-500'
                                            : 'bg-red-500'
                                }`}
                            />
                            <span className="text-muted-foreground">
                                {saveStatus === 'saved'
                                    ? 'Saved'
                                    : saveStatus === 'saving'
                                      ? 'Saving...'
                                      : saveStatus === 'unsaved'
                                        ? 'Unsaved changes'
                                        : 'Error saving'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Three-panel resizable layout */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    {/* Steps Navigator */}
                    <ResizablePanel defaultSize={25} minSize={20} className="bg-muted/30">
                        <StepsNavigator
                            walkthrough={walkthrough}
                            steps={steps}
                            currentStepId={currentStep?.id || null}
                            onStepSelect={handleStepSelect}
                        />
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Content Editor */}
                    <ResizablePanel defaultSize={50} minSize={30} className="overflow-hidden">
                        {currentStep ? (
                            <div className="h-full overflow-hidden">
                                <ContentEditor
                                    walkthrough={walkthrough}
                                    step={currentStep}
                                    onSaveStatusChange={handleSaveStatusChange}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center">
                                <div className="text-center">
                                    <h3 className="text-lg font-medium text-foreground mb-2">No steps yet</h3>
                                    <p className="text-muted-foreground mb-4">
                                        Create your first step to start building your walkthrough.
                                    </p>
                                </div>
                            </div>
                        )}
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    {/* Preview Panel */}
                    <ResizablePanel defaultSize={25} minSize={20} className="bg-background">
                        <PreviewPanel walkthrough={walkthrough} step={currentStep!} />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    )
}
