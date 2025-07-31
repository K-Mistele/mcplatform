'use client'

import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { GripVertical, MapIcon, ToggleLeft, ToggleRight, Trash2, UsersIcon } from 'lucide-react'
import { use, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
    assignWalkthroughsToServerAction,
    removeWalkthroughAssignmentAction,
    reorderServerWalkthroughsAction,
    updateWalkthroughAssignmentAction
} from '../lib/orpc/actions/walkthrough-assignment'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from './ui/alert-dialog'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { MultiSelect } from './ui/multi-select'

interface WalkthroughOption {
    id: string
    title: string
    type: string
    stepCount: number
}

interface AssignedWalkthrough extends WalkthroughOption {
    displayOrder: number
    isEnabled: string // 'true' | 'false'
}

interface WalkthroughAssignmentCardProps {
    serverId: string
    availableWalkthroughsPromise: Promise<WalkthroughOption[]>
    assignedWalkthroughsPromise: Promise<AssignedWalkthrough[]>
}

function SortableWalkthrough({
    walkthrough,
    onToggle,
    onDelete
}: {
    walkthrough: AssignedWalkthrough
    onToggle: () => void
    onDelete: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: walkthrough.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    }

    return (
        <div ref={setNodeRef} style={style} className="flex items-center justify-between p-3 bg-card border rounded-lg">
            <div className="flex items-center gap-3">
                <button
                    className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
                <div>
                    <h4 className="font-medium">{walkthrough.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                            {walkthrough.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{walkthrough.stepCount} steps</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0">
                    {walkthrough.isEnabled === 'true' ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                </Button>
                <Button variant="ghost" size="sm" onClick={onDelete} className="h-8 w-8 p-0 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

export function WalkthroughAssignmentCard({
    serverId,
    availableWalkthroughsPromise,
    assignedWalkthroughsPromise
}: WalkthroughAssignmentCardProps) {
    const availableWalkthroughs = use(availableWalkthroughsPromise)
    const initialAssignedWalkthroughs = use(assignedWalkthroughsPromise)

    const [assignedWalkthroughs, setAssignedWalkthroughs] = useState<AssignedWalkthrough[]>(initialAssignedWalkthroughs)
    const [selectedWalkthroughIds, setSelectedWalkthroughIds] = useState<string[]>(
        initialAssignedWalkthroughs.map((w) => w.id)
    )
    const [deleteWalkthroughId, setDeleteWalkthroughId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    )

    const { execute: assignWalkthroughs, status: assignStatus } = useServerAction(assignWalkthroughsToServerAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Walkthroughs assigned successfully')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to assign walkthroughs')
                }
            })
        ]
    })

    const { execute: updateAssignment } = useServerAction(updateWalkthroughAssignmentAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Walkthrough updated')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update walkthrough')
                }
            })
        ]
    })

    const { execute: removeAssignment } = useServerAction(removeWalkthroughAssignmentAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Walkthrough removed')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to remove walkthrough')
                }
            })
        ]
    })

    const { execute: reorderWalkthroughs } = useServerAction(reorderServerWalkthroughsAction, {
        interceptors: [
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to reorder walkthroughs')
                }
            })
        ]
    })

    useEffect(() => {
        if (
            selectedWalkthroughIds.length === assignedWalkthroughs.length &&
            selectedWalkthroughIds.every((id) => assignedWalkthroughs.some((w) => w.id === id))
        ) {
            return
        }

        const newAssignments = selectedWalkthroughIds
            .map((id, index) => {
                const existing = assignedWalkthroughs.find((w) => w.id === id)
                if (existing) {
                    return existing
                }
                const available = availableWalkthroughs.find((w) => w.id === id)
                if (!available) return null
                return {
                    ...available,
                    displayOrder: index,
                    isEnabled: 'true' as const
                }
            })
            .filter((w): w is AssignedWalkthrough => w !== null)

        setAssignedWalkthroughs(newAssignments)

        assignWalkthroughs({
            serverId,
            walkthroughIds: selectedWalkthroughIds.map((walkthroughId, index) => ({
                walkthroughId,
                displayOrder: index
            }))
        })
    }, [selectedWalkthroughIds])

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const oldIndex = assignedWalkthroughs.findIndex((w) => w.id === active.id)
            const newIndex = assignedWalkthroughs.findIndex((w) => w.id === over.id)

            const newWalkthroughs = arrayMove(assignedWalkthroughs, oldIndex, newIndex)
            setAssignedWalkthroughs(newWalkthroughs)

            reorderWalkthroughs({
                serverId,
                walkthroughIds: newWalkthroughs.map((w) => w.id)
            })
        }
    }

    const handleToggle = async (walkthroughId: string) => {
        const walkthrough = assignedWalkthroughs.find((w) => w.id === walkthroughId)
        if (!walkthrough) return

        const newIsEnabled = walkthrough.isEnabled === 'true' ? 'false' : 'true'

        setAssignedWalkthroughs((prev) =>
            prev.map((w) => (w.id === walkthroughId ? { ...w, isEnabled: newIsEnabled } : w))
        )

        await updateAssignment({
            serverId,
            walkthroughId,
            isEnabled: newIsEnabled === 'true'
        })
    }

    const handleDelete = async () => {
        if (!deleteWalkthroughId) return

        setAssignedWalkthroughs((prev) => prev.filter((w) => w.id !== deleteWalkthroughId))
        setSelectedWalkthroughIds((prev) => prev.filter((id) => id !== deleteWalkthroughId))

        await removeAssignment({
            serverId,
            walkthroughId: deleteWalkthroughId
        })

        setDeleteWalkthroughId(null)
    }

    const multiSelectOptions = availableWalkthroughs.map((w) => ({
        label: `${w.title} (${w.stepCount} steps)`,
        value: w.id,
        icon: MapIcon
    }))

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapIcon className="h-5 w-5" />
                        Assigned Walkthroughs
                    </CardTitle>
                    <CardDescription>Manage interactive walkthroughs for this server</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="text-sm font-medium mb-2 block">Select Walkthroughs</label>
                        <MultiSelect
                            options={multiSelectOptions}
                            onValueChange={setSelectedWalkthroughIds}
                            defaultValue={selectedWalkthroughIds}
                            placeholder="Choose walkthroughs to assign..."
                            className="w-full"
                        />
                    </div>

                    {assignedWalkthroughs.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Drag to reorder, toggle to enable/disable</p>
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                <SortableContext
                                    items={assignedWalkthroughs.map((w) => w.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <div className="space-y-2">
                                        {assignedWalkthroughs.map((walkthrough) => (
                                            <SortableWalkthrough
                                                key={walkthrough.id}
                                                walkthrough={walkthrough}
                                                onToggle={() => handleToggle(walkthrough.id)}
                                                onDelete={() => setDeleteWalkthroughId(walkthrough.id)}
                                            />
                                        ))}
                                    </div>
                                </SortableContext>
                            </DndContext>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">No walkthroughs assigned</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                Select walkthroughs from the dropdown above to get started
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog open={!!deleteWalkthroughId} onOpenChange={(open) => !open && setDeleteWalkthroughId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove walkthrough?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the walkthrough from this server. The walkthrough itself will not be
                            deleted and can be reassigned later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
