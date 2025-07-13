import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { desc, eq } from 'drizzle-orm'
import { Suspense } from 'react'
import { SupportTicketsClient } from '../../../components/support-tickets-client'

export default async function SupportTicketsPage() {
    const session = await requireSession()

    // Get support tickets for the organization
    const supportTicketsPromise = db
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
            mcpServerName: schema.mcpServers.name,
            mcpServerSlug: schema.mcpServers.slug
        })
        .from(schema.supportRequests)
        .leftJoin(schema.mcpServers, eq(schema.supportRequests.mcpServerId, schema.mcpServers.id))
        .where(eq(schema.supportRequests.organizationId, session.session.activeOrganizationId))
        .orderBy(desc(schema.supportRequests.createdAt))

    // Get all MCP servers for the organization for filtering
    const mcpServersPromise = db
        .select({
            id: schema.mcpServers.id,
            name: schema.mcpServers.name,
            slug: schema.mcpServers.slug
        })
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            {/* <div className="px-4 lg:px-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">Support Tickets</h1>
                    <p className="text-muted-foreground">
                        View and manage support tickets submitted through your MCP servers
                    </p>
                </div>
            </div> */}
            <div className="px-4 lg:px-6">
                <Suspense fallback={<div>Loading...</div>}>
                    <SupportTicketsClient
                        supportTicketsPromise={supportTicketsPromise}
                        mcpServersPromise={mcpServersPromise}
                    />
                </Suspense>
            </div>
        </div>
    )
}
