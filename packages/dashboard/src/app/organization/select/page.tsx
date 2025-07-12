import { SelectOrganization } from '@/components/select-organization'
import { auth } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function SelectOrganizationPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    const results = await db
        .select()
        .from(schema.member)
        .leftJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))

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
