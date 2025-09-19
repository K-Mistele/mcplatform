'use client'

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconLoader2, IconAlertTriangle } from '@tabler/icons-react'
import { useServerAction } from '@orpc/react/hooks'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { deleteOAuthConfigAction } from '@/lib/orpc/actions/oauth-configs'
import { toast } from 'sonner'

interface OAuthConfig {
    id: string
    name: string
    metadataUrl: string
    authorizationUrl: string
    clientId: string
    scopes: string
    createdAt: number | null
    usageCount: number
}

interface DeleteOAuthConfigDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    config: OAuthConfig
}

export function DeleteOAuthConfigDialog({ open, onOpenChange, config }: DeleteOAuthConfigDialogProps) {
    const { execute: deleteConfig, status } = useServerAction(deleteOAuthConfigAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('OAuth configuration deleted successfully')
                onOpenChange(false)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    if (error.message.includes('in use')) {
                        toast.error('Cannot delete configuration that is in use by MCP servers')
                    } else {
                        toast.error(error.message)
                    }
                } else {
                    toast.error('Failed to delete OAuth configuration')
                }
            })
        ]
    })

    const handleDelete = () => {
        deleteConfig({ id: config.id })
    }

    const isDeleting = status === 'pending'

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete OAuth Configuration</AlertDialogTitle>
                    <AlertDialogDescription>
                        Are you sure you want to delete the OAuth configuration "{config.name}"?
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {config.usageCount > 0 && (
                    <Alert variant="destructive">
                        <IconAlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                            This configuration is currently used by {config.usageCount} MCP server{config.usageCount > 1 ? 's' : ''}. 
                            You must remove it from all servers before you can delete it.
                        </AlertDescription>
                    </Alert>
                )}

                <div className="space-y-2 text-sm text-muted-foreground">
                    <p><strong>Client ID:</strong> {config.clientId}</p>
                    <p><strong>OAuth Server:</strong> {config.metadataUrl}</p>
                </div>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleDelete}
                        disabled={isDeleting || config.usageCount > 0}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? (
                            <>
                                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                            </>
                        ) : (
                            'Delete Configuration'
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}