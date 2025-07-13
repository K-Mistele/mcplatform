import { db, schema } from 'database'
import { desc, eq, or } from 'drizzle-orm'

/**
 * Get user by ID, distinct ID, or email
 */
export async function getUserData(identifier: string) {
    const [user] = await db
        .select()
        .from(schema.mcpServerUser)
        .where(
            or(
                eq(schema.mcpServerUser.id, identifier),
                eq(schema.mcpServerUser.distinctId, identifier),
                eq(schema.mcpServerUser.email, identifier)
            )
        )
        .limit(1)

    return user
}

/**
 * Get user's connections to servers in the organization
 */
export async function getUserConnections(distinctId: string) {
    const connections = await db
        .select({
            transport: schema.mcpServerConnection.transport,
            createdAt: schema.mcpServerConnection.createdAt,
            serverName: schema.mcpServers.name,
            serverSlug: schema.mcpServers.slug,
            serverId: schema.mcpServers.id
        })
        .from(schema.mcpServerConnection)
        .leftJoin(schema.mcpServers, eq(schema.mcpServerConnection.slug, schema.mcpServers.slug))
        .where(eq(schema.mcpServerConnection.distinctId, distinctId))
        .orderBy(desc(schema.mcpServerConnection.createdAt))

    // Filter connections to only include servers that exist in our org
    return connections.filter((conn) => conn.serverId && conn.serverName)
}

/**
 * Get user's tool calls from servers in the organization
 */
export async function getUserToolCalls(organizationId: string) {
    const toolCalls = await db
        .select({
            id: schema.toolCalls.id,
            createdAt: schema.toolCalls.createdAt,
            toolName: schema.toolCalls.toolName,
            input: schema.toolCalls.input,
            output: schema.toolCalls.output,
            serverName: schema.mcpServers.name,
            serverId: schema.mcpServers.id
        })
        .from(schema.toolCalls)
        .leftJoin(schema.mcpServers, eq(schema.toolCalls.mcpServerId, schema.mcpServers.id))
        .where(eq(schema.mcpServers.organizationId, organizationId))
        .orderBy(desc(schema.toolCalls.createdAt))

    return toolCalls
}

/**
 * Get user's support requests from servers in the organization
 */
export async function getUserSupportRequests(email: string) {
    const supportRequests = await db
        .select({
            id: schema.supportRequests.id,
            createdAt: schema.supportRequests.createdAt,
            title: schema.supportRequests.title,
            conciseSummary: schema.supportRequests.conciseSummary,
            status: schema.supportRequests.status,
            serverName: schema.mcpServers.name,
            serverId: schema.mcpServers.id
        })
        .from(schema.supportRequests)
        .leftJoin(schema.mcpServers, eq(schema.supportRequests.mcpServerId, schema.mcpServers.id))
        .where(eq(schema.supportRequests.email, email))
        .orderBy(desc(schema.supportRequests.createdAt))

    // Filter support requests to only include those from servers that exist
    return supportRequests.filter((req) => req.serverId && req.serverName)
}
