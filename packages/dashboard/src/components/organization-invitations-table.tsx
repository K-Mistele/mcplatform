'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconDotsVertical,
    IconMail,
    IconX,
    IconClock,
    IconUserCheck
} from '@tabler/icons-react'
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
    type VisibilityState
} from '@tanstack/react-table'
import * as React from 'react'

interface OrganizationInvitation {
    id: string
    email: string
    role: 'owner' | 'admin' | 'member'
    status: string
    expiresAt: Date
    createdAt: Date
    inviterName: string
    inviterEmail: string
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = date.getTime() - now.getTime()
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60))
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMs < 0) return 'Expired'
    if (diffHours < 1) return 'Expires soon'
    if (diffHours < 24) return `${diffHours}h left`
    return `${diffDays}d left`
}

function getRoleBadgeVariant(role: string) {
    switch (role) {
        case 'owner':
            return 'destructive'
        case 'admin':
            return 'default'
        case 'member':
            return 'secondary'
        default:
            return 'secondary'
    }
}

function getStatusBadgeVariant(status: string, expiresAt: Date) {
    const now = new Date()
    const isExpired = now > expiresAt
    
    if (status === 'cancelled') return 'outline'
    if (status === 'accepted') return 'default'
    if (isExpired) return 'destructive'
    return 'secondary'
}

function getStatusText(status: string, expiresAt: Date) {
    const now = new Date()
    const isExpired = now > expiresAt
    
    if (status === 'cancelled') return 'Cancelled'
    if (status === 'accepted') return 'Accepted'
    if (isExpired) return 'Expired'
    return 'Pending'
}

const columns: ColumnDef<OrganizationInvitation>[] = [
    {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ row }) => {
            const invitation = row.original
            return (
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <IconMail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-medium">{invitation.email}</span>
                        <span className="text-sm text-muted-foreground">
                            Invited by {invitation.inviterName}
                        </span>
                    </div>
                </div>
            )
        },
        enableHiding: false,
        filterFn: (row, id, value) => {
            const invitation = row.original
            const searchValue = value.toLowerCase()
            return (
                invitation.email.toLowerCase().includes(searchValue) ||
                invitation.inviterName.toLowerCase().includes(searchValue)
            )
        }
    },
    {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => {
            const role = row.getValue('role') as string
            return (
                <Badge variant={getRoleBadgeVariant(role)}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                </Badge>
            )
        },
        filterFn: (row, id, value) => {
            if (value === 'all') return true
            return row.getValue(id) === value
        }
    },
    {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const invitation = row.original
            const statusText = getStatusText(invitation.status, invitation.expiresAt)
            const variant = getStatusBadgeVariant(invitation.status, invitation.expiresAt)
            
            return (
                <Badge variant={variant}>
                    {statusText}
                </Badge>
            )
        }
    },
    {
        accessorKey: 'createdAt',
        header: 'Invited',
        cell: ({ row }) => {
            const date = row.getValue('createdAt') as Date
            return <span className="text-muted-foreground text-sm">{formatDate(date)}</span>
        }
    },
    {
        accessorKey: 'expiresAt',
        header: 'Expires',
        cell: ({ row }) => {
            const date = row.getValue('expiresAt') as Date
            const relativeTime = formatRelativeTime(date)
            const isExpired = new Date() > date
            
            return (
                <div className="flex items-center gap-2">
                    <IconClock className={`h-4 w-4 ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`} />
                    <span className={`text-sm ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {relativeTime}
                    </span>
                </div>
            )
        }
    },
    {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
            const invitation = row.original
            
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <IconDotsVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                            <IconMail className="mr-2 h-4 w-4" />
                            Resend
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                            <IconX className="mr-2 h-4 w-4" />
                            Cancel
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
        enableSorting: false,
        enableHiding: false
    }
]

interface OrganizationInvitationsTableProps {
    invitations: OrganizationInvitation[]
    onResendInvitation?: (invitation: OrganizationInvitation) => void
    onCancelInvitation?: (invitation: OrganizationInvitation) => void
    columnVisibility?: VisibilityState
}

export function OrganizationInvitationsTable({ 
    invitations, 
    onResendInvitation, 
    onCancelInvitation, 
    columnVisibility = {} 
}: OrganizationInvitationsTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [rowSelection, setRowSelection] = React.useState({})

    // Update actions column to handle callbacks
    const columnsWithActions = React.useMemo(() => {
        return columns.map(col => {
            if (col.id === 'actions') {
                return {
                    ...col,
                    cell: ({ row }: any) => {
                        const invitation = row.original
                        const isExpired = new Date() > invitation.expiresAt
                        const canResend = invitation.status === 'pending'
                        const canCancel = invitation.status === 'pending'
                        
                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <IconDotsVertical className="h-4 w-4" />
                                        <span className="sr-only">Open menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {canResend && (
                                        <DropdownMenuItem 
                                            onClick={() => onResendInvitation?.(invitation)}
                                            disabled={!canResend}
                                        >
                                            <IconMail className="mr-2 h-4 w-4" />
                                            Resend
                                        </DropdownMenuItem>
                                    )}
                                    {canCancel && (
                                        <DropdownMenuItem 
                                            className="text-red-600" 
                                            onClick={() => onCancelInvitation?.(invitation)}
                                            disabled={!canCancel}
                                        >
                                            <IconX className="mr-2 h-4 w-4" />
                                            Cancel
                                        </DropdownMenuItem>
                                    )}
                                    {!canResend && !canCancel && (
                                        <DropdownMenuItem disabled>
                                            No actions available
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )
                    }
                }
            }
            return col
        })
    }, [onResendInvitation, onCancelInvitation])

    const table = useReactTable({
        data: invitations,
        columns: columnsWithActions,
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnVisibility,
            rowSelection
        }
    })

    return (
        <div className="w-full">
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No invitations found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{' '}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex items-center space-x-6 lg:space-x-8">
                    <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium">Rows per page</p>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger className="h-8 w-[70px]">
                                <SelectValue placeholder={table.getState().pagination.pageSize} />
                            </SelectTrigger>
                            <SelectContent side="top">
                                {[10, 20, 30, 40, 50].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to first page</span>
                            <IconChevronsLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <IconChevronLeft />
                        </Button>
                        <Button
                            variant="outline"
                            className="size-8"
                            size="icon"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to next page</span>
                            <IconChevronRight />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden size-8 lg:flex"
                            size="icon"
                            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                            disabled={!table.getCanNextPage()}
                        >
                            <span className="sr-only">Go to last page</span>
                            <IconChevronsRight />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}