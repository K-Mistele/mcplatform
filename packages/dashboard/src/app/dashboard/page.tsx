import { auth } from '@/lib/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        redirect('/login')
    }

    const memberships = await db.select().from(schema.member).where(eq(schema.member.userId, session.user.id))
    if (memberships.length === 0) {
        redirect('/dashboard/organization/new')
    }
    if (memberships.length > 1 && !session.session.activeOrganizationId) {
        redirect('/dashboard/organization/select')
    }

    return <div>Dashboard (you have {memberships.length} organizations)</div>
}
