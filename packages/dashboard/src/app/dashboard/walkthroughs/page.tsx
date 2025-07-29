import { db, schema } from 'database'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Suspense } from 'react'
import { WalkthroughsClient } from '@/components/walkthroughs-client'
import { requireSession } from '@/lib/auth/auth'

async function getWalkthroughsData(organizationId: string) {
    return db
        .select({
            walkthrough: schema.walkthroughs,
            stepCount: sql<number>`count(${schema.walkthroughSteps.id})`
        })
        .from(schema.walkthroughs)
        .leftJoin(schema.walkthroughSteps, eq(schema.walkthroughSteps.walkthroughId, schema.walkthroughs.id))
        .where(eq(schema.walkthroughs.organizationId, organizationId))
        .groupBy(schema.walkthroughs.id)
        .orderBy(desc(schema.walkthroughs.createdAt))
}

export default async function WalkthroughsPage() {
    const session = await requireSession()
    const walkthroughsPromise = getWalkthroughsData(session.session.activeOrganizationId)

    return (
        <div className="container mx-auto px-4 py-8">
            <Suspense
                fallback={
                    <div className="space-y-4">
                        <div className="h-8 bg-gray-200 rounded animate-pulse" />
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
                        <div className="h-64 bg-gray-200 rounded animate-pulse" />
                    </div>
                }
            >
                <WalkthroughsClient walkthroughsPromise={walkthroughsPromise} />
            </Suspense>
        </div>
    )
}