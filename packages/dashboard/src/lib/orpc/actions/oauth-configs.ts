'use server'

import { z } from 'zod'
import { base } from '../router'
import { requireSession } from '@/lib/auth/auth'
import { db } from '@/lib/db'
import { customOAuthConfigs } from 'database/schema'
import { eq, and } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { nanoid } from 'common/nanoid'

// RFC 8414 OAuth Authorization Server Metadata Schema
const oauthMetadataSchema = z.object({
    issuer: z.string().url(),
    authorization_endpoint: z.string().url(),
    token_endpoint: z.string().url(),
    jwks_uri: z.string().url().optional(),
    userinfo_endpoint: z.string().url().optional(),
    registration_endpoint: z.string().url().optional(),
    scopes_supported: z.array(z.string()).optional(),
    response_types_supported: z.array(z.string()).optional(),
    grant_types_supported: z.array(z.string()).optional(),
    token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
    code_challenge_methods_supported: z.array(z.string()).optional()
})

// Input schemas
const validateOAuthServerSchema = z.object({
    metadataUrl: z.string().url()
})

const createOAuthConfigSchema = z.object({
    name: z.string().min(1).max(100),
    metadataUrl: z.string().url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1)
})

const updateOAuthConfigSchema = z.object({
    id: z.string(),
    name: z.string().min(1).max(100).optional(),
    metadataUrl: z.string().url().optional(),
    clientId: z.string().min(1).optional(),
    clientSecret: z.string().min(1).optional()
})

const deleteOAuthConfigSchema = z.object({
    id: z.string()
})

// Validate OAuth Server Action
export const validateOAuthServerAction = base
    .input(validateOAuthServerSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            throw errors.UNAUTHORIZED('No active organization')
        }

        try {
            // Automatically append the well-known path if not already present
            let fullMetadataUrl = input.metadataUrl
            if (!fullMetadataUrl.includes('/.well-known/')) {
                // Remove trailing slash if present
                fullMetadataUrl = fullMetadataUrl.replace(/\/$/, '')
                fullMetadataUrl = `${fullMetadataUrl}/.well-known/oauth-authorization-server`
            }

            // Fetch the OAuth metadata
            const response = await fetch(fullMetadataUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(10000) // 10 second timeout
            })

            if (!response.ok) {
                throw new Error(`OAuth server returned ${response.status}: ${response.statusText}`)
            }

            const metadata = await response.json()

            // Validate against RFC 8414 schema
            const validatedMetadata = oauthMetadataSchema.parse(metadata)

            // Extract authorization URL directly from metadata
            const authorizationUrl = validatedMetadata.authorization_endpoint

            return {
                success: true,
                metadata: validatedMetadata,
                authorizationUrl,
                metadataUrl: fullMetadataUrl
            }
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw errors.INVALID_OAUTH_METADATA('Invalid OAuth server metadata format')
            }
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    throw errors.OAUTH_SERVER_UNREACHABLE('OAuth server request timed out')
                }
                throw errors.OAUTH_SERVER_UNREACHABLE(error.message)
            }
            throw errors.OAUTH_SERVER_UNREACHABLE('Failed to validate OAuth server')
        }
    })
    .actionable({})

// Create OAuth Configuration Action
export const createOAuthConfigAction = base
    .input(createOAuthConfigSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            throw errors.UNAUTHORIZED('No active organization')
        }

        const organizationId = session.session.activeOrganizationId

        // First validate the OAuth server
        const validation = await validateOAuthServerAction({ metadataUrl: input.metadataUrl })
        if (!validation.success) {
            throw errors.INVALID_OAUTH_METADATA('Failed to validate OAuth server')
        }

        // Check if a config with this name already exists for the organization
        const existing = await db
            .select()
            .from(customOAuthConfigs)
            .where(
                and(
                    eq(customOAuthConfigs.organizationId, organizationId),
                    eq(customOAuthConfigs.name, input.name)
                )
            )
            .limit(1)

        if (existing.length > 0) {
            throw errors.RESOURCE_ALREADY_EXISTS('An OAuth configuration with this name already exists')
        }

        // Create the configuration
        const [config] = await db
            .insert(customOAuthConfigs)
            .values({
                id: `coac_${nanoid(8)}`,
                organizationId,
                name: input.name,
                metadataUrl: validation.metadataUrl,
                authorizationUrl: validation.authorizationUrl,
                clientId: input.clientId,
                clientSecret: input.clientSecret // TODO: Encrypt before storing
            })
            .returning()

        revalidatePath('/dashboard/oauth-configs')
        revalidatePath('/dashboard/mcp-servers')

        return config
    })
    .actionable({})

// Update OAuth Configuration Action
export const updateOAuthConfigAction = base
    .input(updateOAuthConfigSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            throw errors.UNAUTHORIZED('No active organization')
        }

        const organizationId = session.session.activeOrganizationId

        // Check if the config exists and belongs to the organization
        const [existing] = await db
            .select()
            .from(customOAuthConfigs)
            .where(
                and(
                    eq(customOAuthConfigs.id, input.id),
                    eq(customOAuthConfigs.organizationId, organizationId)
                )
            )
            .limit(1)

        if (!existing) {
            throw errors.RESOURCE_NOT_FOUND('OAuth configuration not found')
        }

        // If metadata URL is being updated, validate it first
        let authorizationUrl = existing.authorizationUrl
        let metadataUrl = existing.metadataUrl
        if (input.metadataUrl && input.metadataUrl !== existing.metadataUrl) {
            const validation = await validateOAuthServerAction({ metadataUrl: input.metadataUrl })
            if (!validation.success) {
                throw errors.INVALID_OAUTH_METADATA('Failed to validate new OAuth server')
            }
            authorizationUrl = validation.authorizationUrl
            metadataUrl = validation.metadataUrl
        }

        // Update the configuration
        const [updated] = await db
            .update(customOAuthConfigs)
            .set({
                ...(input.name && { name: input.name }),
                ...(input.metadataUrl && { metadataUrl, authorizationUrl }),
                ...(input.clientId && { clientId: input.clientId }),
                ...(input.clientSecret && { clientSecret: input.clientSecret }) // TODO: Encrypt before storing
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
            throw errors.UNAUTHORIZED('No active organization')
        }

        const organizationId = session.session.activeOrganizationId

        // Check if the config exists and belongs to the organization
        const [existing] = await db
            .select()
            .from(customOAuthConfigs)
            .where(
                and(
                    eq(customOAuthConfigs.id, input.id),
                    eq(customOAuthConfigs.organizationId, organizationId)
                )
            )
            .limit(1)

        if (!existing) {
            throw errors.RESOURCE_NOT_FOUND('OAuth configuration not found')
        }

        // Check if any MCP servers are using this configuration
        const { mcpServers } = await import('database/schema')
        const serversUsingConfig = await db
            .select()
            .from(mcpServers)
            .where(eq(mcpServers.customOAuthConfigId, input.id))
            .limit(1)

        if (serversUsingConfig.length > 0) {
            throw errors.RESOURCE_IN_USE('Cannot delete OAuth configuration that is in use by MCP servers')
        }

        // Delete the configuration
        await db
            .delete(customOAuthConfigs)
            .where(eq(customOAuthConfigs.id, input.id))

        revalidatePath('/dashboard/oauth-configs')

        return { success: true }
    })
    .actionable({})

// List OAuth Configurations for Organization
export const listOAuthConfigsAction = base
    .handler(async ({ errors }) => {
        const session = await requireSession()
        if (!session.session?.activeOrganizationId) {
            throw errors.UNAUTHORIZED('No active organization')
        }

        const organizationId = session.session.activeOrganizationId

        const configs = await db
            .select()
            .from(customOAuthConfigs)
            .where(eq(customOAuthConfigs.organizationId, organizationId))
            .orderBy(customOAuthConfigs.createdAt)

        return configs
    })
    .actionable({})