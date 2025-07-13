import { configureMcpServer } from '@/lib/mcp'
import { createMcpHandler } from '@vercel/mcp-adapter'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

async function mcpServerHandler(
    request: NextRequest,
    { params }: { params: Promise<{ transport: string; nanoid: string }> }
) {
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

    // Now we create the MCP server

    console.log('initializing MCP server with slug', slug)
    const handler = createMcpHandler(
        async (server) => {
            configureMcpServer(server, mcpServerConfiguration)
            server.server.oninitialized = async () => {
                const { nanoid, transport } = await params
                await db.insert(schema.mcpServerUser).values({
                    distinctId: nanoid,
                    transport: transport
                })
            }
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
