'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { assignSupportTicket } from '@/lib/orpc/actions'
import { onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { use } from 'react'
import { toast } from 'sonner'

interface Member {
    id: string
    name: string | null
    email: string
    image: string | null
}

interface AssignmentWidgetProps {
    ticketId: string
    currentAssigneeId: string | null
    membersPromise: Promise<Member[]>
    onAssignmentChanged?: () => void
}

export function AssignmentWidget({
    ticketId,
    currentAssigneeId,
    membersPromise,
    onAssignmentChanged
}: AssignmentWidgetProps) {
    const members = use(membersPromise)
    const currentAssignee = members.find((m) => m.id === currentAssigneeId)

    const { execute: updateAssignee, status } = useServerAction(assignSupportTicket, {
        interceptors: [
            onSuccess(() => {
                onAssignmentChanged?.()
                toast.success('Assignment updated successfully')
            }),
            onError((error) => {
                console.error('Failed to update assignment:', error)
                toast.error('Failed to update assignment')
            })
        ]
    })

    const handleAssignmentChange = async (assigneeId: string) => {
        await updateAssignee({
            ticketId,
            assigneeId: assigneeId === 'unassigned' ? null : assigneeId
        })
    }

    return (
        <div className="space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Assigned to</div>

            <Select
                value={currentAssigneeId || 'unassigned'}
                onValueChange={handleAssignmentChange}
                disabled={status === 'pending'}
            >
                <SelectTrigger className="w-full h-auto!" size="default">
                    <SelectValue placeholder="Assign to..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="unassigned">
                        <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                <span className="text-xs">?</span>
                            </div>
                            <span>Unassigned</span>
                        </div>
                    </SelectItem>
                    {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={member.image || ''} alt={member.name || ''} />
                                    <AvatarFallback className="text-xs">
                                        {member.name?.[0]?.toUpperCase() || member.email[0].toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col items-start justify-start">
                                    <div className="font-medium">{member.name || 'Unknown'}</div>
                                    <div className="text-xs text-muted-foreground">{member.email}</div>
                                </div>
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
