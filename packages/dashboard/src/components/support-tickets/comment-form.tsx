'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { addSupportTicketCommentWithStatus } from '@/lib/orpc/actions'
import { onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { useState } from 'react'
import { Label } from '../ui/label'
import { RichTextEditor } from './rich-text-editor'

interface CommentFormProps {
    ticketId: string
    currentStatus: string
    onCommentAdded?: () => void
}

const statusOptions = [
    { value: 'needs_email', label: 'Needs Email', description: 'Waiting for user email' },
    { value: 'pending', label: 'Pending', description: 'Waiting for review' },
    { value: 'in_progress', label: 'In Progress', description: 'Currently being worked on' },
    { value: 'resolved', label: 'Resolved', description: 'Issue has been fixed' },
    { value: 'closed', label: 'Closed', description: 'Ticket is closed' }
]

function getStatusColor(status: string) {
    switch (status) {
        case 'needs_email':
            return 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
        case 'pending':
            return 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
        case 'in_progress':
            return 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
        case 'resolved':
            return 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
        case 'closed':
            return 'bg-slate-600 text-white border-slate-700 hover:bg-slate-700'
        default:
            return 'bg-slate-600 text-white border-slate-700 hover:bg-slate-700'
    }
}

export function CommentForm({ ticketId, currentStatus, onCommentAdded }: CommentFormProps) {
    const [content, setContent] = useState<string>('')
    const [selectedStatus, setSelectedStatus] = useState<string | undefined>(undefined)

    const { execute: submitComment, status } = useServerAction(addSupportTicketCommentWithStatus, {
        interceptors: [
            onSuccess(() => {
                setContent('')
                setSelectedStatus(undefined)
                onCommentAdded?.()
            }),
            onError((error: unknown) => {
                console.error('Failed to add comment:', error)
            })
        ]
    })

    const handleSubmit = async () => {
        if (!content.trim()) return

        await submitComment({
            ticketId,
            content: content.trim(),
            contentType: 'text',
            status: selectedStatus as 'needs_email' | 'pending' | 'in_progress' | 'resolved' | 'closed' | undefined
        })
    }

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            handleSubmit()
        }
    }

    const isStatusChanging = selectedStatus && selectedStatus !== currentStatus

    return (
        <div className="space-y-4 border rounded-lg p-4">
            <div onKeyDown={handleKeyDown}>
                <RichTextEditor
                    placeholder="Add a comment... (Cmd/Ctrl + Enter to submit)"
                    value={content}
                    onChange={setContent}
                    minHeight={100}
                />
            </div>

            <div className="space-y-3">
                <div>
                    <Label className="text-sm font-medium mb-2 block">Change Status (optional)</Label>
                    <Select
                        value={selectedStatus || 'keep_current'}
                        onValueChange={(value) => setSelectedStatus(value === 'keep_current' ? undefined : value)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Keep current status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="keep_current">
                                <span className="text-muted-foreground">Keep current status</span>
                            </SelectItem>
                            {statusOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                        <Badge className={getStatusColor(option.value)}>{option.label}</Badge>
                                        <span className="text-muted-foreground">- {option.description}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {isStatusChanging && (
                    <div className="p-3 border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                            <span>Status will change from</span>
                            <Badge className={getStatusColor(currentStatus)}>
                                {statusOptions.find((s) => s.value === currentStatus)?.label || currentStatus}
                            </Badge>
                            <span>to</span>
                            <Badge className={getStatusColor(selectedStatus)}>
                                {statusOptions.find((s) => s.value === selectedStatus)?.label || selectedStatus}
                            </Badge>
                        </div>
                    </div>
                )}

                <div className="flex justify-end space-x-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            setContent('')
                            setSelectedStatus(undefined)
                        }}
                        disabled={status === 'pending' || (!content.trim() && !selectedStatus)}
                    >
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={status === 'pending' || !content.trim()}>
                        {status === 'pending'
                            ? 'Adding...'
                            : isStatusChanging
                              ? 'Add Comment & Change Status'
                              : 'Add Comment'}
                    </Button>
                </div>
            </div>
        </div>
    )
}
