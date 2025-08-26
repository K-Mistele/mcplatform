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
import { IconUserPlus, IconLayoutColumns, IconChevronDown } from '@tabler/icons-react'
import * as React from 'react'
import { DeleteMemberDialog } from './delete-member-dialog'
import { EditMemberRoleDialog } from './edit-member-role-dialog'
import { InviteMemberDialog } from './invite-member-dialog'
import { OrganizationMembersTable } from './organization-members-table'
import { type VisibilityState } from '@tanstack/react-table'

interface OrganizationMember {
    id: string
    userId: string
    role: 'owner' | 'admin' | 'member'
    createdAt: Date
    name: string
    email: string
    image?: string | null
}

interface OrganizationMembersClientProps {
    members: OrganizationMember[]
    currentUserId: string
}

export function OrganizationMembersClient({ members: rawMembers, currentUserId }: OrganizationMembersClientProps) {
    // Convert timestamps to Date objects
    const members = rawMembers.map(member => ({
        ...member,
        createdAt: new Date(member.createdAt)
    }))
    
    const [editDialogOpen, setEditDialogOpen] = React.useState(false)
    const [memberToEdit, setMemberToEdit] = React.useState<OrganizationMember | null>(null)
    const [inviteDialogOpen, setInviteDialogOpen] = React.useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
    const [memberToDelete, setMemberToDelete] = React.useState<OrganizationMember | null>(null)
    
    // Table state management
    const [searchValue, setSearchValue] = React.useState('')
    const [roleFilter, setRoleFilter] = React.useState('all')
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    
    // Filter members based on search and role
    const filteredMembers = React.useMemo(() => {
        return members.filter(member => {
            const matchesSearch = searchValue === '' || 
                member.name.toLowerCase().includes(searchValue.toLowerCase()) ||
                member.email.toLowerCase().includes(searchValue.toLowerCase())
            
            const matchesRole = roleFilter === 'all' || member.role === roleFilter
            
            return matchesSearch && matchesRole
        })
    }, [members, searchValue, roleFilter])

    const handleEditRole = (member: OrganizationMember) => {
        setMemberToEdit(member)
        setEditDialogOpen(true)
    }

    const handleRemoveMember = (member: OrganizationMember) => {
        // Prevent users from removing themselves
        if (member.userId === currentUserId) {
            return
        }
        setMemberToDelete(member)
        setDeleteDialogOpen(true)
    }

    const handleRoleUpdated = () => {
        // For server actions, the page will automatically revalidate
        // This could trigger a router refresh if needed
        window.location.reload()
    }

    const handleInviteSent = () => {
        // For server actions, the page will automatically revalidate
        // This could trigger a router refresh if needed
        window.location.reload()
    }

    const handleMemberRemoved = () => {
        // For server actions, the page will automatically revalidate
        // This could trigger a router refresh if needed
        window.location.reload()
    }

    return (
        <div>
            <div className="flex items-center gap-4 mb-6 flex-wrap">
                <span className="text-muted-foreground text-sm">
                    {members.length} member{members.length !== 1 ? 's' : ''}
                </span>
                <span className="text-muted-foreground">•</span>
                <Input
                    placeholder="Search members..."
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
                                checked={columnVisibility['createdAt'] !== false}
                                onCheckedChange={(checked) => 
                                    setColumnVisibility(prev => ({ ...prev, createdAt: checked }))
                                }
                            >
                                Joined
                            </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => setInviteDialogOpen(true)} size="sm">
                        <IconUserPlus className="mr-2 h-4 w-4" />
                        Invite Member
                    </Button>
                </div>
            </div>
            
            {members.length === 0 ? (
                <div className="text-center py-12 border rounded-lg">
                    <IconUserPlus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No members yet</h3>
                    <p className="text-muted-foreground mb-4">
                        Invite team members to collaborate on your organization.
                    </p>
                    <Button onClick={() => setInviteDialogOpen(true)}>
                        <IconUserPlus className="mr-2 h-4 w-4" />
                        Invite Your First Member
                    </Button>
                </div>
            ) : (
                <OrganizationMembersTable 
                    members={filteredMembers}
                    currentUserId={currentUserId}
                    onEditRole={handleEditRole}
                    onRemoveMember={handleRemoveMember}
                    columnVisibility={columnVisibility}
                />
            )}
            
            <EditMemberRoleDialog
                member={memberToEdit}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onRoleUpdated={handleRoleUpdated}
            />
            
            <InviteMemberDialog
                open={inviteDialogOpen}
                onOpenChange={setInviteDialogOpen}
                onInviteSent={handleInviteSent}
            />
            
            <DeleteMemberDialog
                member={memberToDelete}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onMemberRemoved={handleMemberRemoved}
            />
        </div>
    )
}