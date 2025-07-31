import { ErrorBoundary } from '@/components/error-boundary'
import { WalkthroughEditor } from '@/components/walkthrough-editor'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { and, asc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

interface WalkthroughEditorPageProps {
    params: Promise<{ walkthroughId: string }>
    searchParams: Promise<{ step?: string }>
}

export default async function WalkthroughEditorPage({ params, searchParams }: WalkthroughEditorPageProps) {
    const session = await requireSession()

    // Await params and searchParams before accessing properties (Next.js 15)
    const { walkthroughId } = await params
    const { step } = await searchParams

    const [walkthrough] = await db
        .select()
        .from(schema.walkthroughs)
        .where(
            and(
                eq(schema.walkthroughs.id, walkthroughId),
                eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
            )
        )
        .limit(1)

    if (!walkthrough) {
        notFound()
    }

    const walkthroughPromise = Promise.resolve(walkthrough)
    const stepsPromise = db
        .select()
        .from(schema.walkthroughSteps)
        .where(eq(schema.walkthroughSteps.walkthroughId, walkthroughId))
        .orderBy(asc(schema.walkthroughSteps.displayOrder))
    const selectedStepId = step || null

    return (
        <div className="h-screen flex flex-col">
            <ErrorBoundary>
                <Suspense
                    fallback={
                        <div className="h-full flex items-center justify-center">
                            <div className="space-y-4 text-center">
                                <div className="h-8 bg-gray-200 rounded animate-pulse w-64 mx-auto" />
                                <div className="h-4 bg-gray-200 rounded animate-pulse w-48 mx-auto" />
                            </div>
                        </div>
                    }
                >
                    <WalkthroughEditor
                        walkthroughPromise={walkthroughPromise}
                        stepsPromise={stepsPromise}
                        selectedStepId={selectedStepId}
                    />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}
