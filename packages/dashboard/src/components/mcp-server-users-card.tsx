import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { CalendarIcon, UsersIcon } from 'lucide-react'
import Link from 'next/link'

interface McpServerUsersCardProps {
    serverId: string
    serverSlug: string
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

function getInitials(email: string): string {
    if (!email) return 'U'
    const parts = email.split('@')[0].split('.')
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return email[0].toUpperCase()
}

export async function McpServerUsersCard({ serverId, serverSlug }: McpServerUsersCardProps) {
    // Query to get distinct users connected to this MCP server (most recent connection per user)
    const connections = await db
        .selectDistinctOn([schema.mcpServerSession.mcpServerUserId])
        .from(schema.mcpServerSession)
        .leftJoin(schema.mcpServerUser, eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id))
        .where(eq(schema.mcpServerSession.mcpServerSlug, serverSlug))

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5" />
                    Connected Users
                </CardTitle>
                <CardDescription>Users who have connected to this MCP server</CardDescription>
            </CardHeader>
            <CardContent>
                {connections.length === 0 ? (
                    <div className="text-center py-8">
                        <UsersIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No users connected yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Badge variant="secondary" className="text-sm">
                                {connections.length} user{connections.length !== 1 ? 's' : ''} connected
                            </Badge>
                        </div>
                        <div className="space-y-3 max-h-60 overflow-y-auto">
                            {connections.map((connection) => (
                                <div
                                    key={connection.mcp_server_session.mcpServerUserId}
                                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                                >
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="text-xs">
                                            {getInitials(
                                                connection.mcp_server_user?.email ||
                                                    connection.mcp_server_session.mcpServerUserId ||
                                                    ''
                                            )}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">
                                            {connection.mcp_server_session.mcpServerUserId ? (
                                                <Link
                                                    href={`/dashboard/users/${encodeURIComponent(connection.mcp_server_session.mcpServerUserId)}`}
                                                    className="hover:underline"
                                                >
                                                    {connection.mcp_server_session.mcpServerUserId || 'Unknown user'}
                                                </Link>
                                            ) : (
                                                connection.mcp_server_session.mcpServerUserId || 'Unknown user'
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <CalendarIcon className="h-3 w-3" />
                                            <span>
                                                Connected{' '}
                                                {formatDate(connection.mcp_server_session.connectionTimestamp)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
