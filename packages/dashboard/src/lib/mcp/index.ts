import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { createMcpHandler } from 'mcp-handler'
import { registerDocumentationSearchTool } from './tools/documentation-search'
import { registerSupportTool } from './tools/support'
import type { McpServer, McpServerConfig } from './types'
export { protectedResourceHandler } from './protected-resource-handler'
export { withMcpAuth } from './with-mcp-auth'

/**
 * This function is called by the route handler to configure the MCP server object based on the static configuration from the database.
 * @param server - the MCP server instance
 * @param serverStaticConfiguration - the static configuration for the MCP server from the database
 */
export function configureMcpServer({
    server,
    serverConfig,
    trackingId
}: {
    server: McpServer
    serverConfig: McpServerConfig
    trackingId: string | null
}) {
    registerSupportTool(server, serverConfig, trackingId)
    registerDocumentationSearchTool(server, serverConfig, trackingId)
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
    const requestUrl = new URL(request.headers.get('host') ?? request.url)

    const thisUrlDomainSegments = thisUrl.hostname.split('.')
    const requestUrlDomainSegments = requestUrl.hostname.split('.')

    if (thisUrl.hostname === requestUrl.hostname)
        throw new Error('MCP server connections must use the configured VHost')

    const requestIsOneLevelUnderApplicationOnSameDomain =
        requestUrlDomainSegments.length === thisUrlDomainSegments.length + 1 &&
        requestUrlDomainSegments.slice(-thisUrlDomainSegments.length).join('.') === thisUrlDomainSegments.join('.')

    // TODO support arbitrary domains for customers
    if (!requestIsOneLevelUnderApplicationOnSameDomain) {
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
 * Create a route handler for the MCP server based on things like if it needs oauth or not.
 * @param serverConfig
 */
export function createHandlerForServer({
    serverConfig,
    trackingId
}: {
    serverConfig: McpServerConfig
    trackingId: string | null
}) {
    const mcpHandler = createMcpHandler(async (server) => {
        configureMcpServer({
            server,
            serverConfig,
            trackingId
        })
    })
}
