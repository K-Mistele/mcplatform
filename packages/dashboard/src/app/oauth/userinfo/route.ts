import { db, schema } from 'database'
import { and, eq, gt } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    await headers()
    
    // Extract the access token from the Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({
            error: 'invalid_request',
            error_description: 'Missing or invalid Authorization header'
        }), {
            status: 401,
            headers: { 
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Bearer'
            }
        })
    }

    const accessToken = authHeader.slice(7) // Remove 'Bearer ' prefix

    // Look up the proxy token
    const [proxyToken] = await db
        .select()
        .from(schema.mcpProxyTokens)
        .where(
            and(
                eq(schema.mcpProxyTokens.accessToken, accessToken),
                gt(schema.mcpProxyTokens.expiresAt, Date.now())
            )
        )
        .limit(1)

    if (!proxyToken) {
        return new Response(JSON.stringify({
            error: 'invalid_token',
            error_description: 'Invalid or expired access token'
        }), {
            status: 401,
            headers: { 
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Bearer error="invalid_token"'
            }
        })
    }

    // Get the upstream token
    const [upstreamToken] = await db
        .select()
        .from(schema.upstreamOAuthTokens)
        .where(eq(schema.upstreamOAuthTokens.id, proxyToken.upstreamTokenId))
        .limit(1)

    if (!upstreamToken) {
        return new Response(JSON.stringify({
            error: 'server_error',
            error_description: 'Upstream token not found'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // Check if upstream token has expired
    if (upstreamToken.expiresAt && upstreamToken.expiresAt < Date.now()) {
        // TODO: Implement refresh token flow for upstream tokens
        return new Response(JSON.stringify({
            error: 'token_expired',
            error_description: 'Upstream token has expired'
        }), {
            status: 401,
            headers: { 
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Bearer error="invalid_token"'
            }
        })
    }

    // Get the OAuth configuration
    const [customOAuthConfig] = await db
        .select()
        .from(schema.customOAuthConfigs)
        .where(eq(schema.customOAuthConfigs.id, upstreamToken.oauthConfigId))
        .limit(1)

    if (!customOAuthConfig) {
        return new Response(JSON.stringify({
            error: 'server_error',
            error_description: 'OAuth configuration not found'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // Get the userinfo endpoint from metadata
    const userinfoUrl = await getUserinfoUrlFromMetadata(customOAuthConfig.metadataUrl)
    
    if (!userinfoUrl) {
        // If no userinfo endpoint, return a minimal response with the user ID
        return new Response(JSON.stringify({
            sub: upstreamToken.mcpServerUserId,
            // We don't have other user info without the userinfo endpoint
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    try {
        // Call the upstream userinfo endpoint
        const userinfoResponse = await fetch(userinfoUrl, {
            headers: {
                'Authorization': `Bearer ${upstreamToken.accessToken}`
            }
        })

        if (!userinfoResponse.ok) {
            console.error('Upstream userinfo request failed:', userinfoResponse.status)
            
            // If upstream fails, return minimal info
            return new Response(JSON.stringify({
                sub: upstreamToken.mcpServerUserId
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const userinfo = await userinfoResponse.json()
        
        // Update the user ID in our database if we have a sub from upstream
        if (userinfo.sub && upstreamToken.mcpServerUserId !== userinfo.sub) {
            await db
                .update(schema.upstreamOAuthTokens)
                .set({ mcpServerUserId: userinfo.sub })
                .where(eq(schema.upstreamOAuthTokens.id, upstreamToken.id))
        }

        // Return the user info to the MCP client
        return new Response(JSON.stringify(userinfo), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('Error fetching upstream userinfo:', error)
        
        // On error, return minimal info
        return new Response(JSON.stringify({
            sub: upstreamToken.mcpServerUserId
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

// Helper function to get userinfo URL from metadata
async function getUserinfoUrlFromMetadata(metadataUrl: string): Promise<string | null> {
    try {
        const response = await fetch(metadataUrl)
        if (response.ok) {
            const metadata = await response.json()
            return metadata.userinfo_endpoint || null
        }
    } catch (error) {
        console.error('Failed to fetch OAuth metadata:', error)
    }
    return null
}

// Handle CORS preflight
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization',
            'Access-Control-Max-Age': '86400'
        }
    })
}