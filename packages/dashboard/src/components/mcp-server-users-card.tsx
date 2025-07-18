import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserAvatar } from '@/components/user-avatar'
import { db, schema } from 'database'
import { mcpOAuthUser } from 'database/src/mcp-auth-schema'
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

function getInitials(name: string | null, email: string | null, id: string): string {
    if (name) {
        const parts = name.split(' ')
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        }
        return name[0].toUpperCase()
    }
    if (email) {
        const parts = email.split('@')[0].split('.')
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        }
        return email[0].toUpperCase()
    }
    return id.substring(0, 2).toUpperCase()
}

function getDisplayName(name: string | null, email: string | null, id: string): string {
    if (name) return name
    if (email) return email
    return id
}

export async function McpServerUsersCard({ serverId, serverSlug }: McpServerUsersCardProps) {
    // Query to get distinct users connected to this MCP server with OAuth profile data
    const connections = await db
        .selectDistinctOn([schema.mcpServerSession.mcpServerUserId])
        .from(schema.mcpServerSession)
        .leftJoin(schema.mcpServerUser, eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id))
        .leftJoin(mcpOAuthUser, eq(schema.mcpServerUser.email, mcpOAuthUser.email))
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
                            {connections.map((connection) => {
                                const userId = connection.mcp_server_session.mcpServerUserId || ''
                                const userName = connection.mcp_oauth_user?.name || null
                                const userEmail =
                                    connection.mcp_server_user?.email || connection.mcp_oauth_user?.email || null
                                const userImage = connection.mcp_oauth_user?.image || null
                                const displayName = getDisplayName(userName, userEmail, userId)
                                const initials = getInitials(userName, userEmail, userId)

                                return (
                                    <div key={userId} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                        <UserAvatar
                                            image={userImage}
                                            fallbackValue={userId}
                                            name={userName}
                                            size="40px"
                                            className="h-10 w-10 rounded-full"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">
                                                {userId ? (
                                                    <Link
                                                        href={`/dashboard/users/${encodeURIComponent(userId)}`}
                                                        className="hover:underline"
                                                    >
                                                        {userName || (userEmail ? userEmail.split('@')[0] : userId)}
                                                    </Link>
                                                ) : (
                                                    displayName
                                                )}
                                            </div>
                                            {userEmail && (
                                                <div className="text-xs text-muted-foreground truncate">
                                                    {userEmail}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                <CalendarIcon className="h-3 w-3" />
                                                <span>
                                                    Connected{' '}
                                                    {formatDate(connection.mcp_server_session.connectionTimestamp)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
