import { registerSupportTool } from './tools/support'
import type { McpServer, StaticMcpServerConfig } from './types'

/**
 * This function is called by the route handler to configure the MCP server object based on the static configuration from the database.
 * @param server - the MCP server instance
 * @param serverStaticConfiguration - the static configuration for the MCP server from the database
 */
export function configureMcpServer(server: McpServer, serverStaticConfiguration: StaticMcpServerConfig) {
    registerSupportTool(server, serverStaticConfiguration)
}
