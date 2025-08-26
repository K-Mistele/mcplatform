'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserAvatar } from '@/components/user-avatar'
import {
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconDotsVertical,
    IconLayoutColumns,
    IconEdit,
    IconUserMinus
} from '@tabler/icons-react'
import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
    type VisibilityState
} from '@tanstack/react-table'
import * as React from 'react'

interface OrganizationMember {
    id: string
    userId: string
    role: 'owner' | 'admin' | 'member'
    createdAt: Date
    name: string
    email: string
    image?: string | null
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
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

const columns: ColumnDef<OrganizationMember>[] = [
    {
        accessorKey: 'name',
        header: 'Member',
        cell: ({ row }) => {
            const member = row.original
            return (
                <div className="flex items-center gap-3">
                    <UserAvatar
                        image={member.image}
                        fallbackValue={member.email}
                        name={member.name}
                        size="32px"
                        className="h-8 w-8 rounded-full"
                    />
                    <div className="flex flex-col">
                        <span className="font-medium">{member.name}</span>
                        <span className="text-sm text-muted-foreground">{member.email}</span>
                    </div>
                </div>
            )
        },
        enableHiding: false,
        filterFn: (row, id, value) => {
            const member = row.original
            const searchValue = value.toLowerCase()
            return (
                member.name.toLowerCase().includes(searchValue) ||
                member.email.toLowerCase().includes(searchValue)
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
        accessorKey: 'createdAt',
        header: 'Joined',
        cell: ({ row }) => {
            const date = row.getValue('createdAt') as Date
            return <span className="text-muted-foreground text-sm">{formatDate(date)}</span>
        }
    },
    {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
            const member = row.original
            
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
                            <IconEdit className="mr-2 h-4 w-4" />
                            Edit Role
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                            <IconUserMinus className="mr-2 h-4 w-4" />
                            Remove Member
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
        enableSorting: false,
        enableHiding: false
    }
]

interface OrganizationMembersTableProps {
    members: OrganizationMember[]
    currentUserId: string
    onEditRole?: (member: OrganizationMember) => void
    onRemoveMember?: (member: OrganizationMember) => void
    columnVisibility?: VisibilityState
}

export function OrganizationMembersTable({ members, currentUserId, onEditRole, onRemoveMember, columnVisibility = {} }: OrganizationMembersTableProps) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [rowSelection, setRowSelection] = React.useState({})

    // Update actions column to handle callbacks
    const columnsWithActions = React.useMemo(() => {
        return columns.map(col => {
            if (col.id === 'actions') {
                return {
                    ...col,
                    cell: ({ row }: any) => {
                        const member = row.original
                        const isCurrentUser = member.userId === currentUserId
                        
                        return (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <IconDotsVertical className="h-4 w-4" />
                                        <span className="sr-only">Open menu</span>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => onEditRole?.(member)}>
                                        <IconEdit className="mr-2 h-4 w-4" />
                                        Edit Role
                                    </DropdownMenuItem>
                                    {!isCurrentUser && (
                                        <DropdownMenuItem 
                                            className="text-red-600" 
                                            onClick={() => onRemoveMember?.(member)}
                                        >
                                            <IconUserMinus className="mr-2 h-4 w-4" />
                                            Remove Member
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
    }, [currentUserId, onEditRole, onRemoveMember])

    const table = useReactTable({
        data: members,
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
                                    No members found.
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