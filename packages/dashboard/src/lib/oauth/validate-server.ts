import { z } from 'zod'

// RFC 8414 OAuth Authorization Server Metadata Schema
export const oauthMetadataSchema = z.object({
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

export type OAuthMetadata = z.infer<typeof oauthMetadataSchema>

/**
 * Fetches and validates OAuth server metadata from a discovery URL
 * @param metadataUrl The base URL of the OAuth server
 * @returns The validated OAuth metadata or null on error
 */
export async function fetchOAuthMetadata(metadataUrl: string): Promise<OAuthMetadata | null> {
    try {
        // Automatically append the well-known path if not already present
        let fullMetadataUrl = metadataUrl
        if (!fullMetadataUrl.includes('/.well-known/')) {
            // Remove trailing slash if present
            fullMetadataUrl = fullMetadataUrl.replace(/\/$/, '')

            // Special handling for Google - they use OpenID Connect discovery
            fullMetadataUrl = `${fullMetadataUrl}/.well-known/oauth-authorization-server`
        }

        console.log('[fetchOAuthMetadata] Fetching metadata from:', fullMetadataUrl)

        // Fetch the OAuth metadata
        const response = await fetch(fullMetadataUrl, {
            method: 'GET',
            headers: {
                Accept: 'application/json'
            },
            signal: AbortSignal.timeout(10000) // 10 second timeout
        })

        if (!response.ok) {
            console.error('[fetchOAuthMetadata] Failed to fetch:', response.status, response.statusText)
            return null
        }

        const metadata = await response.json()

        // Validate against RFC 8414 schema
        const validatedMetadata = oauthMetadataSchema.parse(metadata)

        console.log('[fetchOAuthMetadata] Successfully validated, issuer:', validatedMetadata.issuer)
        return validatedMetadata
    } catch (error) {
        console.error('[fetchOAuthMetadata] Error:', error)
        if (error instanceof z.ZodError) {
            console.error('[fetchOAuthMetadata] Schema validation failed:', error.errors)
        }
        return null
    }
}
