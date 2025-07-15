import { auth } from '@/lib/auth/mcp/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import z from 'zod'
import type { McpServer, McpServerConfig } from '../types'

/**
 * Zod schemas for tool arguments
 * @param productPlatformOrToolName this
 * @returns
 */
const problemDescriptionSchema = (productPlatformOrToolName: string) =>
    z
        .string()
        .describe(
            `A concise explanation of the problem that you (the assistant) or the user are experiencing. Make sure to include any error messages.`
        )

const contextSchema = (productPlatformOrToolName: string) =>
    z
        .string()
        .optional()
        .describe(`
Include additional context about user's project including what they are using ${productPlatformOrToolName} for, which will help us understand the user's problem better. 
If you don't have much information, you can gather some information first by looking through their codebase or documentation. 
Do NOT repeat the problem description in the context; it would be better to leave it empty.
DO NOT UNDER ANY CIRCUMSTANCES include sensitive information like API keys, secrets, environment files, or anything else that could be used to compromise the user's security.
Be concise and to the point - no need to explain their whole project structure, but make sure to include the pertinent details. We can always ask for more details if needed.
        `)

const inputSchemaWithoutEmail = (staticConfig: McpServerConfig) =>
    z.object({
        title: z.string().describe('A very concise title for the support ticket'),
        problemDescription: problemDescriptionSchema(staticConfig.productPlatformOrTool),
        context: contextSchema(staticConfig.productPlatformOrTool)
    })

const inputSchemaWithEmail = (staticConfig: McpServerConfig) =>
    inputSchemaWithoutEmail(staticConfig).extend({
        email: z.string().email().optional().describe('The email address of the user requesting support, if provided')
    })

/**
 * Entrypoint to create a support ticket for the MCP server.
 * @param mcpServer
 * @param staticConfig
 * @returns
 */
export async function registerSupportTool(
    mcpServer: McpServer,
    staticConfig: McpServerConfig,
    trackingId: string | null
) {
    if (staticConfig.supportTicketType === 'none') {
        return
    }

    if (staticConfig.supportTicketType === 'slack') {
        throw new Error('Slack support tickets are not implemented yet')
    }

    if (staticConfig.supportTicketType === 'linear') {
        throw new Error('Linear support tickets are not implemented yet')
    }

    if (staticConfig.supportTicketType === 'dashboard') {
        if (staticConfig.authType === 'collect_email') {
            registerSupportToolWithEmail(mcpServer, staticConfig, trackingId)
        } else {
            registerSupportToolWithOAuth(mcpServer, staticConfig, trackingId)
        }
    }

    return {}
}

function registerSupportToolWithEmail(mcpServer: McpServer, staticConfig: McpServerConfig, trackingId: string | null) {
    const inputSchema = inputSchemaWithEmail(staticConfig)
    mcpServer.registerTool(
        'get_support',
        {
            title: `Get support about ${staticConfig.productPlatformOrTool}`,
            description: `Use this tool to get support about ${staticConfig.productPlatformOrTool}. Call this tool when there is an error you are unable to resolve, or if the user expresses frustration about ${staticConfig.productPlatformOrTool}, or while attempting to use/implement it, in order to get speedy expert help!.`,
            inputSchema: inputSchema.shape
        },
        async ({ context, problemDescription, email, title }) => {
            if (!email) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'To get support, please ask the user to provide their email address and then call this tool again.'
                        }
                    ]
                }
            }

            // update the database
            const promises: Array<Promise<any>> = [
                db.insert(schema.toolCalls).values({
                    toolName: 'get_support',
                    input: { context, problemDescription, email, title },
                    output: 'support_ticket_created',
                    mcpServerId: staticConfig.id
                }),
                db.insert(schema.supportRequests).values({
                    title: title,
                    conciseSummary: problemDescription,
                    context: context,
                    email: email,
                    organizationId: staticConfig.organizationId,
                    mcpServerId: staticConfig.id,
                    status: 'pending'
                })
            ]

            if (trackingId) {
                promises.push(
                    db
                        .update(schema.mcpServerUser)
                        .set({ email })
                        .where(eq(schema.mcpServerUser.distinctId, trackingId))
                )

                console.log('trackingId', trackingId)
                console.log('email', email)
            }
            if (!trackingId) {
                promises.push(
                    db.insert(schema.mcpServerUser).values({
                        distinctId: null,
                        email: email
                    })
                )
                console.log('trackingId', trackingId)
                console.log('email', email)
            }

            await Promise.all(promises)

            return {
                content: [
                    {
                        type: 'text',
                        text: 'Support ticket created successfully. The user will be notified via email.'
                    }
                ]
            }
        }
    )
}

function registerSupportToolWithOAuth(mcpServer: McpServer, staticConfig: McpServerConfig, trackingId: string | null) {
    const inputSchema = inputSchemaWithoutEmail(staticConfig)
    mcpServer.registerTool(
        'get_support',
        {
            title: `Get support about ${staticConfig.productPlatformOrTool}`,
            description: `Use this tool to get support about ${staticConfig.productPlatformOrTool}. Call this tool when there is an error you are unable to resolve, or if the user expresses frustration about ${staticConfig.productPlatformOrTool}, or while attempting to use/implement it, in order to get speedy expert help!.`,
            inputSchema: inputSchema.shape
        },
        async ({ context, problemDescription, title }) => {
            console.log('trying to get session for oauth support tool')
            const session = await auth.api.getMcpSession({
                headers: await headers()
            })
            if (!session) {
                console.log('no session found')
                return { content: [{ type: 'text', text: 'You must be logged in to get support' }] }
            }
            console.log('session found', session)

            const [mcpUser] = await db
                .select()
                .from(schema.mcpOAuthUser)
                .where(eq(schema.mcpOAuthUser.id, session.userId))
            if (!mcpUser) {
                console.log('no mcp user found')
                return { content: [{ type: 'text', text: 'You must be logged in to get support' }] }
            }
            const email = mcpUser.email

            const promises: Array<Promise<any>> = [
                db.insert(schema.toolCalls).values({
                    toolName: 'get_support',
                    input: { context, problemDescription, email, title },
                    output: 'support_ticket_created',
                    mcpServerId: staticConfig.id
                }),
                db.insert(schema.supportRequests).values({
                    title: title,
                    conciseSummary: problemDescription,
                    context: context,
                    email: email,
                    organizationId: staticConfig.organizationId,
                    mcpServerId: staticConfig.id,
                    status: 'pending'
                })
            ]

            if (trackingId) {
                promises.push(
                    db
                        .update(schema.mcpServerUser)
                        .set({ email })
                        .where(eq(schema.mcpServerUser.distinctId, trackingId))
                )

                console.log('trackingId', trackingId)
                console.log('email', email)
            }
            if (!trackingId) {
                promises.push(
                    db.insert(schema.mcpServerUser).values({
                        distinctId: null,
                        email: email
                    })
                )
                console.log('trackingId', trackingId)
                console.log('email', email)
            }

            await Promise.all(promises)
            return {
                content: [
                    {
                        type: 'text',
                        text: 'Support ticket created successfully. The user will be notified via email.'
                    }
                ]
            }
        }
    )
}
