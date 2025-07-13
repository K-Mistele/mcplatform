import type { createMcpHandler } from '@vercel/mcp-adapter'
import type { schema } from 'database'

export type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0]
type DbMcpServer = typeof schema.mcpServers.$inferSelect

export const serverDescription = (server: DbMcpServer) => {
    return `
    This MCP server is called ${server.name}.

    The server 
    `
}
