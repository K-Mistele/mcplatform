'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { IconUserPlus, IconLayoutColumns, IconChevronDown, IconMail } from '@tabler/icons-react'
import * as React from 'react'
import { InviteMemberDialog } from './invite-member-dialog'
import { OrganizationInvitationsTable } from './organization-invitations-table'
import { resendInvitationAction, cancelInvitationAction } from '@/lib/orpc/actions/organization'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { toast } from 'sonner'
import type { VisibilityState } from '@tanstack/react-table'

interface OrganizationInvitation {
    id: string
    email: string
    role: 'owner' | 'admin' | 'member'
    status: string
    expiresAt: Date
    inviterName: string
    inviterEmail: string
}

interface OrganizationInvitationsClientProps {
    invitations: OrganizationInvitation[]
    currentUserId: string
}

export function OrganizationInvitationsClient({ invitations: rawInvitations, currentUserId }: OrganizationInvitationsClientProps) {
    // Convert timestamps to Date objects
    const invitations = rawInvitations.map(invitation => ({
        ...invitation,
        expiresAt: new Date(invitation.expiresAt)
    }))
    
    const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false)
    
    // Table state management - state persists across revalidatePath
    const [searchValue, setSearchValue] = React.useState('')
    const [roleFilter, setRoleFilter] = React.useState('all') 
    const [statusFilter, setStatusFilter] = React.useState('pending')
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    
    // Server actions
    const { execute: resendInvitation, status: resendStatus } = useServerAction(resendInvitationAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Invitation resent successfully')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to resend invitation')
                }
            })
        ]
    })

    const { execute: cancelInvitation, status: cancelStatus } = useServerAction(cancelInvitationAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Invitation deleted successfully')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to delete invitation')
                }
            })
        ]
    })
    
    // Filter invitations based on search, role, and status
    const filteredInvitations = React.useMemo(() => {
        return invitations.filter(invitation => {
            const matchesSearch = searchValue === '' || 
                invitation.email.toLowerCase().includes(searchValue.toLowerCase()) ||
                invitation.inviterName.toLowerCase().includes(searchValue.toLowerCase())
            
            const matchesRole = roleFilter === 'all' || invitation.role === roleFilter
            
            // Determine actual status including expiration
            const now = new Date()
            const isExpired = now > invitation.expiresAt
            let actualStatus = invitation.status
            if (actualStatus === 'pending' && isExpired) {
                actualStatus = 'expired'
            }
            
            const matchesStatus = statusFilter === 'all' || actualStatus === statusFilter
            
            return matchesSearch && matchesRole && matchesStatus
        })
    }, [invitations, searchValue, roleFilter, statusFilter])

    const handleResendInvitation = (invitation: OrganizationInvitation) => {
        resendInvitation({ invitationId: invitation.id })
    }

    const handleCancelInvitation = (invitation: OrganizationInvitation) => {
        cancelInvitation({ invitationId: invitation.id })
    }

    const handleInviteSent = () => {
        // revalidatePath will handle the UI update automatically
    }

    // Calculate status counts for display
    const statusCounts = React.useMemo(() => {
        const counts = { pending: 0, expired: 0, cancelled: 0, accepted: 0 }
        const now = new Date()
        
        invitations.forEach(invitation => {
            if (invitation.status === 'pending' && now > invitation.expiresAt) {
                counts.expired++
            } else if (invitation.status in counts) {
                counts[invitation.status as keyof typeof counts]++
            }
        })
        
        return counts
    }, [invitations])

    return (
        <div>
            <div className="flex items-center gap-4 mb-6 flex-wrap">
                <span className="text-muted-foreground text-sm">
                    {invitations.length} invitation{invitations.length !== 1 ? 's' : ''}
                    {statusCounts.pending > 0 && (
                        <span className="ml-2 text-blue-600">
                            ({statusCounts.pending} pending)
                        </span>
                    )}
                    {statusCounts.expired > 0 && (
                        <span className="ml-2 text-red-600">
                            ({statusCounts.expired} expired)
                        </span>
                    )}
                </span>
                <span className="text-muted-foreground">•</span>
                <Input
                    placeholder="Search invitations..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="max-w-xs"
                />
                <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Role:</Label>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-28">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="owner">Owner</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Status:</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <IconLayoutColumns className="mr-2 h-4 w-4" />
                                Columns <IconChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuCheckboxItem
                                checked={columnVisibility['role'] !== false}
                                onCheckedChange={(checked) => 
                                    setColumnVisibility(prev => ({ ...prev, role: checked }))
                                }
                            >
                                Role
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={columnVisibility['status'] !== false}
                                onCheckedChange={(checked) => 
                                    setColumnVisibility(prev => ({ ...prev, status: checked }))
                                }
                            >
                                Status
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem
                                checked={columnVisibility['expiresAt'] !== false}
                                onCheckedChange={(checked) => 
                                    setColumnVisibility(prev => ({ ...prev, expiresAt: checked }))
                                }
                            >
                                Expires
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => setInviteDialogOpen(true)} size="sm">
                        <IconUserPlus className="mr-2 h-4 w-4" />
                        Invite Member
                    </Button>
                </div>
            </div>
            
            {invitations.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                    <IconMail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No invitations yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Send invitations to add new members to your organization.
                    </p>
                    <Button onClick={() => setInviteDialogOpen(true)}>
                        <IconUserPlus className="mr-2 h-4 w-4" />
                        Send Your First Invitation
                    </Button>
                </div>
            ) : (
                <OrganizationInvitationsTable 
                    invitations={filteredInvitations}
                    onResendInvitation={handleResendInvitation}
                    onCancelInvitation={handleCancelInvitation}
                    columnVisibility={columnVisibility}
                />
            )}
            
            <InviteMemberDialog
                open={inviteDialogOpen}
                onOpenChange={setInviteDialogOpen}
                onInviteSent={handleInviteSent}
            />
        </div>
    )
}