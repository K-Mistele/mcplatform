'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarIcon, ClockIcon, MailIcon, ServerIcon, TicketIcon, UserIcon, WrenchIcon } from 'lucide-react'
import Link from 'next/link'
import { use, useMemo, useState } from 'react'

interface UserDetailClientProps {
    userPromise: Promise<any>
    connectionsPromise: Promise<any[]>
    toolCallsPromise: Promise<any[]>
    supportRequestsPromise: Promise<any[]>
}

interface TimelineEvent {
    id: string
    type: 'tool_call' | 'connection' | 'support_request'
    timestamp: number
    title: string
    subtitle: string
    data: any
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

function formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
}

function getInitials(email: string): string {
    if (!email) return 'U'
    const parts = email.split('@')[0].split('.')
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return email[0].toUpperCase()
}

function getEventIcon(type: string) {
    switch (type) {
        case 'tool_call':
            return <WrenchIcon className="h-4 w-4" />
        case 'connection':
            return <ServerIcon className="h-4 w-4" />
        case 'support_request':
            return <TicketIcon className="h-4 w-4" />
        default:
            return <ClockIcon className="h-4 w-4" />
    }
}

function getEventColor(type: string) {
    switch (type) {
        case 'tool_call':
            return 'text-blue-500'
        case 'connection':
            return 'text-green-500'
        case 'support_request':
            return 'text-orange-500'
        default:
            return 'text-gray-500'
    }
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

    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)

    // Create unified timeline of all events
    const timelineEvents = useMemo((): TimelineEvent[] => {
        const events: TimelineEvent[] = []

        // Add tool calls
        for (const call of toolCalls) {
            events.push({
                id: `tool_call_${call.id}`,
                type: 'tool_call',
                timestamp: call.createdAt,
                title: call.toolName,
                subtitle: `from ${call.serverName}`,
                data: call
            })
        }

        // Add connections
        for (const connection of connections) {
            events.push({
                id: `connection_${connection.serverId}_${connection.createdAt}`,
                type: 'connection',
                timestamp: connection.createdAt,
                title: `Connected to ${connection.serverName}`,
                subtitle: `via ${connection.transport}`,
                data: connection
            })
        }

        // Add support requests
        for (const request of supportRequests) {
            events.push({
                id: `support_request_${request.id}`,
                type: 'support_request',
                timestamp: request.createdAt,
                title: request.title,
                subtitle: `from ${request.serverName}`,
                data: request
            })
        }

        // Sort by timestamp (most recent first)
        return events.sort((a, b) => b.timestamp - a.timestamp)
    }, [toolCalls, connections, supportRequests])

    return (
        <div className="flex flex-col gap-4">
            {/* <div className="px-4 lg:px-6">
                <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-12 w-12">
                        <AvatarFallback className="text-lg">{getInitials(user.email || '')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold">{user.email || 'Unknown User'}</h1>
                        <p className="text-muted-foreground">User Details</p>
                    </div>
                </div>
            </div> */}

            <div className="px-4 lg:px-6">
                {/* Basic Information Card */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserIcon className="h-5 w-5" />
                            Basic Information
                        </CardTitle>
                        <CardDescription>Core details about this user</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Timeline Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ClockIcon className="h-5 w-5" />
                                Activity Timeline
                            </CardTitle>
                            <CardDescription>All user events in chronological order</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {timelineEvents.length === 0 ? (
                                <div className="text-center py-8">
                                    <ClockIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No activity found</p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {timelineEvents.map((event, index) => (
                                        <button
                                            key={event.id}
                                            type="button"
                                            onClick={() => setSelectedEvent(event)}
                                            className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors ${
                                                selectedEvent?.id === event.id ? 'bg-accent border-primary' : 'bg-card'
                                            }`}
                                        >
                                            <div className={`flex-shrink-0 mt-1 ${getEventColor(event.type)}`}>
                                                {getEventIcon(event.type)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm truncate">{event.title}</div>
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {event.subtitle}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {formatRelativeTime(event.timestamp)}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Event Details Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                {selectedEvent ? getEventIcon(selectedEvent.type) : <ClockIcon className="h-5 w-5" />}
                                Event Details
                            </CardTitle>
                            <CardDescription>
                                {selectedEvent ? 'Details for selected event' : 'Select an event to view details'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {selectedEvent ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Event Type</div>
                                        <div className="mt-1">
                                            <Badge variant="outline" className={getEventColor(selectedEvent.type)}>
                                                {selectedEvent.type.replace('_', ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Title</div>
                                        <div className="mt-1 font-medium">{selectedEvent.title}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Timestamp</div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm">{formatDate(selectedEvent.timestamp)}</span>
                                        </div>
                                    </div>

                                    {/* Tool Call Details */}
                                    {selectedEvent.type === 'tool_call' && (
                                        <>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Server</div>
                                                <div className="mt-1">
                                                    <Link
                                                        href={`/dashboard/mcp-servers/${selectedEvent.data.serverId}`}
                                                        className="text-sm hover:underline"
                                                    >
                                                        {selectedEvent.data.serverName}
                                                    </Link>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Input</div>
                                                <div className="mt-1">
                                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                                        {JSON.stringify(selectedEvent.data.input, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Output</div>
                                                <div className="mt-1">
                                                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                                                        {JSON.stringify(selectedEvent.data.output, null, 2)}
                                                    </pre>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Connection Details */}
                                    {selectedEvent.type === 'connection' && (
                                        <>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Server</div>
                                                <div className="mt-1">
                                                    <Link
                                                        href={`/dashboard/mcp-servers/${selectedEvent.data.serverId}`}
                                                        className="text-sm hover:underline"
                                                    >
                                                        {selectedEvent.data.serverName}
                                                    </Link>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">
                                                    Transport
                                                </div>
                                                <div className="mt-1">
                                                    <Badge variant="secondary">{selectedEvent.data.transport}</Badge>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Support Request Details */}
                                    {selectedEvent.type === 'support_request' && (
                                        <>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Server</div>
                                                <div className="mt-1">
                                                    <Link
                                                        href={`/dashboard/mcp-servers/${selectedEvent.data.serverId}`}
                                                        className="text-sm hover:underline"
                                                    >
                                                        {selectedEvent.data.serverName}
                                                    </Link>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Status</div>
                                                <div className="mt-1">
                                                    <Badge
                                                        variant={
                                                            selectedEvent.data.status === 'resolved'
                                                                ? 'default'
                                                                : 'secondary'
                                                        }
                                                    >
                                                        {selectedEvent.data.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Summary</div>
                                                <div className="mt-1 text-sm">{selectedEvent.data.conciseSummary}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Actions</div>
                                                <div className="mt-1">
                                                    <Link
                                                        href={`/dashboard/support-tickets/${selectedEvent.data.id}`}
                                                        className="text-sm text-primary hover:underline"
                                                    >
                                                        View full ticket →
                                                    </Link>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <ClockIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">Select an event to view details</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
