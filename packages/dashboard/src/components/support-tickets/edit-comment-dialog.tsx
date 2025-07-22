'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { editSupportTicketComment } from '@/lib/orpc/actions'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { useState } from 'react'
import { toast } from 'sonner'
import { RichTextEditor } from './rich-text-editor'

interface EditCommentDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    activityId: string
    initialContent: string
    onCommentEdited?: () => void
}

export function EditCommentDialog({
    open,
    onOpenChange,
    activityId,
    initialContent,
    onCommentEdited
}: EditCommentDialogProps) {
    const [content, setContent] = useState(initialContent)

    const { execute: saveEdit, status } = useServerAction(editSupportTicketComment, {
        interceptors: [
            onSuccess(() => {
                toast.success('Comment updated successfully')
                onCommentEdited?.()
                onOpenChange(false)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update comment')
                }
            })
        ]
    })

    const handleSave = async () => {
        if (!content.trim()) {
            toast.error('Comment cannot be empty')
            return
        }

        await saveEdit({
            activityId,
            content: content.trim(),
            contentType: 'text'
        })
    }

    const handleCancel = () => {
        setContent(initialContent)
        onOpenChange(false)
    }

    // Reset content when dialog opens with new content
    useState(() => {
        if (open) {
            setContent(initialContent)
        }
    })

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Edit Comment</DialogTitle>
                    <DialogDescription>Make changes to your comment. You can use markdown formatting.</DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                    <RichTextEditor
                        value={content}
                        onChange={setContent}
                        placeholder="Enter your comment..."
                        minHeight={150}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={status === 'pending'}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={status === 'pending' || !content.trim()}>
                        {status === 'pending' ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}