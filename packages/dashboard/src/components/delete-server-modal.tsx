'use client'

import { AlertTriangleIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'

interface DeleteServerModalProps {
    serverId: string
    serverName: string
    trigger?: React.ReactNode
}

export function DeleteServerModal({ serverId, serverName, trigger }: DeleteServerModalProps) {
    const [open, setOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            // Placeholder for when you implement the actual ORPC action
            console.log('Deleting server:', serverId)
            await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate deletion
            setOpen(false)
        } catch (error) {
            console.error('Failed to delete server:', error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="destructive" size="sm">
                        <TrashIcon />
                        Delete
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangleIcon className="h-5 w-5 text-destructive" />
                        Delete MCP Server
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete the server "{serverName}"? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className="rounded-lg bg-destructive/10 p-3 border border-destructive/20">
                        <p className="text-sm text-destructive">
                            <strong>Warning:</strong> This will permanently delete the server and all associated data.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Delete Server'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
