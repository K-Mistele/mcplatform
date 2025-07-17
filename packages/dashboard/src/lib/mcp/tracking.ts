import { nanoid } from 'common/nanoid'
/**
 * This is where behavioral tracking for MCP servers is implemented.
 * TODO this needs to user something faster than postgres.
 */
import { db, mcpAuthSchema, schema } from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '../auth/mcp/auth'
import type { McpServerConfig } from './types'

/**
 * Given an email or trackingID, track the user in the database.
 * If an email is provided, it will be used to track the user.
 * Otherwise they will remain anonymous until the trackingId is provided.
 * @param data
 */
export async function getAndTrackMcpServerUser(data: {
    email?: string | null
    trackingId: string | null
    serverConfig: McpServerConfig
}) {
    let { email, trackingId, serverConfig } = data

    // If the user is authorized via OAuth, we can use the user's email to track them by looking
    //  up the user ID from the session and then querying from the database
    if (!email && serverConfig.authType?.includes('oauth')) {
        const session = await auth.api.getMcpSession({
            headers: await headers()
        })
        console.log(`ACCESS TOKEN:`, session?.accessToken, `USER ID:`, session?.userId)
        if (session?.userId) {
            try {
                const [user] = await db
                    .select()
                    .from(mcpAuthSchema.mcpOAuthUser)
                    .where(eq(mcpAuthSchema.mcpOAuthUser.id, session.userId))
                    .limit(1)
                if (user) email = user.email
            } catch {
                console.error(`user not found after insertion   `)
            }
        }
    }

    if (email || trackingId) {
        console.log(`email:`, email, `trackingId:`, trackingId)
        const query = db.insert(schema.mcpServerUser).values({
            trackingId,
            email
        })

        if (email) {
            query.onConflictDoUpdate({
                target: [schema.mcpServerUser.trackingId],
                set: {
                    email: email
                }
            })
        } else {
            query.onConflictDoNothing()
        }
        const [mcpServerUser] = await query.returning()
        let mcpServerUserId: string | undefined = mcpServerUser?.id
        if (!mcpServerUserId && trackingId) {
            const [mcpServer] = await db
                .select()
                .from(schema.mcpServerUser)
                .where(eq(schema.mcpServerUser.trackingId, trackingId ?? ''))
                .limit(1)
            mcpServerUserId = mcpServer?.id
        }

        let serverSessionId: string | null = (await headers()).get('Mcp-Session-Id')
        const headersAreNew: boolean = !serverSessionId
        if (headersAreNew || !serverSessionId) {
            serverSessionId = nanoid(12)
            const date = new Date()
            await db
                .insert(schema.mcpServerSession)
                .values({
                    mcpServerUserId: mcpServerUserId,
                    mcpServerSessionId: serverSessionId,
                    mcpServerSlug: serverConfig.slug,
                    connectionDate: date.toISOString(),
                    connectionTimestamp: date.getTime()
                })
                .onConflictDoNothing()
        }

        return {
            email,
            trackingId,
            mcpServerUserId: mcpServerUserId,
            session: {
                id: serverSessionId,
                isNew: headersAreNew
            }
        }
    }
    console.warn(`unable to identify user - no email, no tracking ID`)
    return null // unable to identify user - no email, no tracking ID
}

export async function trackToolCall(data: {
    trackingId: string | null
    email: string | null
    toolName: string
    inputData: any
    outputData: any
    serverConfig: McpServerConfig
}) {
    console.log('TODO -- TRACK TOOL CALL!')
}
