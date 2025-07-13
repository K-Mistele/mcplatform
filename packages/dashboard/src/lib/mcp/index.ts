import { init } from 'weave'
import { registerDocumentationSearchTool } from './tools/documentation-search'
import { registerSupportTool } from './tools/support'
import type { McpServer, StaticMcpServerConfig } from './types'
export { protectedResourceHandler } from './protected-resource-handler'
export { withMcpAuth } from './with-mcp-auth'

try {
    init('kylemistele-naptha-ai/quickstart_playground')
} catch (error) {
    console.error(error)
}

/**
 * This function is called by the route handler to configure the MCP server object based on the static configuration from the database.
 * @param server - the MCP server instance
 * @param serverStaticConfiguration - the static configuration for the MCP server from the database
 */
export function configureMcpServer(
    server: McpServer,
    serverStaticConfiguration: StaticMcpServerConfig,
    distinctId?: string
) {
    registerSupportTool(server, serverStaticConfiguration, distinctId)
    registerDocumentationSearchTool(server, serverStaticConfiguration, distinctId)
}
