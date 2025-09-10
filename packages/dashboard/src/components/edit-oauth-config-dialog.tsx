'use client'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { IconLoader2, IconCheck, IconX, IconEye, IconEyeOff } from '@tabler/icons-react'
import { useServerAction } from '@orpc/react/hooks'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { updateOAuthConfigAction, validateOAuthServerAction } from '@/lib/orpc/actions/oauth-configs'
import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

interface OAuthConfig {
    id: string
    name: string
    metadataUrl: string
    authorizationUrl: string
    clientId: string
    createdAt: bigint
    usageCount: number
}

interface EditOAuthConfigDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    config: OAuthConfig
}

export function EditOAuthConfigDialog({ open, onOpenChange, config }: EditOAuthConfigDialogProps) {
    const [name, setName] = useState(config.name)
    const [metadataUrl, setMetadataUrl] = useState(config.metadataUrl)
    const [clientId, setClientId] = useState(config.clientId)
    const [clientSecret, setClientSecret] = useState('')
    const [showClientSecret, setShowClientSecret] = useState(false)
    const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('valid')
    const [validationError, setValidationError] = useState<string | null>(null)
    
    const validationTimeoutRef = useRef<NodeJS.Timeout>()
    const previousUrlRef = useRef(config.metadataUrl)

    const { execute: validateServer } = useServerAction(validateOAuthServerAction, {
        interceptors: [
            onSuccess(() => {
                setValidationStatus('valid')
                setValidationError(null)
            }),
            onError((error) => {
                setValidationStatus('invalid')
                if (isDefinedError(error)) {
                    setValidationError(error.message)
                } else {
                    setValidationError('Failed to validate OAuth server')
                }
            })
        ]
    })

    const { execute: updateConfig, status: updateStatus } = useServerAction(updateOAuthConfigAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('OAuth configuration updated successfully')
                onOpenChange(false)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update OAuth configuration')
                }
            })
        ]
    })

    // Reset form when config changes
    useEffect(() => {
        setName(config.name)
        setMetadataUrl(config.metadataUrl)
        setClientId(config.clientId)
        setClientSecret('')
        setShowClientSecret(false)
        setValidationStatus('valid')
        setValidationError(null)
        previousUrlRef.current = config.metadataUrl
    }, [config])

    // Debounced validation when metadata URL changes
    useEffect(() => {
        // Skip validation if URL hasn't changed from original
        if (metadataUrl === previousUrlRef.current) {
            setValidationStatus('valid')
            return
        }

        if (metadataUrl.trim() === '') {
            setValidationStatus('idle')
            setValidationError(null)
            return
        }

        // Clear existing timeout
        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current)
        }

        // Set validating status
        setValidationStatus('validating')

        // Debounce validation by 2 seconds
        validationTimeoutRef.current = setTimeout(() => {
            validateServer({ metadataUrl })
        }, 2000)

        return () => {
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current)
            }
        }
    }, [metadataUrl, validateServer])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        
        if (metadataUrl !== config.metadataUrl && validationStatus !== 'valid') {
            toast.error('Please enter a valid OAuth server URL')
            return
        }

        // Only include changed fields
        const updates: any = { id: config.id }
        if (name !== config.name) updates.name = name
        if (metadataUrl !== config.metadataUrl) updates.metadataUrl = metadataUrl
        if (clientId !== config.clientId) updates.clientId = clientId
        if (clientSecret) updates.clientSecret = clientSecret

        // Check if any field actually changed
        if (Object.keys(updates).length === 1) {
            toast.info('No changes to save')
            return
        }

        updateConfig(updates)
    }

    const isSubmitting = updateStatus === 'pending'
    const hasChanges = name !== config.name || 
                      metadataUrl !== config.metadataUrl || 
                      clientId !== config.clientId || 
                      clientSecret !== ''

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Edit OAuth Configuration</DialogTitle>
                        <DialogDescription>
                            Update the OAuth server configuration settings.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Configuration Name</Label>
                            <Input
                                id="edit-name"
                                placeholder="e.g., GitHub OAuth"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-metadataUrl">OAuth Server URL</Label>
                            <div className="relative">
                                <Input
                                    id="edit-metadataUrl"
                                    type="url"
                                    placeholder="https://oauth.example.com"
                                    value={metadataUrl}
                                    onChange={(e) => setMetadataUrl(e.target.value)}
                                    required
                                    disabled={isSubmitting}
                                    className={validationStatus === 'invalid' ? 'pr-8 border-red-500' : 'pr-8'}
                                />
                                <div className="absolute right-2 top-2.5">
                                    {validationStatus === 'validating' && (
                                        <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                    {validationStatus === 'valid' && (
                                        <IconCheck className="h-4 w-4 text-green-500" />
                                    )}
                                    {validationStatus === 'invalid' && (
                                        <IconX className="h-4 w-4 text-red-500" />
                                    )}
                                </div>
                            </div>
                            {validationError && (
                                <Alert variant="destructive" className="mt-2">
                                    <AlertDescription className="text-xs">
                                        {validationError}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-clientId">Client ID</Label>
                            <Input
                                id="edit-clientId"
                                placeholder="Your OAuth client ID"
                                value={clientId}
                                onChange={(e) => setClientId(e.target.value)}
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="edit-clientSecret">Client Secret</Label>
                            <div className="relative">
                                <Input
                                    id="edit-clientSecret"
                                    type={showClientSecret ? 'text' : 'password'}
                                    placeholder="Leave blank to keep current secret"
                                    value={clientSecret}
                                    onChange={(e) => setClientSecret(e.target.value)}
                                    disabled={isSubmitting}
                                    className="pr-10"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowClientSecret(!showClientSecret)}
                                >
                                    {showClientSecret ? (
                                        <IconEyeOff className="h-4 w-4" />
                                    ) : (
                                        <IconEye className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Only enter a new secret if you want to change it.
                            </p>
                        </div>

                        {config.usageCount > 0 && (
                            <Alert>
                                <AlertDescription className="text-xs">
                                    This configuration is currently used by {config.usageCount} MCP server{config.usageCount > 1 ? 's' : ''}. 
                                    Changes will affect all connected servers.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting || !hasChanges || (metadataUrl !== config.metadataUrl && validationStatus !== 'valid')}
                        >
                            {isSubmitting ? (
                                <>
                                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}