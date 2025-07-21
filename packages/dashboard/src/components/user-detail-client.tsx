'use client'

import React, { useState, useEffect } from 'react'
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
import { useQueryState } from 'nuqs'
import { client } from '@/lib/orpc/orpc.client'

interface UserDetailClientProps {
    user: any
    connections: any[]
    toolCalls: any[]
    supportRequests: any[]
    sessions: any[]
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
    user,
    connections,
    toolCalls,
    supportRequests,
    sessions
}: UserDetailClientProps) {
    // Use nuqs for URL state management
    const [selectedSessionId, setSelectedSessionId] = useQueryState('session')
    const [selectedItemId, setSelectedItemId] = useQueryState('item')
    const [selectedItemType, setSelectedItemType] = useQueryState('type')

    // Local state for session-specific data
    const [sessionItems, setSessionItems] = useState<any[]>([])
    const [isLoadingSession, setIsLoadingSession] = useState(false)

    // Get selected session data
    const selectedSession = sessions.find(session => session.sessionId === selectedSessionId) || null

    // Get selected item data
    const selectedItem = sessionItems.find(item => item.id === selectedItemId) || null

    // Fetch session-specific data when selectedSessionId changes
    useEffect(() => {
        if (!selectedSessionId) {
            setSessionItems([])
            return
        }

        const fetchSessionData = async () => {
            setIsLoadingSession(true)
            try {
                // Fetch both tool calls and support tickets for the session
                const [toolCallsResponse, supportTicketsResponse] = await Promise.all([
                    client.sessions.getToolCalls({ sessionId: selectedSessionId }),
                    client.sessions.getSupportTickets({ sessionId: selectedSessionId })
                ])

                // Combine and format the data
                const items = [
                    ...toolCallsResponse.map((call: any) => ({
                        id: call.id,
                        type: 'tool_call' as const,
                        timestamp: call.createdAt || 0,
                        title: call.toolName,
                        subtitle: `from ${call.serverName}`,
                        data: call
                    })),
                    ...supportTicketsResponse.map((ticket: any) => ({
                        id: ticket.id,
                        type: 'support_request' as const,
                        timestamp: ticket.createdAt || 0,
                        title: ticket.title || 'Untitled',
                        subtitle: `from ${ticket.serverName}`,
                        data: ticket
                    }))
                ].sort((a, b) => b.timestamp - a.timestamp)

                setSessionItems(items)
            } catch (error) {
                console.error('Error fetching session data:', error)
                setSessionItems([])
            } finally {
                setIsLoadingSession(false)
            }
        }

        fetchSessionData()
    }, [selectedSessionId])

    const handleSessionSelect = (sessionId: string) => {
        setSelectedSessionId(sessionId)
        setSelectedItemId(null) // Clear item selection when session changes
        setSelectedItemType(null)
    }

    const handleItemSelect = (itemId: string, itemType: string) => {
        setSelectedItemId(itemId)
        setSelectedItemType(itemType)
    }

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
                                                    onClick={() => handleSessionSelect(session.sessionId)}
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
                                    ) : isLoadingSession ? (
                                        <div className="text-center py-8 px-4">
                                            <ClockIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 animate-spin" />
                                            <p className="text-sm text-muted-foreground">Loading session activity...</p>
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
                                                    onClick={() => handleItemSelect(item.id, item.type)}
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