import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { desc, eq } from 'drizzle-orm'
import { Suspense } from 'react'
import { OrganizationMembersClient } from '@/components/organization-members-client'

export default async function MembersPage() {
    const session = await requireSession()
    
    // Get organization members server-side
    const rawMembers = await db
        .select({
            id: schema.member.id,
            userId: schema.member.userId,
            role: schema.member.role,
            createdAt: schema.member.createdAt,
            name: schema.user.name,
            email: schema.user.email,
            image: schema.user.image
        })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
        .where(eq(schema.member.organizationId, session.session.activeOrganizationId))
        .orderBy(desc(schema.member.createdAt))
    
    const members = rawMembers.map(member => ({
        ...member,
        name: member.name || 'Unknown User',
        email: member.email || 'no-email@example.com',
        role: member.role as 'owner' | 'admin' | 'member'
    }))
    
    return (
        <div className="px-4 lg:px-6">
            <Suspense fallback={
                <div className="animate-pulse">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <div className="h-6 bg-muted rounded w-48 mb-2"></div>
                            <div className="h-4 bg-muted rounded w-64"></div>
                        </div>
                        <div className="h-10 bg-muted rounded w-32"></div>
                    </div>
                    <div className="space-y-3">
                        <div className="h-4 bg-muted rounded w-full"></div>
                        <div className="h-4 bg-muted rounded w-5/6"></div>
                        <div className="h-4 bg-muted rounded w-4/6"></div>
                    </div>
                </div>
            }>
                <OrganizationMembersClient 
                    members={members} 
                    currentUserId={session.user.id}
                />
            </Suspense>
        </div>
    )
}