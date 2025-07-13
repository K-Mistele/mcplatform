import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const host = request.headers.get('host')
    if (!host) {
        return new Response('Invalid host; host not found', { status: 404 })
    }

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
        return new Response(
            JSON.stringify(oauthDiscoveryMetadata(`${host.includes('localhost') ? 'http' : 'https'}://${host}`)),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400'
                }
            }
        )
    }

    // TODO - support custom oauth / openid connect
    if (mcpServerConfiguration.authType === 'custom_oauth') {
        console.log('Using custom OAuth for server', mcpServerConfiguration.name)
        return new Response('Not implemented', { status: 501 })
    }

    // otherwise we don't support this endpoint.
    return new Response('Not found', { status: 404 })
}

const oauthDiscoveryMetadata = (origin: string) => ({
    issuer: origin,
    authorization_endpoint: `${origin}/authtenant/auth/mcp/authorize`,
    token_endpoint: `${origin}/authtenant/auth/mcp/token`,
    userinfo_endpoint: `${origin}/authtenant/auth/mcp/userinfo`,
    jwks_uri: `${origin}/authtenant/auth/mcp/jwks`,
    registration_endpoint: `${origin}/authtenant/auth/mcp/register`,
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
