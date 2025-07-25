import { db, schema } from 'database'
import { mcpOAuthUser } from 'database/src/mcp-auth-schema'
import { and, desc, eq, or } from 'drizzle-orm'

/**
 * Get user by ID, distinct ID, or email with MCP OAuth user data
 */
export async function getUserData(identifier: string) {
    const [user] = await db
        .select({
            // MCP Server User fields
            id: schema.mcpServerUser.id,
            trackingId: schema.mcpServerUser.trackingId,
            email: schema.mcpServerUser.email,
            firstSeenAt: schema.mcpServerUser.firstSeenAt,
            // MCP OAuth User fields (when available)
            name: mcpOAuthUser.name,
            image: mcpOAuthUser.image,
            emailVerified: mcpOAuthUser.emailVerified
        })
        .from(schema.mcpServerUser)
        .leftJoin(mcpOAuthUser, eq(schema.mcpServerUser.email, mcpOAuthUser.email))
        .where(
            or(
                eq(schema.mcpServerUser.id, identifier),
                eq(schema.mcpServerUser.trackingId, identifier),
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
            createdAt: schema.mcpServerSession.connectionDate,
            serverName: schema.mcpServers.name,
            serverSlug: schema.mcpServers.slug,
            serverId: schema.mcpServers.id
        })
        .from(schema.mcpServerSession)
        .leftJoin(schema.mcpServers, eq(schema.mcpServerSession.mcpServerSlug, schema.mcpServers.slug))
        .where(eq(schema.mcpServerSession.mcpServerUserId, distinctId))
        .orderBy(desc(schema.mcpServerSession.connectionDate))

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

/**
 * Get user's sessions with server context, organized by session
 */
export async function getUserSessions(userId: string, organizationId: string) {
    const sessions = await db
        .select({
            sessionId: schema.mcpServerSession.mcpServerSessionId,
            title: schema.mcpServerSession.title,
            connectionDate: schema.mcpServerSession.connectionDate,
            connectionTimestamp: schema.mcpServerSession.connectionTimestamp,
            serverName: schema.mcpServers.name,
            serverSlug: schema.mcpServers.slug,
            serverId: schema.mcpServers.id
        })
        .from(schema.mcpServerSession)
        .leftJoin(schema.mcpServers, eq(schema.mcpServerSession.mcpServerSlug, schema.mcpServers.slug))
        .where(
            and(
                eq(schema.mcpServerSession.mcpServerUserId, userId),
                eq(schema.mcpServers.organizationId, organizationId)
            )
        )
        .orderBy(desc(schema.mcpServerSession.connectionTimestamp))

    // Filter sessions to only include those with valid server data
    return sessions.filter((session) => session.serverId && session.serverName)
}

/**
 * Get tool calls for a specific session
 */
export async function getSessionToolCalls(sessionId: string, organizationId: string) {
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
        .where(
            and(
                eq(schema.toolCalls.mcpServerSessionId, sessionId),
                eq(schema.mcpServers.organizationId, organizationId)
            )
        )
        .orderBy(desc(schema.toolCalls.createdAt))

    return toolCalls.filter((call) => call.serverId && call.serverName)
}

/**
 * Get support tickets for a specific session
 */
export async function getSessionSupportTickets(sessionId: string, organizationId: string) {
    const supportTickets = await db
        .select({
            id: schema.supportRequests.id,
            createdAt: schema.supportRequests.createdAt,
            title: schema.supportRequests.title,
            conciseSummary: schema.supportRequests.conciseSummary,
            context: schema.supportRequests.context,
            status: schema.supportRequests.status,
            email: schema.supportRequests.email,
            serverName: schema.mcpServers.name,
            serverId: schema.mcpServers.id
        })
        .from(schema.supportRequests)
        .leftJoin(schema.mcpServers, eq(schema.supportRequests.mcpServerId, schema.mcpServers.id))
        .where(
            and(
                eq(schema.supportRequests.mcpServerSessionId, sessionId),
                eq(schema.mcpServers.organizationId, organizationId)
            )
        )
        .orderBy(desc(schema.supportRequests.createdAt))

    return supportTickets.filter((ticket) => ticket.serverId && ticket.serverName)
}
