import { OAuthConfigsClient } from '@/components/oauth-configs-client'
import { Skeleton } from '@/components/ui/skeleton'
import { requireSession } from '@/lib/auth/auth'
import { db, schema } from 'database'
import { eq, sql } from 'drizzle-orm'
import { Suspense } from 'react'

export const metadata = {
    title: 'OAuth Configurations | MCPlatform',
    description: 'Manage OAuth configurations for your organization'
}

async function getOAuthConfigs(organizationId: string) {
    const { customOAuthConfigs, mcpServers } = schema

    // Get OAuth configs with usage count
    const configs = await db
        .select({
            id: customOAuthConfigs.id,
            name: customOAuthConfigs.name,
            metadataUrl: customOAuthConfigs.metadataUrl,
            authorizationUrl: customOAuthConfigs.authorizationUrl,
            clientId: customOAuthConfigs.clientId,
            createdAt: customOAuthConfigs.createdAt,
            usageCount: sql<number>`
                (SELECT COUNT(*) FROM ${mcpServers} 
                WHERE ${mcpServers.customOAuthConfigId} = ${customOAuthConfigs.id})
            `
        })
        .from(customOAuthConfigs)
        .where(eq(customOAuthConfigs.organizationId, organizationId))
        .orderBy(customOAuthConfigs.createdAt)

    return configs
}

function OAuthConfigsSkeleton() {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
}

export default async function OAuthConfigsPage() {
    const session = await requireSession()

    if (!session.session?.activeOrganizationId) {
        throw new Error('No active organization')
    }

    const organizationId = session.session.activeOrganizationId

    // Create promise for data
    const configsPromise = getOAuthConfigs(organizationId)

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">OAuth Configurations</h2>
                    <p className="text-muted-foreground">Manage OAuth server configurations for your organization</p>
                </div>
            </div>

            <Suspense fallback={<OAuthConfigsSkeleton />}>
                <OAuthConfigsClient configsPromise={configsPromise} />
            </Suspense>
        </div>
    )
}
