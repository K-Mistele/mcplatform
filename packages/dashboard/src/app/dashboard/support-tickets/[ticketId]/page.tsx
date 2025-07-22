import { ActivityStream } from '@/components/support-tickets/activity-stream'
import { AssignmentWidget } from '@/components/support-tickets/assignment-widget'
import { EditableDescription, EditableTitle, PriorityDisplay } from '@/components/support-tickets/editable-fields'
import { StatusManager } from '@/components/support-tickets/status-manager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { desc, eq } from 'drizzle-orm'
import { ArrowLeftIcon, CalendarIcon, MailIcon, ServerIcon, TicketIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

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

// Ensure this page is not cached so revalidatePath works properly
export const revalidate = 0

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
            assigneeId: schema.supportRequests.assigneeId,
            priority: schema.supportRequests.priority,
            mcpServerName: schema.mcpServers.name,
            mcpServerSlug: schema.mcpServers.slug,
            assigneeName: schema.user.name,
            assigneeEmail: schema.user.email,
            assigneeImage: schema.user.image
        })
        .from(schema.supportRequests)
        .leftJoin(schema.mcpServers, eq(schema.supportRequests.mcpServerId, schema.mcpServers.id))
        .leftJoin(schema.user, eq(schema.supportRequests.assigneeId, schema.user.id))
        .where(eq(schema.supportRequests.id, params.ticketId))
        .limit(1)

    if (!ticketData || ticketData.organizationId !== session.session.activeOrganizationId) {
        notFound()
    }

    // Fetch activities for the ticket (with no-cache to ensure revalidatePath works)
    const activitiesPromise = db
        .select({
            id: schema.supportTicketActivities.id,
            createdAt: schema.supportTicketActivities.createdAt,
            activityType: schema.supportTicketActivities.activityType,
            content: schema.supportTicketActivities.content,
            contentType: schema.supportTicketActivities.contentType,
            metadata: schema.supportTicketActivities.metadata,
            userName: schema.user.name,
            userEmail: schema.user.email
        })
        .from(schema.supportTicketActivities)
        .leftJoin(schema.user, eq(schema.supportTicketActivities.userId, schema.user.id))
        .where(eq(schema.supportTicketActivities.supportRequestId, params.ticketId))
        .orderBy(desc(schema.supportTicketActivities.createdAt))

    // Fetch organization members for assignment
    const membersPromise = db
        .select({
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            image: schema.user.image
        })
        .from(schema.user)
        .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
        .where(eq(schema.member.organizationId, session.session.activeOrganizationId))

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

                <div className="flex items-center gap-3 mb-6">
                    <TicketIcon className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                        <EditableTitle ticketId={ticketData.id} initialValue={ticketData.title} />
                        <p className="text-muted-foreground">Ticket ID: {ticketData.id}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <StatusManager ticketId={ticketData.id} currentStatus={ticketData.status || 'pending'} />
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6">
                <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
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
                            <PriorityDisplay currentPriority={ticketData.priority} />
                            <AssignmentWidget
                                ticketId={ticketData.id}
                                currentAssigneeId={ticketData.assigneeId}
                                membersPromise={membersPromise}
                            />
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
                    <Card className="lg:col-span-2 2xl:col-span-1">
                        <CardHeader>
                            <CardTitle>Summary</CardTitle>
                            <CardDescription>Problem description provided by the user</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EditableDescription ticketId={ticketData.id} initialValue={ticketData.conciseSummary} />
                        </CardContent>
                    </Card>

                    {/* Context Card */}
                    {ticketData.context && (
                        <Card className="lg:col-span-2 2xl:col-span-3">
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

                {/* Activity Stream */}
                <div className="md:col-span-3">
                    <Suspense fallback={<div>Loading activity...</div>}>
                        <ErrorBoundary fallback={<div>Error loading activity</div>}>
                            <ActivityStream
                                activitiesPromise={activitiesPromise}
                                ticketId={ticketData.id}
                                currentStatus={ticketData.status || 'pending'}
                            />
                        </ErrorBoundary>
                    </Suspense>
                </div>
            </div>
        </div>
    )
}
