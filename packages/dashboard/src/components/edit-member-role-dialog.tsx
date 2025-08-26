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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateMemberRoleAction } from '@/lib/orpc/actions/organization'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
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

interface EditMemberRoleDialogProps {
    member: OrganizationMember | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onRoleUpdated?: () => void
}

const roleDescriptions = {
    owner: 'Full access to everything including organization settings, billing, and member management. Can delete the organization.',
    admin: 'Can manage members, create MCP servers, and access most organization features. Cannot modify billing or delete the organization.',
    member: 'Basic access to view organization resources. Cannot manage other members or modify organization settings.'
}

export function EditMemberRoleDialog({ member, open, onOpenChange, onRoleUpdated }: EditMemberRoleDialogProps) {
    const [selectedRole, setSelectedRole] = React.useState<'owner' | 'admin' | 'member'>('member')
    const [showOwnerConfirmation, setShowOwnerConfirmation] = React.useState(false)

    const { execute, status: updateStatus } = useServerAction(updateMemberRoleAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Member role updated successfully')
                onOpenChange(false)
                onRoleUpdated?.()
                setShowOwnerConfirmation(false)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update member role')
                }
            })
        ]
    })

    React.useEffect(() => {
        if (member) {
            setSelectedRole(member.role)
        }
    }, [member])

    const handleSubmit = () => {
        if (!member) return

        // Show confirmation for owner role changes
        if (selectedRole === 'owner' && member.role !== 'owner' && !showOwnerConfirmation) {
            setShowOwnerConfirmation(true)
            return
        }

        execute({
            memberId: member.id,
            role: selectedRole
        })
    }

    const handleCancel = () => {
        setShowOwnerConfirmation(false)
        onOpenChange(false)
        if (member) {
            setSelectedRole(member.role)
        }
    }

    if (!member) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Member Role</DialogTitle>
                    <DialogDescription>
                        Change the role for {member.name} ({member.email})
                    </DialogDescription>
                </DialogHeader>

                {showOwnerConfirmation ? (
                    <div className="py-4">
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-4">
                            <h4 className="font-medium text-orange-800 mb-2">⚠️ Promote to Owner</h4>
                            <p className="text-sm text-orange-700">
                                You are about to give {member.name} owner privileges. Owners have full access to the organization including the ability to:
                            </p>
                            <ul className="list-disc list-inside text-sm text-orange-700 mt-2 space-y-1">
                                <li>Manage billing and subscription</li>
                                <li>Delete the organization</li>
                                <li>Promote/demote other owners</li>
                                <li>Access all organization resources</li>
                            </ul>
                            <p className="text-sm text-orange-700 mt-2 font-medium">
                                This action cannot be undone by non-owners.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="role-select" className="text-base font-medium">Select new role</Label>
                            <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
                                <SelectTrigger id="role-select" className="mt-2">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {(['owner', 'admin', 'member'] as const).map((role) => (
                                        <SelectItem key={role} value={role} className="capitalize">
                                            {role}
                                            {member.role === role && (
                                                <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                    Current
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div className="p-4 bg-muted rounded-lg">
                            <h4 className="font-medium mb-2 capitalize">{selectedRole} Role</h4>
                            <p className="text-sm text-muted-foreground">
                                {roleDescriptions[selectedRole]}
                            </p>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={handleCancel} disabled={updateStatus === 'pending'}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={updateStatus === 'pending' || selectedRole === member.role}
                        className={showOwnerConfirmation ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    >
                        {updateStatus === 'pending' ? 'Updating...' : showOwnerConfirmation ? 'Confirm Promotion' : 'Update Role'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}