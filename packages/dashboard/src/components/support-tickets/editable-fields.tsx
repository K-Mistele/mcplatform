'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateSupportTicketFields } from '@/lib/orpc/actions/support-tickets'
import { onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { CheckIcon, EditIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface EditableTitleProps {
    ticketId: string
    initialValue: string | null
    onUpdate?: () => void
}

export function EditableTitle({ ticketId, initialValue, onUpdate }: EditableTitleProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [value, setValue] = useState(initialValue || '')

    const { execute: updateFields, status } = useServerAction(updateSupportTicketFields, {
        interceptors: [
            onSuccess(() => {
                setIsEditing(false)
                onUpdate?.()
                toast.success('Title updated successfully')
            }),
            onError((error) => {
                console.error('Failed to update title:', error)
                toast.error('Failed to update title')
            })
        ]
    })

    const handleSave = async () => {
        if (value.trim() !== initialValue) {
            await updateFields({
                ticketId,
                title: value.trim()
            })
        } else {
            setIsEditing(false)
        }
    }

    const handleCancel = () => {
        setValue(initialValue || '')
        setIsEditing(false)
    }

    if (isEditing) {
        return (
            <div className="flex items-center gap-2">
                <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="flex-1"
                    placeholder="Enter ticket title..."
                    autoFocus
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleSave()
                        } else if (e.key === 'Escape') {
                            handleCancel()
                        }
                    }}
                />
                <Button size="sm" variant="outline" onClick={handleSave} disabled={status === 'pending'}>
                    <CheckIcon className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel} disabled={status === 'pending'}>
                    <XIcon className="h-4 w-4" />
                </Button>
            </div>
        )
    }

    return (
        <div className="group flex items-center gap-2">
            <h1 className="text-3xl font-bold">{value || 'Support Ticket'}</h1>
            <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setIsEditing(true)}
            >
                <EditIcon className="h-4 w-4" />
            </Button>
        </div>
    )
}

interface EditableDescriptionProps {
    ticketId: string
    initialValue: string | null
    onUpdate?: () => void
}

export function EditableDescription({ ticketId, initialValue, onUpdate }: EditableDescriptionProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [value, setValue] = useState(initialValue || '')

    const { execute: updateFields, status } = useServerAction(updateSupportTicketFields, {
        interceptors: [
            onSuccess(() => {
                setIsEditing(false)
                onUpdate?.()
                toast.success('Description updated successfully')
            }),
            onError((error) => {
                console.error('Failed to update description:', error)
                toast.error('Failed to update description')
            })
        ]
    })

    const handleSave = async () => {
        if (value.trim() !== initialValue) {
            await updateFields({
                ticketId,
                conciseSummary: value.trim()
            })
        } else {
            setIsEditing(false)
        }
    }

    const handleCancel = () => {
        setValue(initialValue || '')
        setIsEditing(false)
    }

    if (isEditing) {
        return (
            <div className="space-y-3">
                <Textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Enter problem description..."
                    rows={6}
                    className="w-full"
                />
                <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={handleCancel} disabled={status === 'pending'}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={status === 'pending'}>
                        Save
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="group space-y-2">
            <div className="prose prose-sm max-w-none">
                <p className="text-sm leading-relaxed">{value || 'No summary provided'}</p>
            </div>
            <Button
                size="sm"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setIsEditing(true)}
            >
                <EditIcon className="h-4 w-4 mr-1" />
                Edit
            </Button>
        </div>
    )
}

interface PriorityDisplayProps {
    currentPriority: string | null
}

const priorityOptions = [
    { value: 'low', label: 'Low', color: 'bg-green-100 text-green-800 border-green-300' },
    { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' }
]

export function PriorityDisplay({ currentPriority }: PriorityDisplayProps) {
    const currentPriorityOption = priorityOptions.find((p) => p.value === currentPriority) || priorityOptions[1]

    return (
        <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Priority</div>
            <Badge className={currentPriorityOption.color}>{currentPriorityOption.label}</Badge>
        </div>
    )
}
