'use server'

import { requireSession } from '@/lib/auth/auth'
import { fetchOAuthMetadata } from '@/lib/oauth/validate-server'
import { nanoid } from 'common/nanoid'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { base } from '../router'

const { customOAuthConfigs, mcpServers } = schema

// Input schemas
const validateOAuthServerSchema = z.object({
    metadataUrl: z.string().url()
})

const createOAuthConfigSchema = z.object({
    name: z.string().min(1).max(100),
    metadataUrl: z.string().url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    scopes: z.string().min(1).default('openid profile email')
})

const updateOAuthConfigSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(100).optional(),
    metadataUrl: z.string().url().optional(),
    clientId: z.string().min(1).optional(),
    clientSecret: z.string().min(1).optional(),
    scopes: z.string().min(1).optional()
})

const deleteOAuthConfigSchema = z.object({
    id: z.string()
})

// Shared validation logic for OAuth servers
// Type matches the 'errors' parameter from oRPC handlers
async function validateOAuthServer(
    metadataUrl: string,
    errors: {
        INVALID_OAUTH_METADATA: () => Error
        OAUTH_SERVER_UNREACHABLE: () => Error
    }
) {
    console.log('[validateOAuthServer] Starting validation for:', metadataUrl)

    // Use the shared fetchOAuthMetadata function
    const metadata = await fetchOAuthMetadata(metadataUrl)

    if (!metadata) {
        console.error('[validateOAuthServer] Failed to fetch or validate OAuth metadata')
        throw errors.OAUTH_SERVER_UNREACHABLE()
    }

    // Extract authorization URL directly from metadata
    const authorizationUrl = metadata.authorization_endpoint
    console.log('[validateOAuthServer] Successfully validated, auth URL:', authorizationUrl)

    // Build the full metadata URL (the function handles .well-known path)
    let fullMetadataUrl = metadataUrl
    if (!fullMetadataUrl.includes('/.well-known/')) {
        fullMetadataUrl = fullMetadataUrl.replace(/\/$/, '')
        fullMetadataUrl = `${fullMetadataUrl}/.well-known/oauth-authorization-server`
    }

    return {
        success: true,
        metadata,
        authorizationUrl,
        metadataUrl: fullMetadataUrl
    }
}

// Validate OAuth Server Action
export const validateOAuthServerAction = base
    .input(validateOAuthServerSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            throw errors.UNAUTHORIZED()
        }

        return await validateOAuthServer(input.metadataUrl, errors)
    })
    .actionable({})

// Create OAuth Configuration Action
export const createOAuthConfigAction = base
    .input(createOAuthConfigSchema)
    .handler(async ({ input, errors }) => {
        console.log('[createOAuthConfigAction] Starting with input:', {
            name: input.name,
            metadataUrl: input.metadataUrl,
            clientId: input.clientId.substring(0, 10) + '...',
            hasClientSecret: !!input.clientSecret
        })

        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            console.error('[createOAuthConfigAction] No active organization ID')
            throw errors.UNAUTHORIZED()
        }

        const organizationId = session.session.activeOrganizationId
        console.log('[createOAuthConfigAction] Organization ID:', organizationId)

        // First validate the OAuth server - it will throw if validation fails
        console.log('[createOAuthConfigAction] Validating OAuth server...')
        const validation = await validateOAuthServer(input.metadataUrl, errors)
        // No need to check validation.success - the function throws on error
        console.log('[createOAuthConfigAction] Validation successful')

        // Extract token URL from metadata
        const tokenUrl = validation.metadata.token_endpoint
        console.log('[createOAuthConfigAction] Token URL:', tokenUrl)

        // Check if a config with this name already exists for the organization
        console.log('[createOAuthConfigAction] Checking for duplicate name:', input.name)
        try {
            const existing = await db
                .select()
                .from(customOAuthConfigs)
                .where(
                    and(eq(customOAuthConfigs.organizationId, organizationId), eq(customOAuthConfigs.name, input.name))
                )
                .limit(1)

            console.log('[createOAuthConfigAction] Duplicate check completed, found:', existing.length, 'configs')

            if (existing.length > 0) {
                console.error('[createOAuthConfigAction] Duplicate name found')
                throw errors.RESOURCE_ALREADY_EXISTS()
            }
        } catch (queryError) {
            console.error('[createOAuthConfigAction] Error checking for duplicates:', queryError)
            throw queryError
        }

        // Create the configuration
        try {
            console.log('[createOAuthConfigAction] Creating new config in database...')
            const [config] = await db
                .insert(customOAuthConfigs)
                .values({
                    id: `coac_${nanoid(8)}`,
                    organizationId,
                    name: input.name,
                    metadataUrl: validation.metadataUrl,
                    authorizationUrl: validation.authorizationUrl,
                    tokenUrl,
                    clientId: input.clientId,
                    clientSecret: input.clientSecret, // TODO: Encrypt before storing
                    scopes: input.scopes
                })
                .returning()

            console.log('[createOAuthConfigAction] Successfully created config:', config.id)

            revalidatePath('/dashboard/oauth-configs')
            revalidatePath('/dashboard/mcp-servers')

            return config
        } catch (dbError) {
            console.error('[createOAuthConfigAction] Database insert failed:', dbError)
            throw dbError
        }
    })
    .actionable({})

// Update OAuth Configuration Action
export const updateOAuthConfigAction = base
    .input(updateOAuthConfigSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            throw errors.UNAUTHORIZED()
        }

        const organizationId = session.session.activeOrganizationId

        // Check if the config exists and belongs to the organization
        const [existing] = await db
            .select()
            .from(customOAuthConfigs)
            .where(and(eq(customOAuthConfigs.id, input.id), eq(customOAuthConfigs.organizationId, organizationId)))
            .limit(1)

        if (!existing) {
            throw errors.RESOURCE_NOT_FOUND()
        }

        // If metadata URL is being updated, validate it first
        let authorizationUrl = existing.authorizationUrl
        let tokenUrl = existing.tokenUrl
        let metadataUrl = existing.metadataUrl
        if (input.metadataUrl && input.metadataUrl !== existing.metadataUrl) {
            const validation = await validateOAuthServer(input.metadataUrl, errors)
            // No need to check validation.success - the function throws on error
            authorizationUrl = validation.authorizationUrl
            tokenUrl = validation.metadata.token_endpoint
            metadataUrl = validation.metadataUrl
        }

        // Update the configuration
        const [updated] = await db
            .update(customOAuthConfigs)
            .set({
                ...(input.name && { name: input.name }),
                ...(input.metadataUrl && { metadataUrl, authorizationUrl, tokenUrl }),
                ...(input.clientId && { clientId: input.clientId }),
                ...(input.clientSecret && { clientSecret: input.clientSecret }), // TODO: Encrypt before storing
                ...(input.scopes && { scopes: input.scopes })
            })
            .where(eq(customOAuthConfigs.id, input.id))
            .returning()

        revalidatePath('/dashboard/oauth-configs')
        revalidatePath('/dashboard/mcp-servers')

        return updated
    })
    .actionable({})

// Delete OAuth Configuration Action
export const deleteOAuthConfigAction = base
    .input(deleteOAuthConfigSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            throw errors.UNAUTHORIZED()
        }

        const organizationId = session.session.activeOrganizationId

        // Check if the config exists and belongs to the organization
        const [existing] = await db
            .select()
            .from(customOAuthConfigs)
            .where(and(eq(customOAuthConfigs.id, input.id), eq(customOAuthConfigs.organizationId, organizationId)))
            .limit(1)

        if (!existing) {
            throw errors.RESOURCE_NOT_FOUND({ message: 'OAuth configuration not found' })
        }

        // Check if any MCP servers are using this configuration
        const serversUsingConfig = await db
            .select()
            .from(mcpServers)
            .where(eq(mcpServers.customOAuthConfigId, input.id))
            .limit(1)

        if (serversUsingConfig.length > 0) {
            throw errors.RESOURCE_IN_USE({ message: 'Cannot delete OAuth configuration that is in use by MCP servers' })
        }

        // Delete the configuration
        await db.delete(customOAuthConfigs).where(eq(customOAuthConfigs.id, input.id))

        revalidatePath('/dashboard/oauth-configs')

        return { success: true }
    })
    .actionable({})

// List OAuth Configurations for Organization
export const listOAuthConfigsAction = base
    .handler(async ({ errors }) => {
        const session = await requireSession()

        // If no active organization, return empty array instead of throwing
        if (!session.session?.activeOrganizationId) {
            console.warn('No active organization when fetching OAuth configs')
            return []
        }

        const organizationId = session.session.activeOrganizationId

        try {
            const configs = await db
                .select()
                .from(customOAuthConfigs)
                .where(eq(customOAuthConfigs.organizationId, organizationId))
                .orderBy(customOAuthConfigs.createdAt)

            return configs
        } catch (error) {
            console.error('Error fetching OAuth configs:', error)
            // Return empty array on error rather than throwing
            return []
        }
    })
    .actionable({})
