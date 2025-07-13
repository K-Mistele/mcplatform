import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { ArrowLeftIcon, CalendarIcon, MailIcon, ServerIcon, TicketIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface SupportTicketDetailsPageProps {
    params: Promise<{ ticketId: string }>
}

function formatDate(timestamp: number | null): string {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    })
}

function getStatusColor(status: string) {
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

export default async function SupportTicketDetailsPage(props: SupportTicketDetailsPageProps) {
    const session = await requireSession()
    const params = await props.params

    // Fetch the support ticket with MCP server information
    const [ticketData] = await db
        .select({
            id: schema.supportRequests.id,
            title: schema.supportRequests.title,
            createdAt: schema.supportRequests.createdAt,
            conciseSummary: schema.supportRequests.conciseSummary,
            context: schema.supportRequests.context,
            status: schema.supportRequests.status,
            email: schema.supportRequests.email,
            resolvedAt: schema.supportRequests.resolvedAt,
            mcpServerId: schema.supportRequests.mcpServerId,
            organizationId: schema.supportRequests.organizationId,
            mcpServerName: schema.mcpServers.name,
            mcpServerSlug: schema.mcpServers.slug
        })
        .from(schema.supportRequests)
        .leftJoin(schema.mcpServers, eq(schema.supportRequests.mcpServerId, schema.mcpServers.id))
        .where(eq(schema.supportRequests.id, params.ticketId))
        .limit(1)

    if (!ticketData || ticketData.organizationId !== session.session.activeOrganizationId) {
        notFound()
    }

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/support-tickets">
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Support Tickets
                        </Link>
                    </Button>
                </div>

                <div className="flex items-center gap-3 mb-2">
                    <TicketIcon className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">{ticketData.title || 'Support Ticket'}</h1>
                        <p className="text-muted-foreground">Ticket ID: {ticketData.id}</p>
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6">
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
                    {/* Basic Information Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <TicketIcon className="h-5 w-5" />
                                Basic Information
                            </CardTitle>
                            <CardDescription>Core details about this support ticket</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Ticket ID</div>
                                <div className="mt-1">
                                    <Badge variant="outline" className="font-mono text-xs">
                                        {ticketData.id}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Status</div>
                                <div className="mt-1">
                                    <Badge className={getStatusColor(ticketData.status || 'pending')}>
                                        {ticketData.status?.replace('_', ' ') || 'pending'}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">User's Email</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <MailIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm hover:underline">
                                        <a href={`mailto:${ticketData.email}`}>{ticketData.email}</a>
                                    </span>
                                </div>
                            </div>
                            <div>
                                <div className="text-sm font-medium text-muted-foreground">Created</div>
                                <div className="mt-1 flex items-center gap-2">
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm">{formatDate(ticketData.createdAt)}</span>
                                </div>
                            </div>
                            {ticketData.resolvedAt && (
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">Resolved</div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm">{formatDate(ticketData.resolvedAt)}</span>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* MCP Server Information Card */}
                    {ticketData.mcpServerId && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ServerIcon className="h-5 w-5" />
                                    MCP Server
                                </CardTitle>
                                <CardDescription>Server associated with this ticket</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">Server Name</div>
                                    <p className="mt-1 font-medium">{ticketData.mcpServerName || 'Unknown'}</p>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-muted-foreground">Server ID</div>
                                    <div className="mt-1">
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {ticketData.mcpServerId}
                                        </Badge>
                                    </div>
                                </div>
                                {ticketData.mcpServerSlug && (
                                    <div>
                                        <div className="text-sm font-medium text-muted-foreground">Server Slug</div>
                                        <div className="mt-1">
                                            <Badge variant="secondary" className="font-mono text-sm">
                                                {ticketData.mcpServerSlug}
                                            </Badge>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-2">
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/dashboard/mcp-servers/${ticketData.mcpServerId}`}>
                                            View Server Details
                                        </Link>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Summary Card */}
                    <Card className="md:col-span-1 md:row-span-2">
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                            <CardDescription>Problem description provided by the user</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="prose prose-sm max-w-none">
                                <p className="text-sm leading-relaxed">
                                    {ticketData.conciseSummary || 'No summary provided'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Context Card */}
                    {ticketData.context && (
                        <Card className="md:col-span-2 ">
                            <CardHeader>
                                <CardTitle>Context</CardTitle>
                                <CardDescription>Additional context about the user's project and setup</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="prose prose-sm max-w-none">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticketData.context}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
