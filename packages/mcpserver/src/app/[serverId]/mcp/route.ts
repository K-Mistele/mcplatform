import { db, schema } from 'database'
import { eq } from 'drizzle-orm'

export async function GET(request: Request, { params }: { params: Promise<{ serverId: string }> }) {
    const { serverId } = await params

    const [server] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.id, serverId))
    if (!server) {
        console.error(`MCP server ${serverId} not found`)
        return new Response('MCP server not found', { status: 404 })
    }
}
