'use client'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CalendarIcon, MailIcon, ServerIcon, TicketIcon, UserIcon, WrenchIcon } from 'lucide-react'
import Link from 'next/link'
import { use, useState } from 'react'

interface UserDetailClientProps {
    userPromise: Promise<any>
    connectionsPromise: Promise<any[]>
    toolCallsPromise: Promise<any[]>
    supportRequestsPromise: Promise<any[]>
}

function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function getInitials(email: string): string {
    if (!email) return 'U'
    const parts = email.split('@')[0].split('.')
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return email[0].toUpperCase()
}

export function UserDetailClient({
    userPromise,
    connectionsPromise,
    toolCallsPromise,
    supportRequestsPromise
}: UserDetailClientProps) {
    const user = use(userPromise)
    const connections = use(connectionsPromise)
    const toolCalls = use(toolCallsPromise)
    const supportRequests = use(supportRequestsPromise)

    const [selectedToolCall, setSelectedToolCall] = useState<any>(null)

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-12 w-12">
                        <AvatarFallback className="text-lg">{getInitials(user.email || '')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold">{user.email || 'Unknown User'}</h1>
                        <p className="text-muted-foreground">User Details</p>
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6">
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Basic Information Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <UserIcon className="h-5 w-5" />
                                Basic Information
                            </CardTitle>
                            <CardDescription>Core details about this user</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">User ID</div>
                                <div className="mt-1">
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {user.id}
                                    </Badge>
                                </div>
                            </div>
                            {user.distinctId && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">Distinct ID</div>
                                    <div className="mt-1">
                                        <Badge variant="secondary" className="font-mono text-xs">
                                            {user.distinctId}
                                        </Badge>
                                    </div>
                                </div>
                            )}
                            {user.email && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">Email</div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <MailIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{user.email}</span>
                                    </div>
                                </div>
                            )}
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">First Seen</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{formatDate(user.firstSeenAt)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Connection Events Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ServerIcon className="h-5 w-5" />
                                Connection Events
                            </CardTitle>
                            <CardDescription>Server connections for this user</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {connections.length === 0 ? (
                                <div className="text-center py-8">
                                    <ServerIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No connections found</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-60 overflow-y-auto">
                                    {connections.map((connection) => (
                                        <div
                                            key={`${connection.serverId}-${connection.createdAt}`}
                                            className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                                        >
                                            <ServerIcon className="h-5 w-5 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">
                                                    <Link
                                                        href={`/dashboard/mcp-servers/${connection.serverId}`}
                                                        className="hover:underline"
                                                    >
                                                        {connection.serverName}
                                                    </Link>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <CalendarIcon className="h-3 w-3" />
                                                    <span>{formatDate(connection.createdAt)}</span>
                                                </div>
                                            </div>
                                            {connection.transport && (
                                                <Badge variant="outline" className="text-xs">
                                                    {connection.transport}
                                                </Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* All Tool Calls Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <WrenchIcon className="h-5 w-5" />
                                All Tool Calls
                            </CardTitle>
                            <CardDescription>Click a tool call to view details</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {toolCalls.length === 0 ? (
                                <div className="text-center py-8">
                                    <WrenchIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No tool calls found</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {toolCalls.map((call) => (
                                        <button
                                            key={call.id}
                                            type="button"
                                            onClick={() => setSelectedToolCall(call)}
                                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${
                                                selectedToolCall?.id === call.id
                                                    ? 'bg-accent border-primary'
                                                    : 'bg-card'
                                            }`}
                                        >
                                            <WrenchIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{call.toolName}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    from {call.serverName}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Tool Call Details Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <WrenchIcon className="h-5 w-5" />
                                Tool Call Details
                            </CardTitle>
                            <CardDescription>
                                {selectedToolCall
                                    ? 'Details for selected tool call'
                                    : 'Select a tool call to view details'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedToolCall ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Tool Name</div>
                                        <div className="mt-1">
                                            <Badge variant="outline">{selectedToolCall.toolName}</Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Server</div>
                                        <div className="mt-1">
                                            <Link
                                                href={`/dashboard/mcp-servers/${selectedToolCall.serverId}`}
                                                className="text-sm hover:underline"
                                            >
                                                {selectedToolCall.serverName}
                                            </Link>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Timestamp</div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{formatDate(selectedToolCall.createdAt)}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Input</div>
                                        <div className="mt-1">
                                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                                {JSON.stringify(selectedToolCall.input, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Output</div>
                                        <div className="mt-1">
                                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                                {JSON.stringify(selectedToolCall.output, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <WrenchIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">Select a tool call to view details</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Support Requests Section */}
                <div className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TicketIcon className="h-5 w-5" />
                                Support Requests
                            </CardTitle>
                            <CardDescription>Support tickets submitted by this user</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {supportRequests.length === 0 ? (
                                <div className="text-center py-8">
                                    <TicketIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No support requests found</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Server</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Summary</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {supportRequests.map((request) => (
                                            <TableRow key={request.id}>
                                                <TableCell>
                                                    <Link
                                                        href={`/dashboard/support-tickets/${request.id}`}
                                                        className="hover:underline font-medium"
                                                    >
                                                        {request.title}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <Link
                                                        href={`/dashboard/mcp-servers/${request.serverId}`}
                                                        className="hover:underline"
                                                    >
                                                        {request.serverName}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={
                                                            request.status === 'resolved' ? 'default' : 'secondary'
                                                        }
                                                    >
                                                        {request.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{formatDate(request.createdAt)}</TableCell>
                                                <TableCell className="max-w-md">
                                                    <div className="truncate" title={request.conciseSummary}>
                                                        {request.conciseSummary}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
