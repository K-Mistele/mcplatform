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
import { removeMemberFromOrganizationAction } from '@/lib/orpc/actions/organization'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { IconAlertTriangle, IconUserMinus } from '@tabler/icons-react'
import * as React from 'react'
import { toast } from 'sonner'

interface OrganizationMember {
    id: string
    userId: string
    role: 'owner' | 'admin' | 'member'
    createdAt: Date
    name: string
    email: string
    image?: string | null
}

interface DeleteMemberDialogProps {
    member: OrganizationMember | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onMemberRemoved?: () => void
}

export function DeleteMemberDialog({ member, open, onOpenChange, onMemberRemoved }: DeleteMemberDialogProps) {
    const [confirmationEmail, setConfirmationEmail] = React.useState('')

    const { execute: removeMember, status: removeStatus } = useServerAction(removeMemberFromOrganizationAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Member removed successfully')
                onOpenChange(false)
                onMemberRemoved?.()
                setConfirmationEmail('')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to remove member')
                }
            })
        ]
    })

    React.useEffect(() => {
        if (!open) {
            setConfirmationEmail('')
        }
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!member) return
        
        if (confirmationEmail.toLowerCase() !== member.email.toLowerCase()) {
            toast.error('Email confirmation does not match')
            return
        }

        removeMember({
            memberId: member.id
        })
    }

    const handleCancel = () => {
        setConfirmationEmail('')
        onOpenChange(false)
    }

    if (!member) return null

    const isConfirmationValid = confirmationEmail.toLowerCase() === member.email.toLowerCase()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconUserMinus className="h-5 w-5 text-red-600" />
                        Remove Team Member
                    </DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. The member will lose access immediately.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <IconAlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-red-800 mb-1">
                                    You are about to remove {member.name}
                                </h4>
                                <div className="text-sm text-red-700 space-y-1">
                                    <p><strong>Email:</strong> {member.email}</p>
                                    <p><strong>Role:</strong> {member.role.charAt(0).toUpperCase() + member.role.slice(1)}</p>
                                </div>
                                <div className="mt-3 space-y-2">
                                    <p className="text-sm text-red-700">
                                        <strong>This will immediately:</strong>
                                    </p>
                                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-2">
                                        <li>Revoke all active sessions</li>
                                        <li>Remove access to all organization resources</li>
                                        <li>Remove the member from all projects</li>
                                        <li>Cancel any pending invitations</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="confirmation-email" className="text-sm font-medium">
                                Type <strong>{member.email}</strong> to confirm removal
                            </Label>
                            <Input
                                id="confirmation-email"
                                type="email"
                                placeholder={member.email}
                                value={confirmationEmail}
                                onChange={(e) => setConfirmationEmail(e.target.value)}
                                className="mt-1"
                                disabled={removeStatus === 'executing'}
                                autoComplete="off"
                            />
                            {confirmationEmail && !isConfirmationValid && (
                                <p className="text-sm text-red-600 mt-1">
                                    Email does not match
                                </p>
                            )}
                        </div>
                    </form>
                </div>

                <DialogFooter>
                    <Button 
                        variant="outline" 
                        onClick={handleCancel} 
                        disabled={removeStatus === 'executing'}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={removeStatus === 'executing' || !isConfirmationValid}
                    >
                        {removeStatus === 'executing' ? 'Removing...' : 'Remove Member'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}