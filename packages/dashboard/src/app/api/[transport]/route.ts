import { configureMcpServer } from '@/lib/mcp'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { createMcpHandler } from 'mcp-handler'
import { type NextRequest, NextResponse } from 'next/server'

async function mcpServerHandler(request: NextRequest) {
    // Pull the slug from the host header and see if we can find a server with that slug.
    const host = request.headers.get('host')
    if (!host) {
        return NextResponse.json({ error: 'Host not found' }, { status: 400 })
    }
    const slug = host.split('.')[0]
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, slug))
        .limit(1)

    if (!mcpServerConfiguration) {
        return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    console.log('initializing MCP server with slug', slug)
    const handler = createMcpHandler(
        async (server) => {
            configureMcpServer(server, mcpServerConfiguration)
        },
        {
            serverInfo: {
                name: mcpServerConfiguration.name,
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
