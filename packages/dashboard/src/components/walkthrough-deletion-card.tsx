'use client'

import { useState } from 'react'
import { Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useServerAction } from '@orpc/react/hooks'
import { onError, onSuccess } from '@orpc/client'
import { toast } from 'sonner'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { deleteWalkthroughAction } from '@/lib/orpc/actions/walkthroughs'
import { isDefinedError } from '@orpc/client'

interface WalkthroughDeletionCardProps {
    walkthroughId: string
    walkthroughTitle: string
}

export function WalkthroughDeletionCard({ walkthroughId, walkthroughTitle }: WalkthroughDeletionCardProps) {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const { execute, status } = useServerAction(deleteWalkthroughAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Walkthrough deleted successfully')
                router.push('/dashboard/walkthroughs')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to delete walkthrough')
                }
            }),
        ],
    })

    const handleDelete = async () => {
        await execute({ walkthroughId })
    }

    return (
        <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-destructive">
                    <Trash2Icon className="h-5 w-5" />
                    Delete Walkthrough
                </CardTitle>
                <CardDescription>
                    Permanently delete this walkthrough and all associated data
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="rounded-lg bg-background p-4 border border-destructive/20">
                    <p className="text-sm font-medium mb-2">⚠️ This action cannot be undone</p>
                    <p className="text-sm text-muted-foreground">
                        All walkthrough steps and user progress data will be permanently deleted.
                    </p>
                </div>
                
                <div className="space-y-2">
                    <p className="text-sm font-medium">Alternative options:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Unlink it from MCP servers to make it unavailable to users</span>
                        </li>
                        <li className="flex items-start">
                            <span className="mr-2">•</span>
                            <span>Mark it as a draft to unpublish it</span>
                        </li>
                    </ul>
                </div>
                
                <AlertDialog open={open} onOpenChange={setOpen}>
                    <AlertDialogTrigger asChild>
                        <Button 
                            variant="destructive" 
                            disabled={status === 'pending'}
                            className="w-full sm:w-auto"
                        >
                            <Trash2Icon className="h-4 w-4 mr-2" />
                            Delete Walkthrough
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the walkthrough "{walkthroughTitle}", 
                                all of its steps, and all user progress data. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                Yes, delete permanently
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    )
}