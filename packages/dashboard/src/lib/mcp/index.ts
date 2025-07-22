import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { auth } from '../auth/mcp/auth'
import { registerMcpSupportTool } from './tools/support'
import { walkthroughTools } from './tools/walkthrough'
import type { McpServer, McpServerConfig } from './types'
import { withMcpAuth } from './with-mcp-auth'
export { protectedResourceHandler } from './protected-resource-handler'

/**
 * Create a route handler for the MCP server based on things like if it needs oauth or not.
 * @param serverConfig
 */
export function createHandlerForServer({
    serverConfig,
    trackingId,
    email,
    mcpServerUserId,
    serverSessionId
}: {
    serverConfig: McpServerConfig
    trackingId: string | null
    email: string | null
    mcpServerUserId: string
    serverSessionId: string
}): (req: Request) => Promise<Response> {
    const mcpHandler = createMcpHandler(
        async (server) => {
            await registerMcpServerToolsFromConfig({
                server,
                serverConfig,
                trackingId,
                email,
                mcpServerUserId,
                serverSessionId
            })
        },
        {
            serverInfo: {
                name: serverConfig.name,
                version: '1.0.0'
            }
        },
        {
            redisUrl: process.env.REDIS_URL,
            // This sets the base path for other MCP server routes; because of the variadic URL param we need to set the tracking ID
            //  here if it's set in this request; otherwise we can't
            basePath: trackingId ? `/api/mcpserver/${trackingId}` : `/api/mcpserver`,
            verboseLogs: true,
            disableSse: true,
            onEvent(event) {
                if (event.type === 'ERROR') {
                    console.error(`MCP ERROR:`, event)
                    // TODO we should track errors somehow
                } else if (event.type === 'REQUEST_RECEIVED') {
                    console.log(`MCP REQUEST RECEIVED:`, event)
                } else if (event.type === 'REQUEST_COMPLETED') {
                    console.log(`MCP REQUEST COMPLETED:`, event)
                } else {
                    console.log(`MCP EVENT:`, event)
                }
            }
        }
    )

    if (!serverConfig.authType?.includes('oauth')) {
        return mcpHandler
    }

    return withMcpAuth(auth, mcpHandler)
}

/**
 * This function is called by the route handler to configure the MCP server object based on the static configuration from the database.
 * @param server - the MCP server instance
 * @param serverStaticConfiguration - the static configuration for the MCP server from the database
 */
export async function registerMcpServerToolsFromConfig({
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
    // Always register support tool
    registerMcpSupportTool({ server, serverConfig, trackingId, email, mcpServerUserId, serverSessionId })

    // Conditionally register walkthrough tools if server has walkthroughs and tools are enabled
    if (serverConfig.walkthroughToolsEnabled === 'true') {
        const hasWalkthroughs = await checkServerHasWalkthroughs(serverConfig.id)
        
        if (hasWalkthroughs) {
            registerWalkthroughTools({
                server,
                mcpServerId: serverConfig.id,
                mcpServerUserId,
                serverSessionId
            })
        }
    }
}

/**
 * This function is called by the route handler to look up the MCP server configuration based on the request URL.
 * @param request - the request object
 * @returns the MCP server configuration if found, otherwise null. throws() if the request is not valid.
 */
export async function getMcpServerConfiguration(request: Request) {
    // convert the better auth url (our app's base URL) to a URL object
    if (!process.env.NEXT_PUBLIC_BETTER_AUTH_URL) throw new Error('NEXT_PUBLIC_BETTER_AUTH_URL is not set')
    const thisUrl = new URL(process.env.NEXT_PUBLIC_BETTER_AUTH_URL)

    // Convert the URL from the host header or the request URL; fall back on the request URL if the host header is not present.
    console.log({
        url: request.url,
        host: request.headers.get('host')
    })
    const requestHost = request.headers.get('host') ?? new URL(request.url).host
    const requestHostname = requestHost.split(':')[0]

    const thisUrlDomainSegments = thisUrl.hostname.split('.')
    const requestUrlDomainSegments = requestHostname.split('.')

    if (thisUrl.hostname === requestHostname) throw new Error('MCP server connections must use the configured VHost')

    const requestIsOneLevelUnderApplicationOnSameDomain =
        requestUrlDomainSegments.length === thisUrlDomainSegments.length + 1 &&
        requestUrlDomainSegments.slice(-thisUrlDomainSegments.length).join('.') === thisUrlDomainSegments.join('.')

    // TODO support arbitrary domains for customers
    if (!requestIsOneLevelUnderApplicationOnSameDomain) {
        console.log({
            thisUrlDomainSegments,
            requestUrlDomainSegments
        })
        throw new Error('MCP server must be accessed via a direct subdomain of the application')
    }

    // Extract the subdomain (first segment) -- this should match the MCP server's slug
    const subdomain = requestUrlDomainSegments[0]

    // Look up the MCP server configuration by subdomain
    const [serverConfig] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    return serverConfig ?? null // return null if not found, return config if found; throw error for bad request.
}

/**
 * Check if an MCP server has any published walkthroughs linked to it
 */
async function checkServerHasWalkthroughs(mcpServerId: string): Promise<boolean> {
    const walkthroughCount = await db
        .select({
            count: schema.mcpServerWalkthroughs.id
        })
        .from(schema.mcpServerWalkthroughs)
        .innerJoin(schema.walkthroughs, eq(schema.walkthroughs.id, schema.mcpServerWalkthroughs.walkthroughId))
        .where(
            and(
                eq(schema.mcpServerWalkthroughs.mcpServerId, mcpServerId),
                eq(schema.walkthroughs.status, 'published')
            )
        )
        .limit(1)

    return walkthroughCount.length > 0
}

/**
 * Register all walkthrough tools with the MCP server
 */
function registerWalkthroughTools({
    server,
    mcpServerId,
    mcpServerUserId,
    serverSessionId
}: {
    server: McpServer
    mcpServerId: string
    mcpServerUserId: string
    serverSessionId: string
}) {
    const toolContext = {
        mcpServerId,
        mcpServerUserId,
        serverSessionId
    }

    // Register all walkthrough tools
    Object.entries(walkthroughTools).forEach(([toolName, { tool, handler }]) => {
        server.registerTool(
            toolName,
            {
                title: tool.description,
                description: tool.description,
                inputSchema: z.object({}).shape // Use empty schema for now, proper validation is in handlers
            },
            async (args) => {
                // Convert args format to request format expected by handlers
                const request = {
                    method: 'tools/call' as const,
                    params: {
                        name: toolName,
                        arguments: args
                    }
                }
                return handler(request, toolContext)
            }
        )
    })
}
