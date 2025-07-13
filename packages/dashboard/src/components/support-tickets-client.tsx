'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarIcon, FilterIcon, MailIcon, ServerIcon, TicketIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { Fragment, use, useMemo, useState } from 'react'

interface SupportTicket {
    id: string
    title: string | null
    createdAt: number | null
    conciseSummary: string | null
    context: string | null
    status: 'needs_email' | 'pending' | 'in_progress' | 'resolved' | 'closed' | null
    email: string
    resolvedAt: number | null
    mcpServerId: string | null
    mcpServerName: string | null
    mcpServerSlug: string | null
}

interface McpServer {
    id: string
    name: string
    slug: string | null
}

interface SupportTicketsClientProps {
    supportTicketsPromise: Promise<SupportTicket[]>
    mcpServersPromise: Promise<McpServer[]>
}

function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })
}

function getStatusColor(status: SupportTicket['status']): string {
    switch (status) {
        case 'needs_email':
            return 'bg-yellow-100 text-yellow-800 border-yellow-300'
        case 'pending':
            return 'bg-blue-100 text-blue-800 border-blue-300'
        case 'in_progress':
            return 'bg-purple-100 text-purple-800 border-purple-300'
        case 'resolved':
            return 'bg-green-100 text-green-800 border-green-300'
        case 'closed':
            return 'bg-gray-100 text-gray-800 border-gray-300'
        default:
            return 'bg-gray-100 text-gray-800 border-gray-300'
    }
}

function getStatusLabel(status: SupportTicket['status']): string {
    switch (status) {
        case 'needs_email':
            return 'Needs Email'
        case 'pending':
            return 'Pending'
        case 'in_progress':
            return 'In Progress'
        case 'resolved':
            return 'Resolved'
        case 'closed':
            return 'Closed'
        default:
            return 'Pending'
    }
}

export function SupportTicketsClient({ supportTicketsPromise, mcpServersPromise }: SupportTicketsClientProps) {
    const supportTickets = use(supportTicketsPromise)
    const mcpServers = use(mcpServersPromise)

    const [emailFilter, setEmailFilter] = useState('')
    const [serverFilter, setServerFilter] = useState<string>('all')
    const [statusFilter, setStatusFilter] = useState<string>('all')

    const filteredTickets = useMemo(() => {
        if (!Array.isArray(supportTickets)) return []

        return supportTickets.filter((ticket) => {
            const matchesEmail = emailFilter === '' || ticket.email.toLowerCase().includes(emailFilter.toLowerCase())
            const matchesServer = serverFilter === 'all' || ticket.mcpServerId === serverFilter
            const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter

            return matchesEmail && matchesServer && matchesStatus
        })
    }, [supportTickets, emailFilter, serverFilter, statusFilter])

    const clearFilters = () => {
        setEmailFilter('')
        setServerFilter('all')
        setStatusFilter('all')
    }

    const hasActiveFilters = emailFilter !== '' || serverFilter !== 'all' || statusFilter !== 'all'

    return (
        <div className="space-y-6">
            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FilterIcon className="h-5 w-5" />
                        Filters
                    </CardTitle>
                    <CardDescription>Filter support tickets by email, MCP server, or status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="email-filter">Email</Label>
                            <Input
                                id="email-filter"
                                placeholder="Search by email..."
                                value={emailFilter}
                                onChange={(e) => setEmailFilter(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="server-filter">MCP Server</Label>
                            <Select value={serverFilter} onValueChange={setServerFilter}>
                                <SelectTrigger id="server-filter">
                                    <SelectValue placeholder="All servers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All servers</SelectItem>
                                    {mcpServers.map((server) => (
                                        <SelectItem key={server.id} value={server.id}>
                                            {server.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="status-filter">Status</Label>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger id="status-filter">
                                    <SelectValue placeholder="All statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="needs_email">Needs Email</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="resolved">Resolved</SelectItem>
                                    <SelectItem value="closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                                className="flex items-center gap-2"
                            >
                                <XIcon className="h-4 w-4" />
                                Clear Filters
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Showing {filteredTickets.length} of {supportTickets.length} tickets
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Results */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <TicketIcon className="h-5 w-5" />
                        Support Tickets
                        <Badge variant="secondary">{filteredTickets.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filteredTickets.length === 0 ? (
                        <div className="text-center py-8">
                            <TicketIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No support tickets found</h3>
                            <p className="text-muted-foreground">
                                {hasActiveFilters
                                    ? 'No tickets match your current filters. Try adjusting your search criteria.'
                                    : 'No support tickets have been submitted yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>MCP Server</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTickets.map((ticket) => (
                                        <Fragment key={ticket.id}>
                                            <TableRow className="hover:bg-muted/50 cursor-pointer">
                                                <TableCell>
                                                    <Link
                                                        href={`/dashboard/support-tickets/${ticket.id}`}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <TicketIcon className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-medium">
                                                            {ticket.title || 'Untitled'}
                                                        </span>
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <Link
                                                        href={`/dashboard/support-tickets/${ticket.id}`}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <MailIcon className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm font-medium">{ticket.email}</span>
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    {ticket.mcpServerId ? (
                                                        <Link
                                                            href={`/dashboard/mcp-servers/${ticket.mcpServerId}`}
                                                            className="flex items-center gap-2 hover:text-primary"
                                                        >
                                                            <ServerIcon className="h-4 w-4 text-muted-foreground" />
                                                            <span className="text-sm">
                                                                {mcpServers.find((s) => s.id === ticket.mcpServerId)
                                                                    ?.name || 'Unknown Server'}
                                                            </span>
                                                        </Link>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">No server</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Link
                                                        href={`/dashboard/support-tickets/${ticket.id}`}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-sm">{formatDate(ticket.createdAt)}</span>
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={`/dashboard/support-tickets/${ticket.id}`}>
                                                        <Badge className={getStatusColor(ticket.status)}>
                                                            {ticket.status?.replace('_', ' ') || 'pending'}
                                                        </Badge>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                            <TableRow className="">
                                                <TableCell colSpan={5} className="pt-0 pb-4">
                                                    <Link
                                                        href={`/dashboard/support-tickets/${ticket.id}`}
                                                        className="block text-sm text-muted-foreground hover:text-foreground"
                                                    >
                                                        <div className="line-clamp-2">
                                                            <span className="font-bold">Summary:</span>&nbsp;
                                                            {ticket.conciseSummary
                                                                ? `${ticket.conciseSummary.slice(0, 100)}...`
                                                                : 'No summary provided'}
                                                        </div>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        </Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
