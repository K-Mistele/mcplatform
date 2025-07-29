'use client'

import { useState } from 'react'
import { PlusIcon, GripVerticalIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createWalkthroughStepAction } from '@/lib/orpc/actions'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { toast } from 'sonner'
import type { Walkthrough, WalkthroughStep } from 'database'

interface StepsNavigatorProps {
    walkthrough: Walkthrough
    steps: WalkthroughStep[]
    currentStepId: string | null
    onStepSelect: (stepId: string) => void
}

export function StepsNavigator({
    walkthrough,
    steps,
    currentStepId,
    onStepSelect
}: StepsNavigatorProps) {
    const [isCreatingStep, setIsCreatingStep] = useState(false)

    const { execute: createStep } = useServerAction(createWalkthroughStepAction, {
        interceptors: [
            onSuccess((result) => {
                toast.success('Step created successfully')
                onStepSelect(result.id)
                setIsCreatingStep(false)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to create step')
                }
                setIsCreatingStep(false)
            })
        ]
    })

    const handleCreateStep = () => {
        setIsCreatingStep(true)
        const stepNumber = steps.length + 1
        createStep({
            walkthroughId: walkthrough.id,
            title: `Step ${stepNumber}`
        })
    }

    const getCompletionIndicators = (step: WalkthroughStep) => {
        const contentFields = step.contentFields as any
        const indicators = []

        // Introduction for Agent
        indicators.push({
            icon: '💬',
            filled: !!(contentFields?.introductionForAgent?.trim())
        })

        // Context for Agent
        indicators.push({
            icon: '📝',
            filled: !!(contentFields?.contextForAgent?.trim())
        })

        // Content for User (required)
        indicators.push({
            icon: '🔧',
            filled: !!(contentFields?.contentForUser?.trim()),
            required: true
        })

        // Operations for Agent
        indicators.push({
            icon: '⚡',
            filled: !!(contentFields?.operationsForAgent?.trim())
        })

        return indicators
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Steps</h3>
                    <Badge variant="outline" className="font-mono text-xs">
                        {steps.length}
                    </Badge>
                </div>
                <Button
                    onClick={handleCreateStep}
                    disabled={isCreatingStep}
                    className="w-full"
                    size="sm"
                >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    {isCreatingStep ? 'Creating...' : 'Add Step'}
                </Button>
            </div>

            {/* Steps List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {steps.map((step) => {
                        const isSelected = step.id === currentStepId
                        const indicators = getCompletionIndicators(step)

                        return (
                            <div
                                key={step.id}
                                className={`group relative rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                                    isSelected 
                                        ? 'bg-primary/5 border-primary ring-1 ring-primary/20' 
                                        : 'border-border'
                                }`}
                                onClick={() => onStepSelect(step.id)}
                            >
                                {/* Drag handle - visible on hover */}
                                <div className="opacity-0 group-hover:opacity-100 absolute -left-2 top-1/2 -translate-y-1/2 transition-opacity">
                                    <GripVerticalIcon className="h-4 w-4 text-muted-foreground" />
                                </div>

                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0">
                                        <Badge 
                                            variant={isSelected ? 'default' : 'secondary'}
                                            className="text-xs font-mono"
                                        >
                                            {step.displayOrder}
                                        </Badge>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`font-medium truncate ${
                                            isSelected ? 'text-primary' : 'text-foreground'
                                        }`}>
                                            {step.title}
                                        </h4>
                                        
                                        {/* Completion indicators */}
                                        <div className="flex items-center gap-1 mt-2">
                                            {indicators.map((indicator, index) => (
                                                <span
                                                    key={index}
                                                    className={`text-sm transition-opacity ${
                                                        indicator.filled ? 'opacity-100' : 'opacity-30'
                                                    } ${
                                                        indicator.required && !indicator.filled ? 'opacity-60' : ''
                                                    }`}
                                                    title={
                                                        index === 0 ? 'Introduction for Agent' :
                                                        index === 1 ? 'Context for Agent' :
                                                        index === 2 ? 'Content for User (Required)' :
                                                        'Operations for Agent'
                                                    }
                                                >
                                                    {indicator.icon}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                {steps.length === 0 && (
                    <div className="p-8 text-center">
                        <div className="text-muted-foreground mb-2">📝</div>
                        <p className="text-sm text-muted-foreground">
                            No steps yet. Click "Add Step" to get started.
                        </p>
                    </div>
                )}
            </ScrollArea>
        </div>
    )
}