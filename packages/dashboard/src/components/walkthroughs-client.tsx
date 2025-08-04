'use client'

import { BookOpenIcon, ChevronDownIcon, ColumnsIcon, PlusIcon, SettingsIcon } from 'lucide-react'
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
import { use, useState } from 'react'

import { CreateWalkthroughModal } from '@/components/create-walkthrough-modal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { PencilIcon } from 'lucide-react'
import Link from 'next/link'
import type { Walkthrough } from 'database'

interface WalkthroughTableData {
    walkthrough: Walkthrough
    stepCount: number
}

const walkthroughTypeConfig = {
    course: { label: 'Course', description: 'Educational content' },
    installer: { label: 'Installer', description: 'Installation guide' },
    troubleshooting: { label: 'Troubleshooting', description: 'Problem solving' },
    integration: { label: 'Integration', description: 'System integration' },
    quickstart: { label: 'Quickstart', description: 'Getting started' }
} as const

function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    })
}

function formatRelativeDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A'
    
    const now = Date.now()
    const diff = now - timestamp
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)} years ago`
}

const columns: ColumnDef<WalkthroughTableData>[] = [
    {
        accessorFn: (row) => row.walkthrough.title,
        id: 'title',
        header: 'Title',
        cell: ({ row }) => {
            const walkthrough = row.original.walkthrough
            return (
                <div className="flex items-center gap-3 min-w-0 max-w-lg">
                    <BookOpenIcon className="size-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                        <Link 
                            href={`/dashboard/walkthroughs/${walkthrough.id}/edit`}
                            className="font-medium hover:underline block truncate"
                        >
                            {walkthrough.title}
                        </Link>
                        {walkthrough.description && (
                            walkthrough.description.length > 50 ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <p className="text-sm text-muted-foreground mt-1 cursor-help">
                                            {walkthrough.description.slice(0, 50)}…
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                        <p>{walkthrough.description}</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <p className="text-sm text-muted-foreground mt-1">
                                    {walkthrough.description}
                                </p>
                            )
                        )}
                    </div>
                </div>
            )
        },
        enableHiding: false
    },
    {
        accessorFn: (row) => row.walkthrough.type,
        id: 'type',
        header: 'Type',
        cell: ({ row }) => {
            const type = row.original.walkthrough.type as keyof typeof walkthroughTypeConfig
            const config = walkthroughTypeConfig[type] || {
                label: 'Unknown',
                description: 'Unknown walkthrough type'
            }
            return (
                <div>
                    <Badge variant="secondary">{config.label}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                </div>
            )
        }
    },
    {
        accessorKey: 'stepCount',
        header: 'Steps',
        cell: ({ row }) => {
            const stepCount = row.getValue('stepCount') as number
            return (
                <Badge variant="outline" className="font-mono">
                    {stepCount} {stepCount === 1 ? 'step' : 'steps'}
                </Badge>
            )
        }
    },
    {
        accessorFn: (row) => row.walkthrough.status,
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
            const status = row.original.walkthrough.status
            return (
                <Badge variant={status === 'published' ? 'default' : 'secondary'}>
                    {status === 'published' ? 'Published' : 'Draft'}
                </Badge>
            )
        }
    },
    {
        accessorFn: (row) => row.walkthrough.createdAt,
        id: 'createdAt',
        header: 'Created',
        cell: ({ row }) => {
            const createdAt = row.original.walkthrough.createdAt
            return (
                <div className="text-sm">
                    <div>{formatRelativeDate(createdAt)}</div>
                    <div className="text-muted-foreground text-xs">{formatDate(createdAt)}</div>
                </div>
            )
        }
    },
    {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
            const walkthrough = row.original.walkthrough
            return (
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/walkthroughs/${walkthrough.id}/edit`}>
                            <PencilIcon className="h-4 w-4 mr-1" />
                            Edit
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/walkthroughs/${walkthrough.id}/settings`}>
                            <SettingsIcon className="h-4 w-4 mr-1" />
                            Settings
                        </Link>
                    </Button>
                </div>
            )
        },
        enableSorting: false,
        enableHiding: false
    }
]

interface WalkthroughsClientProps {
    walkthroughsPromise: Promise<WalkthroughTableData[]>
}

export function WalkthroughsClient({ walkthroughsPromise }: WalkthroughsClientProps) {
    const walkthroughs = use(walkthroughsPromise)
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [createModalOpen, setCreateModalOpen] = useState(false)

    const table = useReactTable({
        data: walkthroughs,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        state: {
            sorting,
            columnFilters,
            columnVisibility
        }
    })

    if (walkthroughs.length === 0) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold">Walkthroughs</h1>
                        <p className="text-muted-foreground mt-2">
                            Create and manage interactive walkthroughs for your users
                        </p>
                    </div>
                </div>
                
                <div className="bg-muted/30 border border-border rounded-lg p-12 text-center">
                    <div className="bg-background rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-border">
                        <BookOpenIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No walkthroughs yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Get started by creating your first interactive walkthrough to guide your users.
                    </p>
                    <Button onClick={() => setCreateModalOpen(true)}>
                        <PlusIcon className="h-4 w-4 mr-2" />
                        Create Walkthrough
                    </Button>
                </div>

                <CreateWalkthroughModal 
                    open={createModalOpen} 
                    onOpenChange={setCreateModalOpen} 
                />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Walkthroughs</h1>
                    <p className="text-muted-foreground mt-2">
                        Create and manage interactive walkthroughs for your users
                    </p>
                </div>
                <Button onClick={() => setCreateModalOpen(true)}>
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create Walkthrough
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <Input
                    placeholder="Search walkthroughs..."
                    value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
                    onChange={(event) =>
                        table.getColumn('title')?.setFilterValue(event.target.value)
                    }
                    className="max-w-sm"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <ColumnsIcon className="h-4 w-4 mr-2" />
                            Columns
                            <ChevronDownIcon className="h-4 w-4 ml-2" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table
                            .getAllColumns()
                            .filter((column) => column.getCanHide())
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

            <div className="rounded-md border overflow-x-auto">
                <Table className="w-full">
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead 
                                            key={header.id}
                                            className={
                                                header.id === 'title' ? 'w-1/2 max-w-2xl' :
                                                header.id === 'type' ? 'w-40' :
                                                header.id === 'stepCount' ? 'w-24' :
                                                header.id === 'status' ? 'w-28' :
                                                header.id === 'createdAt' ? 'w-36' :
                                                header.id === 'actions' ? 'w-48' : ''
                                            }
                                        >
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
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    {table.getFilteredRowModel().rows.length} walkthrough(s) total
                </div>
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>

            <CreateWalkthroughModal 
                open={createModalOpen} 
                onOpenChange={setCreateModalOpen} 
            />
        </div>
    )
}