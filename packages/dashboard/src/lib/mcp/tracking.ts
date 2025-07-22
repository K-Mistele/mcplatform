/**
 * This is where behavioral tracking for MCP servers is implemented.
 * TODO this needs to user something faster than postgres.
 */
import { nanoid } from 'common/nanoid'
import { db, schema, mcpOAuthUser } from 'database'
import { eq, or } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '../auth/mcp/auth'
import type { McpServerConfig } from './types'

/**
 * Track a tool call for a user; if an email is provided, it will be used to track the user.
 * @param param0
 */
export async function trackToolCall({
    mcpServerUserId,
    serverSessionId,
    toolName,
    inputData,
    outputData,
    serverConfig,
    email
}: {
    mcpServerUserId: string
    serverSessionId: string
    toolName: string
    inputData: any
    outputData: any
    serverConfig: McpServerConfig
    email?: string | null
}) {
    const promises: Array<Promise<unknown>> = [
        db.insert(schema.toolCalls).values({
            mcpServerId: serverConfig.id,
            mcpServerUserId,
            mcpServerSessionId: serverSessionId,
            toolName,
            input: inputData,
            output: outputData
        })
    ]

    if (email) {
        promises.push(
            db.update(schema.mcpServerUser).set({ email }).where(eq(schema.mcpServerUser.id, mcpServerUserId))
        )
    }
    return await Promise.all(promises)
}

/**
 * Get the MCP server user ID and track the user if necessary.
 * @param param0
 * @returns
 */
export async function getAndTrackMcpServerUser({
    serverConfig,
    ...data
}: {
    trackingId?: string | null
    serverConfig: McpServerConfig
}) {
    let serverSessionId: string | null = (await headers()).get('Mcp-Session-Id')
    let email: string | undefined = undefined
    let emailUpdated = false
    let trackingIdUpdated = false
    let mcpServerUserId: string | undefined = undefined
    let trackingId: string | undefined | null = data.trackingId

    // First: if the server uses OAuth, try to get the email from the session
    if (serverConfig.authType?.includes('oauth')) {
        const session = await auth.api.getMcpSession({ headers: await headers() })
        if (session?.userId) {
            const [user] = await db
                .select()
                .from(mcpOAuthUser)
                .where(eq(mcpOAuthUser.id, session.userId))
                .limit(1)
            if (user) email = user.email
        }
    }

    // Second: if the session is set, look up the Mcp Server User ID associated with it if present
    if (serverSessionId) {
        const [session] = await db
            .select({
                mcpServerUserId: schema.mcpServerUser.id,
                email: schema.mcpServerUser.email,
                trackingId: schema.mcpServerUser.trackingId
            })
            .from(schema.mcpServerSession)
            .leftJoin(schema.mcpServerUser, eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id))
            .where(eq(schema.mcpServerSession.mcpServerSessionId, serverSessionId))
            .limit(1)

        // Set any information we have found from the session
        if (session.mcpServerUserId && !mcpServerUserId) mcpServerUserId = session.mcpServerUserId
        if (session.email && !email) email = session.email
        if (session.trackingId && !trackingId) trackingId = session.trackingId

        // indicate that we don't have values in the database that match the session
        if (!session.email && email) emailUpdated = true
        if (!session.trackingId && trackingId) trackingIdUpdated = true

        // If we don't have a user ID but we have a tracking ID or email find the user
        if (!mcpServerUserId && (email || trackingId)) {
            const whereClause = email
                ? eq(schema.mcpServerUser.email, email)
                : trackingId
                  ? eq(schema.mcpServerUser.trackingId, trackingId ?? '')
                  : undefined
            if (whereClause) {
                const [u] = await db.select().from(schema.mcpServerUser).where(whereClause).limit(1)
                mcpServerUserId = u?.id
                if (u?.email && !email) email = u.email
                if (u?.trackingId && !trackingId) trackingId = u.trackingId
                if (u?.email && !email) emailUpdated = true
                if (u?.trackingId && !trackingId) trackingIdUpdated = true
            }
        }
    }

    // Third: if the email or tracking ID has been found, try to track the user in the DB
    if (email || trackingId || mcpServerUserId) {
        // If we have the user id AND there was an update to the data, update it
        if (mcpServerUserId && (emailUpdated || trackingIdUpdated)) {
            await db
                .update(schema.mcpServerUser)
                .set({
                    email,
                    trackingId
                })
                .where(eq(schema.mcpServerUser.id, mcpServerUserId))
                .returning()
        } else if (!mcpServerUserId && (email || trackingId)) {
            // Try to insert, but handle conflicts on trackingId (distinct_id)
            const query = db.insert(schema.mcpServerUser).values({
                email,
                trackingId
            })

            // Only handle trackingId conflicts if we have something to update
            if (trackingId) {
                if (email) {
                    query.onConflictDoUpdate({
                        target: [schema.mcpServerUser.trackingId],
                        set: { email }
                    })
                } else {
                    query.onConflictDoNothing()
                }
            }

            const [result] = await query.returning()
            mcpServerUserId = result?.id

            // If we still don't have a user ID, try to find existing user
            if (!mcpServerUserId && (email || trackingId)) {
                const orClause: Array<ReturnType<typeof eq>> = []
                if (email) orClause.push(eq(schema.mcpServerUser.email, email))
                if (trackingId) orClause.push(eq(schema.mcpServerUser.trackingId, trackingId))
                const [mcpServer] = await db
                    .select()
                    .from(schema.mcpServerUser)
                    .where(or(...orClause))
                    .limit(1)
                mcpServerUserId = mcpServer?.id
            }
        }
    }

    // By now we either have the MCP server User ID or we never will

    // If the MCP session ID is set, update the session ID with the user id
    if (serverSessionId && mcpServerUserId) {
        // If this is part of an existing session let's update it
        // now that the MCP server user ID will have been set
        await db
            .update(schema.mcpServerSession)
            .set({
                mcpServerUserId
            })
            .where(eq(schema.mcpServerSession.mcpServerSessionId, serverSessionId))
            .returning()
    } else if (!serverSessionId) {
        // If the server session is not set; we should create a new session.
        // If the user Id is not set it can be linked later once we have it.
        const newSessionId = nanoid(16)
        if (!mcpServerUserId) {
            // Try to insert new user, handling trackingId conflicts
            const query = db.insert(schema.mcpServerUser).values({ trackingId, email })

            if (trackingId) {
                if (email) {
                    query.onConflictDoUpdate({
                        target: [schema.mcpServerUser.trackingId],
                        set: { email }
                    })
                } else {
                    query.onConflictDoNothing()
                }
            }

            const [newUser] = await query.returning()
            mcpServerUserId = newUser.id

            // If we still don't have a user ID, try to find existing user
            if (!mcpServerUserId && (email || trackingId)) {
                const orClause: Array<ReturnType<typeof eq>> = []
                if (email) orClause.push(eq(schema.mcpServerUser.email, email))
                if (trackingId) orClause.push(eq(schema.mcpServerUser.trackingId, trackingId))
                const [existingUser] = await db
                    .select()
                    .from(schema.mcpServerUser)
                    .where(or(...orClause))
                    .limit(1)
                mcpServerUserId = existingUser?.id
            }
        }
        await db
            .insert(schema.mcpServerSession)
            .values({
                mcpServerUserId,
                mcpServerSessionId: newSessionId,
                mcpServerSlug: serverConfig.slug,
                connectionDate: new Date().toISOString(),
                connectionTimestamp: Date.now()
            })
            .returning()
        serverSessionId = newSessionId
    }

    return {
        email,
        mcpServerUserId: mcpServerUserId!,
        trackingId,
        serverSessionId
    }
}
