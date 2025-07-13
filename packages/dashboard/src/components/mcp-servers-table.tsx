'use client'

import {
    IconChevronDown,
    IconChevronLeft,
    IconChevronRight,
    IconChevronsLeft,
    IconChevronsRight,
    IconLayoutColumns,
    IconServer
} from '@tabler/icons-react'
import {
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable
} from '@tanstack/react-table'
import * as React from 'react'

import { AddServerModal } from '@/components/add-server-modal'
import { DeleteServerModal } from '@/components/delete-server-modal'
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
import { CopyIcon, EyeIcon, TrashIcon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface McpServer {
    id: string
    name: string
    slug: string | null
    organizationId: string
    createdAt: number | null
}

function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

const columns: ColumnDef<McpServer>[] = [
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
        header: 'Server Name',
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <IconServer className="size-4 text-muted-foreground" />
                <span className="font-medium">{row.getValue('name')}</span>
            </div>
        ),
        enableHiding: false
    },
    {
        accessorKey: 'id',
        header: 'Server ID',
        cell: ({ row }) => (
            <Badge variant="outline" className="font-mono text-xs">
                {row.getValue('id')}
            </Badge>
        )
    },
    {
        accessorKey: 'slug',
        header: 'Server URL',
        cell: ({ row }) => {
            const slug = row.getValue('slug') as string
            const currentLoc = process.env.NEXT_PUBLIC_BETTER_AUTH_URL
            const proto = currentLoc?.startsWith('https://') ? 'https://' : 'http://'
            const host = currentLoc?.split('://')[1]
            const url = `${proto}${slug}.${host}/mcp`
            return (
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                        {url}
                    </Badge>
                    <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => {
                            navigator.clipboard.writeText(url)
                            toast.success('URL copied to clipboard')
                        }}
                    >
                        <CopyIcon className="h-4 w-4" />
                    </Button>
                </div>
            )
        }
    },
    {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) => (
            <span className="text-muted-foreground text-sm">{formatDate(row.getValue('createdAt'))}</span>
        )
    },
    {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/mcp-servers/${row.original.id}`}>
                        <EyeIcon className="h-4 w-4" />
                        View Details
                    </Link>
                </Button>
                <DeleteServerModal
                    serverId={row.original.id}
                    serverName={row.original.name}
                    trigger={
                        <Button variant="outline" size="sm">
                            <TrashIcon className="h-4 w-4" />
                        </Button>
                    }
                />
            </div>
        )
    }
]

interface McpServersTableProps {
    data: McpServer[]
}

export function McpServersTable({ data }: McpServersTableProps) {
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

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Input
                        placeholder="Search servers..."
                        value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
                        onChange={(event) => table.getColumn('name')?.setFilterValue(event.target.value)}
                        className="max-w-sm"
                    />
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
                    <AddServerModal />
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
                                    No MCP servers found.
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
