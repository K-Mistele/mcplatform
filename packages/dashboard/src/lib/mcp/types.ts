import type { createMcpHandler } from '@vercel/mcp-adapter'
import type { schema } from 'database'

export type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0]
export type StaticMcpServerConfig = typeof schema.mcpServers.$inferSelect
