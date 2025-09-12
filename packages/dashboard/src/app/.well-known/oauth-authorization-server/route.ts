import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    await headers()
    const host = request.headers.get('host')
    if (!host) {
        return new Response('Invalid host; host not found', { status: 404 })
    }
    const requestUrl = new URL(request.url)

    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        console.log('Invalid host; subdomain not found or not valid', { host, parts })
        return new Response('Invalid host; subdomain not found or not valid', { status: 404 })
    }

    const subdomain = parts[0]
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    if (!mcpServerConfiguration) {
        return new Response('Invalid host; subdomain not found', { status: 404 })
    }

    // Use BetterAuth's OAuth discovery metadata IFF they want to use platform OAuth
    if (mcpServerConfiguration.authType === 'platform_oauth') {
        console.log('Using platform OAuth for server', mcpServerConfiguration.name)
        return new Response(JSON.stringify(oauthDiscoveryMetadata(`${requestUrl.protocol}//${host}`)), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        })
    }

    // Support custom oauth via proxy endpoints
    if (mcpServerConfiguration.authType === 'custom_oauth') {
        console.log('Using custom OAuth for server', mcpServerConfiguration.name)
        
        // Check if the server has a custom OAuth configuration
        if (!mcpServerConfiguration.customOAuthConfigId) {
            console.error('Custom OAuth selected but no configuration found for server', mcpServerConfiguration.name)
            return new Response('OAuth configuration not found', { status: 404 })
        }

        // Fetch the OAuth configuration to get the configured scopes
        const [oauthConfig] = await db
            .select()
            .from(schema.customOAuthConfigs)
            .where(eq(schema.customOAuthConfigs.id, mcpServerConfiguration.customOAuthConfigId))
            .limit(1)

        // Return metadata pointing to our proxy endpoints
        const baseUrl = `${requestUrl.protocol}//${host}`
        const metadata = {
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/oauth/authorize`,
            token_endpoint: `${baseUrl}/oauth/token`,
            userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
            jwks_uri: `${baseUrl}/oauth/jwks`,
            registration_endpoint: `${baseUrl}/oauth/register`,
            scopes_supported: oauthConfig?.scopes ? oauthConfig.scopes.split(' ') : ['openid', 'profile', 'email'],
            response_types_supported: ['code'],
            response_modes_supported: ['query'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
            code_challenge_methods_supported: ['S256'],
            claims_supported: ['sub', 'iss', 'aud', 'exp', 'nbf', 'iat', 'jti', 'email', 'email_verified', 'name']
        }

        return new Response(JSON.stringify(metadata), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        })
    }

    // otherwise we don't support this endpoint.
    console.error('[OAuth Discovery] Unsupported auth type:', mcpServerConfiguration.authType)
    return new Response('Not found', { status: 404 })
}

const oauthDiscoveryMetadata = (origin: string) => ({
    issuer: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
    authorization_endpoint: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/mcp-oidc/auth/mcp/authorize`,
    token_endpoint: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/mcp-oidc/auth/mcp/token`,
    userinfo_endpoint: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/mcp-oidc/auth/mcp/userinfo`,
    jwks_uri: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/mcp-oidc/auth/mcp/jwks`,
    registration_endpoint: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL}/mcp-oidc/auth/mcp/register`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code'],
    acr_values_supported: ['urn:mace:incommon:iap:silver', 'urn:mace:incommon:iap:bronze'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'none'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    claims_supported: ['sub', 'iss', 'aud', 'exp', 'nbf', 'iat', 'jti', 'email', 'email_verified', 'name']
})
