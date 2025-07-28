'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { updateSupportTicketStatus } from '@/lib/orpc/actions'
import { onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { useState } from 'react'
import { toast } from 'sonner'
import { Label } from '../ui/label'

interface StatusManagerProps {
    ticketId: string
    currentStatus: string
    onStatusChanged?: () => void
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

export function StatusManager({ ticketId, currentStatus, onStatusChanged }: StatusManagerProps) {
    const [selectedStatus, setSelectedStatus] = useState(currentStatus)
    const [comment, setComment] = useState('')
    const [isDialogOpen, setIsDialogOpen] = useState(false)

    const { execute: updateStatus, status } = useServerAction(updateSupportTicketStatus, {
        interceptors: [
            onSuccess(() => {
                setComment('')
                setSelectedStatus(currentStatus) // Reset to current status
                onStatusChanged?.()
                toast.success('Status updated successfully')
                setIsDialogOpen(false)
            }),
            onError((error) => {
                console.error('Failed to update status:', error)
                toast.error('Failed to update status')
            })
        ]
    })

    const handleStatusUpdate = async () => {
        await updateStatus({
            ticketId,
            status: selectedStatus as any,
            comment: comment.trim() || undefined
        })
    }

    const currentStatusLabel = statusOptions.find((s) => s.value === currentStatus)?.label || currentStatus

    return (
        <div className="flex items-center gap-2">
            <Badge className={getStatusColor(currentStatus)}>{currentStatusLabel}</Badge>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                        Change Status
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Ticket Status</DialogTitle>
                        <DialogDescription>
                            Update the status of this support ticket. You can optionally add a comment to explain the
                            change.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label className="text-sm font-medium mb-2 block">New Status</Label>
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
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

                        <div>
                            <Label className="text-sm font-medium mb-2 block">Comment (optional)</Label>
                            <Textarea
                                placeholder="Add a comment explaining this status change..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                disabled={status === 'pending'}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleStatusUpdate}
                                disabled={selectedStatus === currentStatus || status === 'pending'}
                            >
                                {status === 'pending' ? 'Updating...' : 'Update Status'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
