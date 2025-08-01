import { ChartAreaInteractive } from '@/components/chart-area-interactive'
import { SectionCards } from '@/components/section-cards'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { count, eq } from 'drizzle-orm'

export default async function DashboardPage() {
    console.log('DashboardPage')
    const session = await requireSession()
    const toolCallsPromise = db
        .select({
            count: count(schema.toolCalls.id)
        })
        .from(schema.toolCalls)
        .leftJoin(schema.mcpServers, eq(schema.toolCalls.mcpServerId, schema.mcpServers.id))
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
        .then((result) => result[0] || { count: 0 })
        .catch((error) => {
            console.error('Error fetching tool calls', error)
            return { count: 0 }
        })

    const supportTicketsPromise = db
        .select({
            count: count(schema.supportRequests.id)
        })
        .from(schema.supportRequests)
        .where(eq(schema.supportRequests.organizationId, session.session.activeOrganizationId))
        .then((result) => result[0] || { count: 0 })
        .catch((error) => {
            console.error('Error fetching support tickets', error)
            return { count: 0 }
        })

    const activeUsersPromise = db
        .select({
            count: count(schema.mcpServers.id)
        })
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
        .then((result) => result[0] || { count: 0 })
        .catch((error) => {
            console.error('Error fetching active users', error)
            return { count: 0 }
        })

    console.log('queries run')

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards
                toolCallsPromise={toolCallsPromise}
                supportTicketsPromise={supportTicketsPromise}
                activeUsersPromise={activeUsersPromise}
            />

            <div className="px-4 lg:px-6">
                <ChartAreaInteractive />
            </div>

            {/* <DataTable data={data} /> */}
        </div>
    )
}
