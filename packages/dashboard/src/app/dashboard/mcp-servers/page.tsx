import { McpServersTable } from '@/components/mcp-servers-table'
import { requireSession } from '@/lib/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'

export default async function McpServersPage() {
    const session = await requireSession()

    const servers = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">MCP Servers</h1>
                    <p className="text-muted-foreground">Manage your Model Context Protocol servers</p>
                </div>
            </div>
            <div className="px-4 lg:px-6">
                <McpServersTable data={servers} />
            </div>
        </div>
    )
}
