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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { inviteUserToOrganizationAction } from '@/lib/orpc/actions/organization'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { IconCheck, IconCopy, IconMail, IconUserPlus } from '@tabler/icons-react'
import * as React from 'react'
import { toast } from 'sonner'

interface InviteMemberDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onInviteSent?: () => void
}

export function InviteMemberDialog({ open, onOpenChange, onInviteSent }: InviteMemberDialogProps) {
    const [email, setEmail] = React.useState('')
    const [role, setRole] = React.useState<'owner' | 'admin' | 'member'>('member')
    const [invitationLink, setInvitationLink] = React.useState<string | null>(null)
    const [linkCopied, setLinkCopied] = React.useState(false)

    const { execute: sendInvitation, status: inviteStatus } = useServerAction(inviteUserToOrganizationAction, {
        interceptors: [
            onSuccess((result: any) => {
                toast.success('Invitation sent successfully')
                // Generate invitation link using the returned invitation ID
                setInvitationLink(`${window.location.origin}/accept-invitation/${result.id}`)
                // Don't call onInviteSent here to prevent auto-closing
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to send invitation')
                }
            })
        ]
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!email.trim()) {
            toast.error('Please enter an email address')
            return
        }

        sendInvitation({
            email: email.trim(),
            role
        })
    }

    const handleCopyLink = async () => {
        if (!invitationLink) return
        
        try {
            await navigator.clipboard.writeText(invitationLink)
            setLinkCopied(true)
            toast.success('Invitation link copied to clipboard')
            setTimeout(() => setLinkCopied(false), 2000)
        } catch (err) {
            toast.error('Failed to copy link')
        }
    }

    const handleClose = () => {
        setEmail('')
        setRole('member')
        setInvitationLink(null)
        setLinkCopied(false)
        onOpenChange(false)
    }

    const handleNewInvitation = () => {
        setEmail('')
        setInvitationLink(null)
        setLinkCopied(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconUserPlus className="h-5 w-5" />
                        Invite Team Member
                    </DialogTitle>
                    <DialogDescription>
                        {invitationLink 
                            ? 'Invitation sent! You can copy the link below or send another invitation.'
                            : 'Send an invitation to add a new member to your organization.'
                        }
                    </DialogDescription>
                </DialogHeader>

                {invitationLink ? (
                    <div className="py-4 space-y-4">
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <IconCheck className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-green-800">Invitation Sent</span>
                            </div>
                            <p className="text-sm text-green-700">
                                An invitation has been sent to <strong>{email}</strong> with the role of <strong>{role}</strong>.
                            </p>
                        </div>
                        
                        <div>
                            <Label htmlFor="invitation-link" className="text-sm font-medium">
                                Invitation Link (share manually if needed)
                            </Label>
                            <div className="flex gap-2 mt-1">
                                <Input
                                    id="invitation-link"
                                    value={invitationLink}
                                    readOnly
                                    className="font-mono text-sm"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopyLink}
                                    className="shrink-0"
                                >
                                    {linkCopied ? (
                                        <IconCheck className="h-4 w-4" />
                                    ) : (
                                        <IconCopy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="email" className="text-sm font-medium">
                                Email Address
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="colleague@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1"
                                disabled={inviteStatus === 'pending'}
                                required
                            />
                        </div>
                        
                        <div>
                            <Label htmlFor="role" className="text-sm font-medium">
                                Role
                            </Label>
                            <Select value={role} onValueChange={(value: any) => setRole(value)} disabled={inviteStatus === 'pending'}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">Member - Basic access</SelectItem>
                                    <SelectItem value="admin">Admin - Can manage members</SelectItem>
                                    <SelectItem value="owner">Owner - Full access</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                {role === 'owner' && 'Full access to everything including billing and organization deletion.'}
                                {role === 'admin' && 'Can manage members and organization settings, but not billing.'}
                                {role === 'member' && 'Basic access to view organization resources.'}
                            </p>
                        </div>
                    </form>
                )}

                <DialogFooter>
                    {invitationLink ? (
                        <div className="flex gap-2 w-full">
                            <Button variant="outline" onClick={handleNewInvitation} className="flex-1">
                                <IconUserPlus className="mr-2 h-4 w-4" />
                                Invite Another
                            </Button>
                            <Button onClick={() => {
                                onInviteSent?.()
                                handleClose()
                            }} className="flex-1">
                                Done
                            </Button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={handleClose} 
                                disabled={inviteStatus === 'pending'}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                onClick={handleSubmit}
                                disabled={inviteStatus === 'pending' || !email.trim()}
                            >
                                {inviteStatus === 'pending' ? (
                                    'Sending...'
                                ) : (
                                    <>
                                        <IconMail className="mr-2 h-4 w-4" />
                                        Send Invitation
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}