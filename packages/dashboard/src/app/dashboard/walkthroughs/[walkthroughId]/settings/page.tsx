import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, MapIcon } from 'lucide-react'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CardSkeleton } from '@/components/card-skeleton'
import { ServerAssignmentSection } from '@/components/server-assignment-section'
import { PublicationStatusCard } from '@/components/publication-status-card'
import { WalkthroughDeletionCard } from '@/components/walkthrough-deletion-card'
import { requireSession } from '@/lib/auth/auth'

interface WalkthroughSettingsPageProps {
    params: Promise<{ walkthroughId: string }>
}

export default async function WalkthroughSettingsPage(props: WalkthroughSettingsPageProps) {
    const session = await requireSession()
    const params = await props.params
    
    // Verify walkthrough exists and belongs to organization
    const [walkthrough] = await db
        .select()
        .from(schema.walkthroughs)
        .where(
            and(
                eq(schema.walkthroughs.id, params.walkthroughId),
                eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
            )
        )
        .limit(1)
    
    if (!walkthrough) {
        notFound()
    }

    // Fetch available servers for the organization
    const availableServersPromise = db
        .select({
            id: schema.mcpServers.id,
            name: schema.mcpServers.name,
            slug: schema.mcpServers.slug
        })
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))

    // Fetch servers this walkthrough is assigned to
    const assignedServersPromise = db
        .select({
            id: schema.mcpServers.id,
            name: schema.mcpServers.name,
            slug: schema.mcpServers.slug,
            isEnabled: schema.mcpServerWalkthroughs.isEnabled
        })
        .from(schema.mcpServerWalkthroughs)
        .innerJoin(schema.mcpServers, eq(schema.mcpServerWalkthroughs.mcpServerId, schema.mcpServers.id))
        .where(eq(schema.mcpServerWalkthroughs.walkthroughId, params.walkthroughId))

    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="flex items-center gap-4 mb-4">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/walkthroughs">
                            <ArrowLeftIcon className="h-4 w-4" />
                            Back to Walkthroughs
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/dashboard/walkthroughs/${params.walkthroughId}/edit`}>
                            Edit Walkthrough
                        </Link>
                    </Button>
                </div>

                <div className="flex items-center gap-3 mb-2">
                    <MapIcon className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold">{walkthrough.title}</h1>
                        <p className="text-muted-foreground">Walkthrough Settings</p>
                    </div>
                </div>
            </div>

            <div className="px-4 lg:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
                    {/* Publication Status Card */}
                    <PublicationStatusCard walkthrough={walkthrough} />
                    
                    {/* Server Assignment Section */}
                    <ErrorBoundary
                        fallback={
                            <Card>
                                <CardContent className="text-center py-8">
                                    <p className="text-destructive">Failed to load server assignments</p>
                                </CardContent>
                            </Card>
                        }
                    >
                        <Suspense fallback={<CardSkeleton />}>
                            <ServerAssignmentSection
                                walkthroughId={params.walkthroughId}
                                availableServersPromise={availableServersPromise}
                                assignedServersPromise={assignedServersPromise}
                            />
                        </Suspense>
                    </ErrorBoundary>
                </div>
                
                {/* Danger Zone Section */}
                <div className="max-w-7xl mx-auto mt-8">
                    <h2 className="text-lg font-semibold text-destructive mb-4">Danger Zone</h2>
                    <WalkthroughDeletionCard 
                        walkthroughId={params.walkthroughId}
                        walkthroughTitle={walkthrough.title}
                    />
                </div>
            </div>
        </div>
    )
}