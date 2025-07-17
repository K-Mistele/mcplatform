import { UsersLoading } from '@/components/users-loading'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { and, count, eq, sql } from 'drizzle-orm'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { UsersClient } from './users-client'

export default async function UsersPage() {
    const session = await requireSession()

    // Create promises without awaiting them - run concurrently
    const mcpUsersPromise = db
        .select({
            distinctId: schema.mcpServerUser.trackingId,
            email: schema.mcpServerUser.email,
            firstSeenAt: schema.mcpServerUser.firstSeenAt,
            connectionCreatedAt: sql<
                number | null
            >`CASE WHEN ${schema.mcpServerSession.connectionDate} IS NOT NULL THEN EXTRACT(EPOCH FROM ${schema.mcpServerSession.connectionDate}) * 1000 ELSE NULL END`.as(
                'connectionCreatedAt'
            ),
            serverName: schema.mcpServers.name,
            serverSlug: schema.mcpServers.slug,
            transport: sql<string | null>`NULL`.as('transport') // Transport was removed in migrations
        })
        .from(schema.mcpServerSession)
        .innerJoin(schema.mcpServerUser, eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id))
        .innerJoin(schema.mcpServers, eq(schema.mcpServerSession.mcpServerSlug, schema.mcpServers.slug))
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))

    const supportTicketCountsPromise = db
        .select({
            email: schema.supportRequests.email,
            lifetimeCount: count(schema.supportRequests.id).as('lifetimeCount')
        })
        .from(schema.supportRequests)
        .where(eq(schema.supportRequests.organizationId, session.session.activeOrganizationId))
        .groupBy(schema.supportRequests.email)

    const openTicketCountsPromise = db
        .select({
            email: schema.supportRequests.email,
            openCount: count(schema.supportRequests.id).as('openCount')
        })
        .from(schema.supportRequests)
        .where(
            and(
                eq(schema.supportRequests.organizationId, session.session.activeOrganizationId),
                eq(schema.supportRequests.status, 'pending')
            )
        )
        .groupBy(schema.supportRequests.email)

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <ErrorBoundary fallback={<div>Error</div>}>
                    <Suspense fallback={<UsersLoading />}>
                        <UsersClient
                            mcpUsersPromise={mcpUsersPromise}
                            supportTicketCountsPromise={supportTicketCountsPromise}
                            openTicketCountsPromise={openTicketCountsPromise}
                        />
                    </Suspense>
                </ErrorBoundary>
            </div>
        </div>
    )
}
