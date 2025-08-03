'use client'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { ActiveUsersCard } from './active-users-card'
import { CardSkeleton } from './card-skeleton'
import { QuickCreateSection } from './quick-create-section'
import { SupportTicketsCard } from './support-tickets-card'
import { ToolCallsCard } from './tool-calls-card'

export function SectionCards({
    toolCallsPromise,
    supportTicketsPromise,
    activeUsersPromise
}: {
    toolCallsPromise: Promise<{ count: number }>
    supportTicketsPromise: Promise<{ count: number }>
    activeUsersPromise: Promise<{ count: number }>
}) {
    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            <ErrorBoundary fallback={<div>Error</div>}>
                <Suspense fallback={<CardSkeleton />}>
                    <ToolCallsCard toolCallsPromise={toolCallsPromise} />
                </Suspense>
            </ErrorBoundary>

            <ErrorBoundary fallback={<div>Error</div>}>
                <Suspense fallback={<CardSkeleton />}>
                    <SupportTicketsCard supportTicketsPromise={supportTicketsPromise} />
                </Suspense>
            </ErrorBoundary>

            <ErrorBoundary fallback={<div>Error</div>}>
                <Suspense fallback={<CardSkeleton />}>
                    <ActiveUsersCard activeUsersPromise={activeUsersPromise} />
                </Suspense>
            </ErrorBoundary>

            <QuickCreateSection />
        </div>
    )
}
