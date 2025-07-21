import { UserDetailClient } from '@/components/user-detail-client'
import { UserDetailSkeleton } from '@/components/user-detail-skeleton'
import { Button } from '@/components/ui/button'
import { requireSession } from '@/lib/auth/auth'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { getUserConnections, getUserData, getUserSessions, getUserSupportRequests, getUserToolCalls } from './data'

interface UserDetailsPageProps {
    params: Promise<{ identifier: string }>
}



export default async function UserDetailsPage(props: UserDetailsPageProps) {
    const session = await requireSession()
    const params = await props.params
    const identifier = decodeURIComponent(params.identifier)

    // Check if user exists first
    const user = await getUserData(identifier)
    if (!user) {
        notFound()
    }

    // Create promises for data fetching (don't await them)
    const userPromise = getUserData(identifier)
    const connectionsPromise = getUserConnections(user.trackingId || '')
    const toolCallsPromise = getUserToolCalls(session.session.activeOrganizationId)
    const supportRequestsPromise = getUserSupportRequests(user.email || '')
    const sessionsPromise = getUserSessions(user.id, session.session.activeOrganizationId)

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/users">
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Users
                        </Link>
                    </Button>
                </div>
            </div>

            <ErrorBoundary fallback={<div>Error</div>}>
                <Suspense fallback={<UserDetailSkeleton />}>
                    <UserDetailClient
                        userPromise={userPromise}
                        connectionsPromise={connectionsPromise}
                        toolCallsPromise={toolCallsPromise}
                        supportRequestsPromise={supportRequestsPromise}
                        sessionsPromise={sessionsPromise}
                        organizationId={session.session.activeOrganizationId}
                    />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}
