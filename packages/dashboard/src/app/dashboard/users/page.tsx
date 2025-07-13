import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { UsersTable } from '../../../components/users-table'

export default async function UsersPage() {
    const session = await requireSession()

    // Get all MCP users who have connected to servers in this organization
    const mcpUsersWithConnections = await db
        .select({
            distinctId: schema.mcpServerUser.distinctId,
            email: schema.mcpServerUser.email,
            firstSeenAt: schema.mcpServerUser.firstSeenAt,
            connectionCreatedAt: schema.mcpServerConnection.createdAt,
            serverName: schema.mcpServers.name,
            serverSlug: schema.mcpServers.slug,
            transport: schema.mcpServerConnection.transport
        })
        .from(schema.mcpServerUser)
        .leftJoin(
            schema.mcpServerConnection,
            eq(schema.mcpServerUser.distinctId, schema.mcpServerConnection.distinctId)
        )
        .leftJoin(schema.mcpServers, eq(schema.mcpServerConnection.slug, schema.mcpServers.slug))
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))

    // Group by user to combine their server connections
    const userMap = new Map<string, any>()

    for (const row of mcpUsersWithConnections) {
        const userId = row.distinctId

        // Skip rows where distinctId is null
        if (!userId) {
            continue
        }

        if (!userMap.has(userId)) {
            userMap.set(userId, {
                id: userId,
                distinctId: userId,
                name: row.email?.split('@')[0] || 'Unknown User', // Use email prefix as name
                email: row.email,
                image: null,
                createdAt: new Date(row.firstSeenAt || Date.now()),
                role: 'MCP User',
                connectedServers: []
            })
        }

        // Add server connection if it exists and is not already added
        if (row.serverSlug) {
            const user = userMap.get(userId)
            const existingServer = user.connectedServers.find((server: any) => server.serverSlug === row.serverSlug)

            if (!existingServer) {
                user.connectedServers.push({
                    distinctId: userId,
                    serverName: row.serverName || 'Unknown Server',
                    serverSlug: row.serverSlug,
                    firstSeenAt: row.connectionCreatedAt,
                    transport: row.transport
                })
            }
        }
    }

    const usersWithServers = Array.from(userMap.values())

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <UsersTable data={usersWithServers} />
            </div>
        </div>
    )
}
