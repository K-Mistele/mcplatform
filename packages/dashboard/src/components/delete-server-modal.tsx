'use client'

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
import { deleteMcpServerAction } from '@/lib/orpc/actions/mcp-servers'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { AlertTriangleIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface DeleteServerModalProps {
    serverId: string
    serverName: string
    trigger?: React.ReactNode
}

export function DeleteServerModal({ serverId, serverName, trigger }: DeleteServerModalProps) {
    const [open, setOpen] = useState(false)

    const { execute, status } = useServerAction(deleteMcpServerAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('MCP server deleted successfully')
                setOpen(false)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to delete MCP server')
                }
            })
        ]
    })

    const handleDelete = () => {
        execute({ serverId })
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
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={status === 'pending'}
                    >
                        Cancel
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleDelete} disabled={status === 'pending'}>
                        {status === 'pending' ? 'Deleting...' : 'Delete Server'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
