'use client'

import { useState } from 'react'
import * as React from 'react'
import { PlusIcon, GripVerticalIcon, MoreVerticalIcon, TrashIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createWalkthroughStepAction, deleteWalkthroughStepAction, reorderWalkthroughStepsAction } from '@/lib/orpc/actions'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { toast } from 'sonner'
import type { Walkthrough, WalkthroughStep } from 'database'
import {
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    type UniqueIdentifier,
    closestCenter,
    useSensor,
    useSensors
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface StepsNavigatorProps {
    walkthrough: Walkthrough
    steps: WalkthroughStep[]
    currentStepId: string | null
    onStepSelect: (stepId: string) => void
}

// Create a separate component for the drag handle
function DragHandle({ id }: { id: string }) {
    const { attributes, listeners } = useSortable({
        id
    })

    return (
        <Button
            {...attributes}
            {...listeners}
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-1 text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm border-0 hover:border cursor-grab active:cursor-grabbing rounded-md transition-all"
        >
            <GripVerticalIcon className="h-5 w-5" />
            <span className="sr-only">Drag to reorder</span>
        </Button>
    )
}

// Create a sortable step item component
function SortableStepItem({
    step,
    isSelected,
    indicators,
    onStepSelect,
    onDeleteStep
}: {
    step: WalkthroughStep
    isSelected: boolean
    indicators: { icon: string; filled: boolean; required?: boolean }[]
    onStepSelect: (stepId: string) => void
    onDeleteStep: (step: WalkthroughStep, event: React.MouseEvent) => void
}) {
    const { transform, transition, setNodeRef, isDragging } = useSortable({
        id: step.id
    })

    return (
        <div
            ref={setNodeRef}
            className={`group relative rounded-lg border p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                isSelected 
                    ? 'bg-primary/5 border-primary ring-1 ring-primary/20' 
                    : 'border-border'
            } ${isDragging ? 'opacity-50 z-10' : ''}`}
            onClick={() => onStepSelect(step.id)}
            style={{
                transform: CSS.Transform.toString(transform),
                transition: transition
            }}
            data-dragging={isDragging}
        >
            {/* Drag handle - visible on hover */}
            <div className="opacity-0 group-hover:opacity-100 absolute -left-1 top-1/2 -translate-y-1/2 transition-opacity duration-200">
                <DragHandle id={step.id} />
            </div>

            {/* Options menu - visible on hover */}
            <div className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreVerticalIcon className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                            onClick={(e) => onDeleteStep(step, e)}
                            className="text-destructive focus:text-destructive"
                        >
                            <TrashIcon className="h-4 w-4 mr-2" />
                            Delete Step
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
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
}

export function StepsNavigator({
    walkthrough,
    steps,
    currentStepId,
    onStepSelect
}: StepsNavigatorProps) {
    const [isCreatingStep, setIsCreatingStep] = useState(false)
    const [localSteps, setLocalSteps] = useState(steps)
    
    // Update local steps when props change
    React.useEffect(() => {
        setLocalSteps(steps)
    }, [steps])

    // Set up drag sensors
    const sensors = useSensors(
        useSensor(MouseSensor, {}),
        useSensor(TouchSensor, {}),
        useSensor(KeyboardSensor, {})
    )

    const stepIds = React.useMemo<UniqueIdentifier[]>(
        () => localSteps.map(step => step.id),
        [localSteps]
    )

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

    const { execute: deleteStep } = useServerAction(deleteWalkthroughStepAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Step deleted successfully')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to delete step')
                }
            })
        ]
    })

    const { execute: reorderSteps } = useServerAction(reorderWalkthroughStepsAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Steps reordered successfully')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to reorder steps')
                }
                // Reset local state on error
                setLocalSteps(steps)
            })
        ]
    })

    const handleCreateStep = () => {
        setIsCreatingStep(true)
        const stepNumber = localSteps.length + 1
        createStep({
            walkthroughId: walkthrough.id,
            title: `Step ${stepNumber}`
        })
    }

    const handleDeleteStep = (step: WalkthroughStep, event: React.MouseEvent) => {
        event.stopPropagation() // Prevent step selection when clicking delete
        
        const isConfirmed = confirm(
            `Are you sure you want to delete "${step.title}"?\n\nThis action cannot be undone.`
        )
        
        if (isConfirmed) {
            deleteStep({ stepId: step.id })
            
            // If we're deleting the currently selected step, select the first available step or null
            if (step.id === currentStepId) {
                const remainingSteps = localSteps.filter(s => s.id !== step.id)
                if (remainingSteps.length > 0) {
                    onStepSelect(remainingSteps[0].id)
                }
            }
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        
        if (active && over && active.id !== over.id) {
            const oldIndex = stepIds.indexOf(active.id)
            const newIndex = stepIds.indexOf(over.id)
            
            // Update local state optimistically
            const newSteps = arrayMove(localSteps, oldIndex, newIndex)
            setLocalSteps(newSteps)
            
            // Send the reorder request to the server
            const newStepIds = newSteps.map(step => step.id)
            reorderSteps({
                walkthroughId: walkthrough.id,
                stepIds: newStepIds
            })
        }
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
                        {localSteps.length}
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
                <DndContext
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={handleDragEnd}
                    sensors={sensors}
                >
                    <div className="p-2 space-y-1">
                        {localSteps.length > 0 ? (
                            <SortableContext items={stepIds} strategy={verticalListSortingStrategy}>
                                {localSteps.map((step) => {
                                    const isSelected = step.id === currentStepId
                                    const indicators = getCompletionIndicators(step)

                                    return (
                                        <SortableStepItem
                                            key={step.id}
                                            step={step}
                                            isSelected={isSelected}
                                            indicators={indicators}
                                            onStepSelect={onStepSelect}
                                            onDeleteStep={handleDeleteStep}
                                        />
                                    )
                                })}
                            </SortableContext>
                        ) : (
                            <div className="p-8 text-center">
                                <div className="text-muted-foreground mb-2">📝</div>
                                <p className="text-sm text-muted-foreground">
                                    No steps yet. Click "Add Step" to get started.
                                </p>
                            </div>
                        )}
                    </div>
                </DndContext>
            </ScrollArea>
        </div>
    )
}