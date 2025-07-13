import z from 'zod'
import { inngest } from '../../inngest/client'
import type { RequestDashboardSupportEvent } from '../../inngest/functions'
import type { McpServer, StaticMcpServerConfig } from '../types'

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
        .describe(
            `
            Any additional context about user's project including what they are using ${productPlatformOrToolName} for, what their use-case is, what tech stack they are working with, etc. This will help us understand the user's problem better.
            DO NOT UNDER ANY CIRCUMSTANCES include sensitive information like API keys, secrets, environment files, or anything else that could be used to compromise the user's security.
            Be concise and to the point - no need to explain their whole project structure, but make sure to include the pertinent details. We can always ask for more details if needed.
            `
        )

const inputSchemaWithoutEmail = (staticConfig: StaticMcpServerConfig) =>
    z.object({
        problemDescription: problemDescriptionSchema(staticConfig.productPlatformOrTool),
        context: contextSchema(staticConfig.productPlatformOrTool)
    })

const inputSchemaWithEmail = (staticConfig: StaticMcpServerConfig) =>
    inputSchemaWithoutEmail(staticConfig).extend({
        email: z.string().email().optional().describe('The email address of the user requesting support, if provided')
    })

/**
 * Entrypoint to create a support ticket for the MCP server.
 * @param mcpServer
 * @param staticConfig
 * @returns
 */
export async function registerSupportTool(mcpServer: McpServer, staticConfig: StaticMcpServerConfig) {
    if (staticConfig.supportTicketType === 'none') {
        return
    }

    if (staticConfig.supportTicketType === 'slack') {
        throw new Error('Slack support tickets are not implemented yet')
    }

    if (staticConfig.supportTicketType === 'linear') {
        throw new Error('Linear support tickets are not implemented yet')
    }

    if (staticConfig.authType === 'collect_email') {
        registerSupportToolWithEmail(mcpServer, staticConfig)
    } else {
        throw new Error('Support tickets are not implemented for this MCP server')
    }

    return {}
}

function registerSupportToolWithEmail(mcpServer: McpServer, staticConfig: StaticMcpServerConfig) {
    const inputSchema = inputSchemaWithEmail(staticConfig)
    mcpServer.registerTool(
        'get support',
        {
            title: `Get support about ${staticConfig.productPlatformOrTool}`,
            description: `Use this tool to get support about ${staticConfig.productPlatformOrTool}. Call this tool when there is an error you are unable to resolve, or if the user expresses frustration about ${staticConfig.productPlatformOrTool}, or while attempting to use/implement it, in order to get speedy expert help!.`,
            inputSchema: inputSchema.shape
        },
        async ({ context, problemDescription, email }) => {
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
            await createDashboardSupportTicket({
                summary: problemDescription,
                context: context,
                email,
                staticConfig
            })
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

async function createDashboardSupportTicket(data: {
    summary: string
    context?: string
    email: string
    staticConfig: StaticMcpServerConfig
}) {
    await inngest.send({
        name: 'mcp-server/support.requested.dashboard',
        data: {
            summary: data.summary,
            context: data.context,
            email: data.email,
            organizationId: data.staticConfig.organizationId
        } satisfies RequestDashboardSupportEvent
    })
}
