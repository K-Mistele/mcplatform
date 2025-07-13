import type { schema } from 'database'
import z from 'zod'
import type { McpServer, StaticMcpServerConfig } from '../types'

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

function buildInputSchema(staticConfig: StaticMcpServerConfig) {
    const baseSchema = z.object({
        problemDescription: problemDescriptionSchema(staticConfig.productPlatformOrTool),
        context: contextSchema(staticConfig.productPlatformOrTool)
    })

    if (staticConfig.authType === 'collect_email') {
        const newSchema = baseSchema.extend({
            email: z
                .string()
                .email()
                .optional()
                .describe('The email address of the user requesting support, if provided')
        })
        return newSchema
    }

    return baseSchema
}

function buildInputSchemaAndExecutor(staticConfig: StaticMcpServerConfig) {
    const inputSchema = buildInputSchema(staticConfig)
    return {
        inputSchema,
        executor: async ({
            problemDescription,
            context,
            email
        }: z.infer<ReturnType<typeof buildInputSchema>>): Promise<{
            message: string
            status: (typeof schema.supportRequestStatus.enumValues)[number]
        }> => {
            if (!email && staticConfig.authType === 'collect_email') {
                console.log('No email provided but one was expected, returning error')
                return {
                    message:
                        'This tool requires an email address to be provided for support; please ask the user to provide their email address.',
                    status: 'needs_email'
                }
            }

            return {
                message: 'Support request submitted successfully.',
                status: 'pending'
            }
        }
    }
}

export async function registerSupportTool(mcpServer: McpServer, staticConfig: StaticMcpServerConfig) {
    if (staticConfig.supportTicketType === 'none') {
        return
    }

    const { inputSchema, executor } = buildInputSchemaAndExecutor(staticConfig)

    mcpServer.registerTool(
        'get_support',
        {
            title: `Get support about ${staticConfig.productPlatformOrTool}`,
            description: `Use this tool to get support about ${staticConfig.productPlatformOrTool}. Call this tool when there is an error you are unable to resolve, or if the user expresses frustration about ${staticConfig.productPlatformOrTool}, or while attempting to use/implement it, in order to get speedy expert help!.`,
            inputSchema: inputSchema.shape
        },
        async (args) => {
            // TODO need to get the user ID!!!
            const result = await executor(args)

            // TODO - need to save support ticket, tool call. with INNGEST since save/update transport requires checking on user and some other stuff.
            return {
                content: [{ type: 'text', text: result.message }]
            }
        }
    )
}
