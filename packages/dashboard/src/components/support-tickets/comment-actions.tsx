'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { deleteSupportTicketComment } from '@/lib/orpc/actions/support-tickets'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { EditIcon, MoreHorizontalIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { EditCommentDialog } from './edit-comment-dialog'

interface CommentActionsProps {
    activityId: string
    content: string
}

export function CommentActions({ activityId, content }: CommentActionsProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)

    const { execute: deleteComment, status: deleteStatus } = useServerAction(deleteSupportTicketComment, {
        interceptors: [
            onSuccess(() => {
                toast.success('Comment deleted successfully')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to delete comment')
                }
            })
        ]
    })

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
            await deleteComment({ activityId })
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontalIcon className="h-4 w-4" />
                        <span className="sr-only">Open comment menu</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                        <EditIcon className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={handleDelete}
                        disabled={deleteStatus === 'pending'}
                        className="text-destructive focus:text-destructive"
                    >
                        <TrashIcon className="mr-2 h-4 w-4" />
                        {deleteStatus === 'pending' ? 'Deleting...' : 'Delete'}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <EditCommentDialog
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                activityId={activityId}
                initialContent={content}
            />
        </>
    )
}
