import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { desc, eq } from 'drizzle-orm'

export default async function SupportTicketsPage() {
    const session = await requireSession()
    const supportTickets = await db
        .select()
        .from(schema.supportRequests)
        .where(eq(schema.supportRequests.organizationId, session.session.activeOrganizationId))
        .orderBy(desc(schema.supportRequests.createdAt))
}
