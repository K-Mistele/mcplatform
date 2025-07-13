import { SelectOrganization } from '@/components/select-organization'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export default async function SelectOrganizationPage() {
    const session = await requireSession({ data: { organizationRequired: false } })

    const results = await db
        .select()
        .from(schema.member)
        .leftJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
        .where(eq(schema.member.userId, session.session.userId))

    const organizations = results.map((result) => ({
        organization: result.organization,
        member: result.member
    }))

    if (!session) {
        redirect('/login')
    }

    return (
        <div className="flex flex-col w-full flex-grow items-center justify-center h-screen">
            <SelectOrganization organizations={organizations} />
        </div>
    )
}
