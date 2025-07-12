import { requireSession } from '@/lib/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'

export default async function McpServersPage() {
    const session = await requireSession()

    const servers = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
}
