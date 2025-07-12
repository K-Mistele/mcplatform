import { requireSession } from '@/lib/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'

export default async function McpServersPage() {
    const session = await requireSession()

    const servers = db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))

    return <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6" />
}
