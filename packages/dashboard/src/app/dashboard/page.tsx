import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { ErrorBoundary } from '@/components/error-boundary'
import { SectionCards } from '@/components/section-cards'
import { Suspense } from 'react'

import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { count, eq } from 'drizzle-orm'

function ChartLoading() {
    return (
        <div className="px-4 lg:px-6">
            <div className="@container/card">
                <div className="p-6">
                    <div className="h-[250px] flex items-center justify-center">
                        <div className="text-muted-foreground">Loading chart...</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default async function DashboardPage() {
    const session = await requireSession()
    const toolCallsPromise = db
        .select({
            count: count(schema.toolCalls.id)
        })
        .from(schema.toolCalls)
        .leftJoin(schema.mcpServers, eq(schema.toolCalls.mcpServerId, schema.mcpServers.id))
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
        .then((result) => result[0] || { count: 0 })

    const supportTicketsPromise = db
        .select({
            count: count(schema.supportRequests.id)
        })
        .from(schema.supportRequests)
        .where(eq(schema.supportRequests.organizationId, session.session.activeOrganizationId))
        .then((result) => result[0] || { count: 0 })

    const activeUsersPromise = db
        .select({
            count: count(schema.mcpServers.id)
        })
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
        .then((result) => result[0] || { count: 0 })

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards
                toolCallsPromise={toolCallsPromise}
                supportTicketsPromise={supportTicketsPromise}
                activeUsersPromise={activeUsersPromise}
            />

            <ErrorBoundary>
                <Suspense fallback={<ChartLoading />}>
                    <div className="px-4 lg:px-6">
                        <ChartAreaInteractive />
                    </div>
                </Suspense>
            </ErrorBoundary>

            {/* <DataTable data={data} /> */}
        </div>
    )
}
