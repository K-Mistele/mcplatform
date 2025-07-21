import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { McpServer, McpServerConfig } from '../types'

/**
 *
 * @param param0 Thi
 * @returns
 */
export function registerMcpSupportTool({
    server,
    serverConfig,
    trackingId,
    email,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    trackingId: string | null
    email: string | null
    mcpServerUserId: string
    serverSessionId: string
}) {
    // if support is not enabled, do not register a tool
    if (serverConfig.supportTicketType === 'none') return
    if (serverConfig.supportTicketType === 'slack') throw new Error('Slack tickets are not supported yet')
    if (serverConfig.supportTicketType === 'linear') throw new Error('Linear tickets are not supported yet')

    // Otherwise the support ticket type is `dashboard` which is currently supported
    useDashboardSupportBackend({ server, serverConfig, trackingId, email, mcpServerUserId, serverSessionId })
}

function createInputSchema({ serverConfig }: { serverConfig: McpServerConfig }) {
    const baseSchema = z.object({
        title: z.string().describe('A very concise title for the support ticket'),
        problemDescription: z
            .string()
            .describe(
                `A concise explanation of the problem that you (the assistant) or the user are experiencing. Make sure to include any error messages.`
            ),
        problemContext: z
            .string()
            .optional()
            .describe(`
    Include additional context about user's project including what they are using ${serverConfig.productPlatformOrTool} for, which will help us understand the user's problem better. 
    If you don't have much information, you can gather some information first by looking through their codebase or documentation. 
    Do NOT repeat the problem description in the context; it would be better to leave it empty.
    DO NOT UNDER ANY CIRCUMSTANCES include sensitive information like API keys, secrets, environment files, or anything else that could be used to compromise the user's security.
    Be concise and to the point - no need to explain their whole project structure, but make sure to include the pertinent details. We can always ask for more details if needed.
            `)
    })

    if (!serverConfig.authType?.includes('oauth')) {
        return baseSchema.extend({
            email: z
                .string()
                .email()
                .optional()
                .describe('The email address of the user requesting support, if provided')
        })
    }

    return baseSchema
}

/**
 * The "dashboard" backend for the support tool.
 * @param param0
 */
function useDashboardSupportBackend({
    server,
    serverConfig,
    trackingId,
    email,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    trackingId: string | null
    email: string | null
    mcpServerUserId: string
    serverSessionId: string
}) {
    const inputSchema = createInputSchema({ serverConfig })
    server.registerTool(
        'get_support',
        {
            title: `Get support about ${serverConfig.productPlatformOrTool}`,
            description: `Use this tool to get support about ${serverConfig.productPlatformOrTool}. Call this tool when there is an error you are unable to resolve, or if the user expresses frustration about ${serverConfig.productPlatformOrTool}, or while attempting to use/implement it, in order to get speedy expert help!.`,
            inputSchema: inputSchema.shape
        },
        async (args) => {
            // If the user is not authenticated and we don't have an email, ask for it
            if (!email && !('email' in args) && !serverConfig.authType?.includes('oauth')) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: 'To get support, please ask the user to provide their email address and then call this tool again.'
                        }
                    ]
                }
            }
            let submissionEmail: string
            if ('email' in args) submissionEmail = args.email as string
            else if (email) submissionEmail = email
            else
                return {
                    content: [{ type: 'text', text: 'To get support, please log in and then call this tool again.' }]
                }

            // Update the database
            const promises: Array<Promise<unknown>> = [
                db
                    .insert(schema.toolCalls)
                    .values({
                        toolName: 'get_support',
                        input: args,
                        output: 'support_ticket_created',
                        mcpServerId: serverConfig.id,
                        mcpServerSessionId: serverSessionId
                    })
                    .returning(),
                db
                    .insert(schema.supportRequests)
                    .values({
                        title: args.title,
                        conciseSummary: args.problemDescription,
                        context: args.problemContext,
                        email: submissionEmail,
                        organizationId: serverConfig.organizationId,
                        mcpServerId: serverConfig.id,
                        mcpServerSessionId: serverSessionId,
                        status: 'pending'
                    })
                    .returning()
            ]

            // If the user provided an email and we don't have one already insert it
            if (submissionEmail && !email) {
                promises.push(
                    db
                        .update(schema.mcpServerUser)
                        .set({ email: submissionEmail })
                        .where(eq(schema.mcpServerUser.id, mcpServerUserId))
                )
            }

            await Promise.all(promises)

            return {
                content: [
                    { type: 'text', text: 'Support ticket created successfully. The user will be notified via email.' }
                ]
            }
        }
    )
}
