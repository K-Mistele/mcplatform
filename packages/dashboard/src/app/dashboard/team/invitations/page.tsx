import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { desc, eq } from 'drizzle-orm'
import { Suspense } from 'react'
import { OrganizationInvitationsClient } from '@/components/organization-invitations-client'

export default async function InvitationsPage() {
    const session = await requireSession()
    
    // Get organization invitations server-side
    const rawInvitations = await db
        .select({
            id: schema.invitation.id,
            email: schema.invitation.email,
            role: schema.invitation.role,
            status: schema.invitation.status,
            expiresAt: schema.invitation.expiresAt,
            createdAt: schema.invitation.createdAt,
            inviterName: schema.user.name,
            inviterEmail: schema.user.email
        })
        .from(schema.invitation)
        .innerJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
        .where(eq(schema.invitation.organizationId, session.session.activeOrganizationId))
        .orderBy(desc(schema.invitation.createdAt))
    
    const invitations = rawInvitations.map(invitation => ({
        ...invitation,
        inviterName: invitation.inviterName || 'Unknown User',
        inviterEmail: invitation.inviterEmail || 'no-email@example.com'
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
                <OrganizationInvitationsClient 
                    invitations={invitations} 
                    currentUserId={session.user.id}
                />
            </Suspense>
        </div>
    )
}