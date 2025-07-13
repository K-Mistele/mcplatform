import { createMcpHandler } from '@vercel/mcp-adapter'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

async function mcpServerHandler(request: NextRequest, ...otherArgs: any[]) {
    // Pull the slug from the host header and see if we can find a server with that slug.
    const host = request.headers.get('host')
    if (!host) {
        return NextResponse.json({ error: 'Host not found' }, { status: 400 })
    }
    const slug = host.split('.')[0]
    const [mcpServer] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.slug, slug)).limit(1)

    if (!mcpServer) {
        return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    // Now we create the MCP server

    console.log('initializing MCP server with slug', slug)
    const handler = createMcpHandler(
        async (server) => {
            // Async tool with external API call
            server.registerTool(
                'roll-die',
                {
                    title: 'Roll a die',
                    description: 'Roll an N-sided die',
                    inputSchema: z.object({
                        sides: z.number().int().min(2).describe('The number of sides on the die')
                    }).shape
                },
                async ({ sides }) => {
                    const value = 1 + Math.floor(Math.random() * sides)
                    return {
                        content: [{ type: 'text', text: `🎲 You rolled a ${value}!` }]
                    }
                }
            )
        },
        {
            serverInfo: {
                name: 'test-server',
                version: '1.0.0'
            }
        },
        {
            redisUrl: process.env.REDIS_URL,
            basePath: '/api'
        }
    )

    return await handler(request)
}

export { mcpServerHandler as GET, mcpServerHandler as POST }
