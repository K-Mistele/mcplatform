import { CursorInstallLink } from '@/components/cursor-install-link'
import { EditServerConfiguration } from '@/components/edit-server-configuration'
import { McpServerUsersCard } from '@/components/mcp-server-users-card'
import { ServerUrlDisplay } from '@/components/server-url-display'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { ArrowLeftIcon, CalendarIcon, ServerIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface McpServerDetailsPageProps {
    params: Promise<{ serverId: string }>
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

export default async function McpServerDetailsPage(props: McpServerDetailsPageProps) {
    const session = await requireSession()
    const params = await props.params

    const [server] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, params.serverId)).limit(1)

    if (!server || server.organizationId !== session.session.activeOrganizationId) {
        notFound()
    }

    const slug = server.slug as string
    const currentLoc = process.env.NEXT_PUBLIC_BETTER_AUTH_URL
    const proto = currentLoc?.startsWith('https://') ? 'https://' : 'http://'
    const host = currentLoc?.split('://')[1]
    const url = `${proto}${slug}.${host}/api/mcp`

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/mcp-servers">
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Servers
                        </Link>
                    </Button>
                </div>

                <div className="flex items-center gap-3 mb-2">
                    <ServerIcon className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">{server.name}</h1>
                        <p className="text-muted-foreground">MCP Server Details</p>
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6">
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3 4xl:grid-cols-4">
                    {/* Basic Information Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ServerIcon className="h-5 w-5" />
                                Basic Information
                            </CardTitle>
                            <CardDescription>Core details about this MCP server</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Server ID</div>
                                <div className="mt-1">
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {server.id}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Server Name</div>
                                <p className="mt-1 font-medium">{server.name}</p>
                            </div>
                            {server.slug && (
                                <div className="flex flex-col gap-2">
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Server Slug</div>
                                        <div className="mt-1">
                                            <Badge variant="secondary" className="font-mono text-sm">
                                                {server.slug}
                                            </Badge>
                                        </div>
                                    </div>
                                    <ServerUrlDisplay url={url} />
                                </div>
                            )}
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Created</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{formatDate(server.createdAt)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Configuration Card */}
                    <EditServerConfiguration
                        serverId={server.id}
                        currentAuthType={server.authType || 'none'}
                        currentSupportTicketType={server.supportTicketType || 'dashboard'}
                    />

                    {/* Connected Users Card */}
                    <McpServerUsersCard serverId={server.id} serverSlug={server.slug} />

                    {/* Cursor Install Link Card */}
                    <CursorInstallLink serverName={server.name} serverUrl={url} />
                </div>
            </div>
        </div>
    )
}
