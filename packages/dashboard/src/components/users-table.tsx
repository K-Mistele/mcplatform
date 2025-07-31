'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { UserAvatar } from '@/components/user-avatar'
import { deleteMcpUsersAction } from '@/lib/orpc/actions/mcp-servers'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import {
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconLayoutColumns,
    IconTrash
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
import { ServerIcon } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'
import { toast } from 'sonner'

interface ConnectedServer {
    distinctId: string
    serverName: string
    serverSlug: string
    firstSeenAt: number | null
}

interface UserWithServers {
    id: string
    distinctId: string
    name: string
    email: string
    image?: string | null
    createdAt: Date
    lifetimeSupportTickets: number
    openSupportTickets: number
    connectedServers: ConnectedServer[]
}

function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

function formatTimestamp(timestamp: number | null): string {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

const columns: ColumnDef<UserWithServers>[] = [
    {
        id: 'select',
        header: ({ table }) => (
            <div className="flex items-center justify-center">
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            </div>
        ),
        cell: ({ row }) => (
            <div className="flex items-center justify-center">
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            </div>
        ),
        enableSorting: false,
        enableHiding: false
    },
    {
        accessorKey: 'name',
        header: 'MCP User',
        cell: ({ row }) => {
            const user = row.original
            return (
                <div className="flex items-center gap-3">
                    <UserAvatar
                        image={user.image}
                        fallbackValue={user.distinctId}
                        name={user.name}
                        size="32px"
                        className="h-8 w-8 rounded-full"
                    />
                    <div className="flex flex-col">
                        <Link
                            href={`/dashboard/users/${encodeURIComponent(user.distinctId)}`}
                            className="font-medium hover:underline"
                        >
                            {user.name}
                        </Link>
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                        <span className="text-xs text-muted-foreground">ID: {user.distinctId}</span>
                    </div>
                </div>
            )
        },
        enableHiding: false,
        filterFn: (row, id, value) => {
            const user = row.original
            const searchValue = value.toLowerCase()
            return (
                user.name.toLowerCase().includes(searchValue) ||
                user.email.toLowerCase().includes(searchValue) ||
                user.distinctId.toLowerCase().includes(searchValue)
            )
        }
    },
    {
        accessorKey: 'lifetimeSupportTickets',
        header: 'Lifetime Support Tickets',
        cell: ({ row }) => {
            const tickets = row.getValue('lifetimeSupportTickets') as number
            return <Badge variant="outline">{tickets}</Badge>
        }
    },
    {
        accessorKey: 'openSupportTickets',
        header: 'Open Support Tickets',
        cell: ({ row }) => {
            const tickets = row.getValue('openSupportTickets') as number
            return <Badge variant="outline">{tickets}</Badge>
        }
    },
    {
        accessorKey: 'connectedServers',
        header: 'Connected Servers',
        cell: ({ row }) => {
            const servers = row.getValue('connectedServers') as ConnectedServer[]

            if (servers.length === 0) {
                return <span className="text-muted-foreground">No servers connected</span>
            }

            return (
                <div className="flex flex-wrap gap-1">
                    {servers.map((server) => (
                        <Badge key={server.serverSlug} variant="secondary" className="flex items-center gap-1">
                            <ServerIcon className="h-3 w-3" />
                            {server.serverSlug}
                        </Badge>
                    ))}
                </div>
            )
        },
        filterFn: (row, id, value) => {
            const servers = row.getValue(id) as ConnectedServer[]
            return servers.some(
                (server) =>
                    server.serverName.toLowerCase().includes(value.toLowerCase()) ||
                    server.serverSlug.toLowerCase().includes(value.toLowerCase())
            )
        }
    },
    {
        accessorKey: 'createdAt',
        header: 'First Seen',
        cell: ({ row }) => {
            const date = row.getValue('createdAt') as Date
            return <span className="text-muted-foreground text-sm">{formatDate(date)}</span>
        }
    }
]

interface UsersTableProps {
    data: UserWithServers[]
}

export function UsersTable({ data }: UsersTableProps) {
    const [rowSelection, setRowSelection] = React.useState({})
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [pagination, setPagination] = React.useState({
        pageIndex: 0,
        pageSize: 10
    })

    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            columnFilters,
            pagination
        },
        getRowId: (row) => row.id,
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel()
    })

    // Set up delete action
    const { execute: deleteUsers, status: deleteStatus } = useServerAction(deleteMcpUsersAction, {
        interceptors: [
            onSuccess((result: { deletedCount: number; deletedUserIds: (string | null)[] }) => {
                toast.success(`Successfully deleted ${result.deletedCount} user(s)`)
                setRowSelection({}) // Clear selection after successful delete
            }),
            onError((error: any) => {
                if (isDefinedError(error)) {
                    toast.error(`Failed to delete users: ${error.message}`)
                } else {
                    toast.error('Failed to delete users')
                }
            })
        ]
    })

    const selectedRows = table.getFilteredSelectedRowModel().rows
    const selectedUserIds = selectedRows.map((row) => row.original.id)

    const handleDeleteSelected = async () => {
        if (selectedUserIds.length === 0) return

        const confirmMessage = `Are you sure you want to delete ${selectedUserIds.length} user(s)? This action cannot be undone.`
        if (!confirm(confirmMessage)) return

        await deleteUsers({ userIds: selectedUserIds })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Search users by name, email, or ID..."
                        value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                        onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
                        className="max-w-sm"
                    />
                    {selectedUserIds.length > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelected}
                            disabled={deleteStatus === 'pending'}
                            className="flex items-center gap-2"
                        >
                            <IconTrash className="h-4 w-4" />
                            {deleteStatus === 'pending' ? 'Deleting...' : `Delete ${selectedUserIds.length} user(s)`}
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <IconLayoutColumns />
                                <span className="hidden lg:inline">Columns</span>
                                <IconChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            {table
                                .getAllColumns()
                                .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
                <Table>
                    <TableHeader className="bg-muted">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} colSpan={header.colSpan}>
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
                                    No users found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between px-4">
                <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
                    {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length}{' '}
                    row(s) selected.
                </div>
                <div className="flex w-full items-center gap-8 lg:w-fit">
                    <div className="hidden items-center gap-2 lg:flex">
                        <Label htmlFor="rows-per-page" className="text-sm font-medium">
                            Rows per page
                        </Label>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger size="sm" className="w-20" id="rows-per-page">
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
                    <div className="flex w-fit items-center justify-center text-sm font-medium">
                        Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </div>
                    <div className="ml-auto flex items-center gap-2 lg:ml-0">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
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
