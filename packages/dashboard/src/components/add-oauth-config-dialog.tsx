'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createOAuthConfigAction, validateOAuthServerAction } from '@/lib/orpc/actions/oauth-configs'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { IconCheck, IconEye, IconEyeOff, IconLoader2, IconX } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface AddOAuthConfigDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AddOAuthConfigDialog({ open, onOpenChange }: AddOAuthConfigDialogProps) {
    const [name, setName] = useState('')
    const [metadataUrl, setMetadataUrl] = useState('')
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [showClientSecret, setShowClientSecret] = useState(false)
    const [validationStatus, setValidationStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')
    const [validationError, setValidationError] = useState<string | null>(null)
    const [showCredentialFields, setShowCredentialFields] = useState(false)
    const [redirectUrl, setRedirectUrl] = useState<string>('')

    const validationTimeoutRef = useRef<NodeJS.Timeout>(null)

    const { execute: validateServerBase, status: validateStatus } = useServerAction(validateOAuthServerAction, {
        interceptors: [
            onSuccess((data) => {
                setValidationStatus('valid')
                setValidationError(null)
                setShowCredentialFields(true)
            }),
            onError((error) => {
                setValidationStatus('invalid')
                if (isDefinedError(error)) {
                    setValidationError(error.message)
                } else {
                    setValidationError('Failed to validate OAuth server')
                }
                setShowCredentialFields(false)
            })
        ]
    })

    // Memoize the validateServer function to prevent effect re-runs
    const validateServer = useCallback(validateServerBase, [])

    // Set the redirect URL based on window.location.origin
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setRedirectUrl(`${window.location.origin}/oauth/callback`)
        }
    }, [])

    const { execute: createConfig, status: createStatus } = useServerAction(createOAuthConfigAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('OAuth configuration created successfully')
                onOpenChange(false)
                resetForm()
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to create OAuth configuration')
                }
            })
        ]
    })

    // Debounced validation when metadata URL changes
    useEffect(() => {
        if (metadataUrl.trim() === '') {
            setValidationStatus('idle')
            setValidationError(null)
            setShowCredentialFields(false)
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

    const resetForm = () => {
        setName('')
        setMetadataUrl('')
        setClientId('')
        setClientSecret('')
        setShowClientSecret(false)
        setValidationStatus('idle')
        setValidationError(null)
        setShowCredentialFields(false)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (validationStatus !== 'valid') {
            toast.error('Please enter a valid OAuth server URL')
            return
        }
        createConfig({
            name,
            metadataUrl,
            clientId,
            clientSecret
        })
    }

    const isSubmitting = createStatus === 'pending'

    return (
        <Dialog
            open={open}
            onOpenChange={(open) => {
                if (!open) resetForm()
                onOpenChange(open)
            }}
        >
            <DialogContent className="sm:max-w-[500px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add OAuth Configuration</DialogTitle>
                        <DialogDescription>Configure a custom OAuth server for authentication.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Configuration Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g., GitHub OAuth"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                disabled={isSubmitting}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="metadataUrl">OAuth Server URL</Label>
                            <div className="relative">
                                <Input
                                    id="metadataUrl"
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
                                    {validationStatus === 'valid' && <IconCheck className="h-4 w-4 text-green-500" />}
                                    {validationStatus === 'invalid' && <IconX className="h-4 w-4 text-red-500" />}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Enter the base URL of your OAuth server. We'll automatically discover the endpoints.
                            </p>
                            {validationError && (
                                <Alert variant="destructive" className="mt-2">
                                    <AlertDescription className="text-xs">{validationError}</AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Progressive disclosure: Only show credential fields after successful validation */}
                        {showCredentialFields && (
                            <>
                                <div className="grid gap-2">
                                    <Label htmlFor="clientId">Client ID</Label>
                                    <Input
                                        id="clientId"
                                        placeholder="Your OAuth client ID"
                                        value={clientId}
                                        onChange={(e) => setClientId(e.target.value)}
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="clientSecret">Client Secret</Label>
                                    <div className="relative">
                                        <Input
                                            id="clientSecret"
                                            type={showClientSecret ? 'text' : 'password'}
                                            placeholder="Your OAuth client secret"
                                            value={clientSecret}
                                            onChange={(e) => setClientSecret(e.target.value)}
                                            required
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
                                        This will be securely stored and used for token exchange.
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Note about redirect URL */}
                        {showCredentialFields && redirectUrl && (
                            <Alert className="mt-2">
                                <AlertDescription className="text-xs">
                                    <strong>Important:</strong> Add this redirect URL to your OAuth provider's allowed
                                    callbacks:
                                    <br />
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                                        {redirectUrl}
                                    </code>
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
                            disabled={
                                isSubmitting || validationStatus !== 'valid' || !name || !clientId || !clientSecret
                            }
                        >
                            {isSubmitting ? (
                                <>
                                    <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                'Create Configuration'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
