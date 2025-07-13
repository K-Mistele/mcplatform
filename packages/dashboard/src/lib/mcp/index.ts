import type { McpServer } from './types'
export type { McpServer } from './types'

import type { schema } from 'database'
type StaticMcpServerConfig = typeof schema.mcpServers.$inferSelect

export function configureMcpServer(server: McpServer, serverStaticConfiguration: StaticMcpServerConfig) {}
