'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { UserAvatar } from '@/components/user-avatar'
import {
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
    MailIcon,
    ServerIcon,
    TicketIcon,
    UserIcon,
    WrenchIcon
} from 'lucide-react'
import Link from 'next/link'
import { use, useMemo, useState } from 'react'

interface UserDetailClientProps {
    userPromise: Promise<any>
    connectionsPromise: Promise<any[]>
    toolCallsPromise: Promise<any[]>
    supportRequestsPromise: Promise<any[]>
    sessionsPromise: Promise<any[]>
    organizationId: string
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
    supportRequestsPromise,
    sessionsPromise,
    organizationId
}: UserDetailClientProps) {
    const user = use(userPromise)
    const connections = use(connectionsPromise)
    const toolCalls = use(toolCallsPromise)
    const supportRequests = use(supportRequestsPromise)
    const sessions = use(sessionsPromise)

    // URL state management for selected session and item (temporarily using useState)
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const [selectedItemType, setSelectedItemType] = useState<string | null>(null)

    // Get selected session data
    const selectedSession = useMemo(() => {
        return sessions.find(session => session.sessionId === selectedSessionId) || null
    }, [sessions, selectedSessionId])

    // Temporarily use all tool calls and support requests (not session-specific yet)
    // TODO: Implement oRPC endpoints for session-specific data fetching
    const sessionItems = useMemo(() => {
        if (!selectedSessionId) return []
        
        const items: Array<{
            id: string
            type: 'tool_call' | 'support_request'
            timestamp: number
            title: string
            subtitle: string
            data: any
        }> = []

        // Add all tool calls (temporarily - should be session-specific)
        for (const call of toolCalls) {
            items.push({
                id: call.id,
                type: 'tool_call',
                timestamp: call.createdAt,
                title: call.toolName,
                subtitle: `from ${call.serverName}`,
                data: call
            })
        }

        // Add all support requests (temporarily - should be session-specific)
        for (const request of supportRequests) {
            items.push({
                id: request.id,
                type: 'support_request',
                timestamp: request.createdAt,
                title: request.title,
                subtitle: `from ${request.serverName}`,
                data: request
            })
        }

        // Sort by timestamp (most recent first)
        return items.sort((a, b) => b.timestamp - a.timestamp)
    }, [selectedSessionId, toolCalls, supportRequests])

    // Get selected item data
    const selectedItem = useMemo(() => {
        return sessionItems.find(item => item.id === selectedItemId) || null
    }, [sessionItems, selectedItemId])

    return (
        <div className="flex flex-col gap-4">
            {/* User Profile Header */}
            <div className="px-4 lg:px-6">
                <div className="flex items-center gap-6 mb-6 p-6 bg-gradient-to-r from-background to-muted/20 rounded-lg border">
                    <UserAvatar
                        image={user.image}
                        fallbackValue={user.trackingId || user.id}
                        name={user.name}
                        size="80px"
                        className="h-20 w-20 rounded-full ring-2 ring-background shadow-lg"
                    />
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <h1 className="text-3xl font-bold">{user.name || user.email || 'Unknown User'}</h1>
                            {user.emailVerified && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                    <CheckCircleIcon className="h-3 w-3" />
                                    Verified
                                </Badge>
                            )}
                        </div>
                        {user.email && (
                            <div className="flex items-center gap-2 text-lg text-muted-foreground mb-1">
                                <MailIcon className="h-5 w-5" />
                                <span className="font-medium">{user.email}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CalendarIcon className="h-4 w-4" />
                            <span>First seen {formatDate(user.firstSeenAt)}</span>
                        </div>
                    </div>
                </div>
            </div>

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
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <div className="text-sm font-medium text-muted-foreground">User ID</div>
                            <div className="mt-1">
                                <Badge variant="outline" className="font-mono text-xs">
                                    {user.id}
                                </Badge>
                            </div>
                        </div>
                        {user.trackingId && (
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Tracking ID</div>
                                <div className="mt-1">
                                    <Badge variant="secondary" className="font-mono text-xs">
                                        {user.trackingId}
                                    </Badge>
                                </div>
                            </div>
                        )}
                        {user.name && (
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Display Name</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">{user.name}</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Three-Pane Session Interface */}
                <div className="h-[600px] border rounded-lg">
                    <ResizablePanelGroup direction="horizontal" className="h-full">
                        {/* Left Pane: Sessions List */}
                        <ResizablePanel defaultSize={30} minSize={25}>
                            <Card className="h-full border-0 rounded-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <ServerIcon className="h-5 w-5" />
                                        Sessions
                                    </CardTitle>
                                    <CardDescription>User's connection sessions</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {sessions.length === 0 ? (
                                        <div className="text-center py-8 px-4">
                                            <ServerIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">No sessions found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1 max-h-[450px] overflow-y-auto px-4 pb-4">
                                            {sessions.map((session) => (
                                                <button
                                                    key={session.sessionId}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedSessionId(session.sessionId)
                                                        setSelectedItemId(null)
                                                        setSelectedItemType(null)
                                                    }}
                                                    className={`w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors ${
                                                        selectedSessionId === session.sessionId ? 'bg-accent border-primary' : 'bg-card'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 mt-1 text-green-500">
                                                            <ServerIcon className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm truncate">
                                                                {session.title || session.serverName}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {session.serverName}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {formatRelativeTime(session.connectionTimestamp)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        {/* Center Pane: Session Contents */}
                        <ResizablePanel defaultSize={40} minSize={30}>
                            <Card className="h-full border-0 rounded-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <ClockIcon className="h-5 w-5" />
                                        Session Activity
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedSession ? `Activity in ${selectedSession.serverName}` : 'Select a session to view activity'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    {!selectedSessionId ? (
                                        <div className="text-center py-8 px-4">
                                            <ClockIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">Select a session to view activity</p>
                                        </div>
                                    ) : sessionItems.length === 0 ? (
                                        <div className="text-center py-8 px-4">
                                            <ClockIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                            <p className="text-sm text-muted-foreground">No activity in this session</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1 max-h-[450px] overflow-y-auto px-4 pb-4">
                                            {sessionItems.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedItemId(item.id)
                                                        setSelectedItemType(item.type)
                                                    }}
                                                    className={`w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors ${
                                                        selectedItemId === item.id ? 'bg-accent border-primary' : 'bg-card'
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className={`flex-shrink-0 mt-1 ${getEventColor(item.type)}`}>
                                                            {getEventIcon(item.type)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm truncate">{item.title}</div>
                                                            <div className="text-xs text-muted-foreground truncate">
                                                                {item.subtitle}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {formatRelativeTime(item.timestamp)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </ResizablePanel>

                        <ResizableHandle withHandle />

                        {/* Right Pane: Item Details */}
                        <ResizablePanel defaultSize={30} minSize={25}>
                            <Card className="h-full border-0 rounded-none">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        {selectedItem ? getEventIcon(selectedItem.type) : <ClockIcon className="h-5 w-5" />}
                                        Item Details
                                    </CardTitle>
                                    <CardDescription>
                                        {selectedItem ? 'Details for selected item' : 'Select an item to view details'}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="px-4 pb-4">
                                    {selectedItem ? (
                                        <div className="space-y-4 max-h-[450px] overflow-y-auto">
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Type</div>
                                                <div className="mt-1">
                                                    <Badge variant="outline" className={getEventColor(selectedItem.type)}>
                                                        {selectedItem.type.replace('_', ' ')}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Title</div>
                                                <div className="mt-1 font-medium text-sm">{selectedItem.title}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-muted-foreground">Timestamp</div>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs">{formatDate(selectedItem.timestamp)}</span>
                                                </div>
                                            </div>

                                            {/* Tool Call Details */}
                                            {selectedItem.type === 'tool_call' && (
                                                <>
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Input</div>
                                                        <div className="mt-1">
                                                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                                                                {JSON.stringify(selectedItem.data.input, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Output</div>
                                                        <div className="mt-1">
                                                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                                                                {JSON.stringify(selectedItem.data.output, null, 2)}
                                                            </pre>
                                                        </div>
                                                    </div>
                                                </>
                                            )}

                                            {/* Support Request Details */}
                                            {selectedItem.type === 'support_request' && (
                                                <>
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Status</div>
                                                        <div className="mt-1">
                                                            <Badge
                                                                variant={
                                                                    selectedItem.data.status === 'resolved'
                                                                        ? 'default'
                                                                        : 'secondary'
                                                                }
                                                            >
                                                                {selectedItem.data.status}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Summary</div>
                                                        <div className="mt-1 text-sm">{selectedItem.data.conciseSummary}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-muted-foreground">Actions</div>
                                                        <div className="mt-1">
                                                            <Link
                                                                href={`/dashboard/support-tickets/${selectedItem.data.id}`}
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
                                            <p className="text-sm text-muted-foreground">Select an item to view details</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </div>
            </div>
        </div>
    )
}