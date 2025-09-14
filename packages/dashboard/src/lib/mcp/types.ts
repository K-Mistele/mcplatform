import type { createMcpHandler } from '@vercel/mcp-adapter'
import type { OAuthAccessToken } from 'better-auth/plugins'
import type { schema } from 'database'

export type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0]
export type McpServerConfig = typeof schema.mcpServers.$inferSelect

export type NotNeither<A, B> = (A | B) | (A & B)

// Extended session type to support both platform OAuth and proxy tokens
export type McpSessionWithType = OAuthAccessToken | {
    tokenType: 'proxy'
    accessToken: string
    userId: string
    expiresAt?: number | null
}
