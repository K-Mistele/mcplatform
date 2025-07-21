import { UserDetailClient } from '@/components/user-detail-client'
import { UserDetailSkeleton } from '@/components/user-detail-skeleton'
import { Button } from '@/components/ui/button'
import { requireSession } from '@/lib/auth/auth'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { 
    getUserConnections, 
    getUserData, 
    getUserSessions, 
    getUserSupportRequests, 
    getUserToolCalls,
    getSessionToolCalls,
    getSessionSupportTickets
} from './data'

interface UserDetailsPageProps {
    params: Promise<{ identifier: string }>
    searchParams: Promise<{ 
        session?: string
        item?: string
        type?: string
    }>
}

export default async function UserDetailsPage(props: UserDetailsPageProps) {
    const session = await requireSession()
    const params = await props.params
    const searchParams = await props.searchParams
    const identifier = decodeURIComponent(params.identifier)

    // Extract URL state
    const selectedSessionId = searchParams.session || null
    const selectedItemId = searchParams.item || null
    const selectedItemType = searchParams.type || null

    // Check if user exists first
    const user = await getUserData(identifier)
    if (!user) {
        notFound()
    }

    // Fetch base data only
    const userData = await getUserData(identifier)
    const connections = await getUserConnections(user.trackingId || '')
    const toolCalls = await getUserToolCalls(session.session.activeOrganizationId)
    const supportRequests = await getUserSupportRequests(user.email || '')
    const sessions = await getUserSessions(user.id, session.session.activeOrganizationId)

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
                        user={userData}
                        connections={connections}
                        toolCalls={toolCalls}
                        supportRequests={supportRequests}
                        sessions={sessions}
                    />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}
