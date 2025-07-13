import { ErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/ui/button'
import { requireSession } from '@/lib/auth/auth'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getUserConnections, getUserData, getUserSupportRequests, getUserToolCalls } from './data'
import { UserDetailClient } from './user-detail-client'

interface UserDetailsPageProps {
    params: Promise<{ identifier: string }>
}

function UserDetailSkeleton() {
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
                <div className="flex items-center gap-3 mb-2">
                    <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                    <div>
                        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-2" />
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    </div>
                </div>
            </div>
            <div className="px-4 lg:px-6">
                <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3 4xl:grid-cols-4">
                    {['card-1', 'card-2', 'card-3', 'card-4'].map((cardId) => (
                        <div key={cardId} className="h-64 bg-muted animate-pulse rounded-lg" />
                    ))}
                </div>
            </div>
        </div>
    )
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
    const connectionsPromise = getUserConnections(user.distinctId || '')
    const toolCallsPromise = getUserToolCalls(session.session.activeOrganizationId)
    const supportRequestsPromise = getUserSupportRequests(user.email || '')

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

            <ErrorBoundary>
                <Suspense fallback={<UserDetailSkeleton />}>
                    <UserDetailClient
                        userPromise={userPromise}
                        connectionsPromise={connectionsPromise}
                        toolCallsPromise={toolCallsPromise}
                        supportRequestsPromise={supportRequestsPromise}
                    />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}
