import { db, schema } from 'database'
import { and, eq, gt } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    console.log('[OAuth UserInfo] UserInfo request received')
    
    await headers()
    
    // Extract the access token from the Authorization header
    const authHeader = request.headers.get('authorization')
    console.log('[OAuth UserInfo] Authorization header present:', !!authHeader)
    
    if (!authHeader?.startsWith('Bearer ')) {
        console.error('[OAuth UserInfo] Missing or invalid Authorization header')
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
    console.log('[OAuth UserInfo] Access token prefix:', accessToken.substring(0, 15) + '...')

    // Look up the proxy token
    console.log('[OAuth UserInfo] Looking up proxy token')
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
        console.error('[OAuth UserInfo] Proxy token not found or expired')
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
    console.log('[OAuth UserInfo] Fetching upstream token:', proxyToken.upstreamTokenId)
    const [upstreamToken] = await db
        .select()
        .from(schema.upstreamOAuthTokens)
        .where(eq(schema.upstreamOAuthTokens.id, proxyToken.upstreamTokenId))
        .limit(1)

    if (!upstreamToken) {
        console.error('[OAuth UserInfo] Upstream token not found')
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
        console.error('[OAuth UserInfo] Upstream token expired:', {
            expiresAt: upstreamToken.expiresAt,
            now: Date.now()
        })
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
    console.log('[OAuth UserInfo] Getting userinfo URL from metadata:', customOAuthConfig.metadataUrl)
    const userinfoUrl = await getUserinfoUrlFromMetadata(customOAuthConfig.metadataUrl)
    
    if (!userinfoUrl) {
        console.log('[OAuth UserInfo] No userinfo endpoint found, returning minimal response')
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
        console.log('[OAuth UserInfo] Calling upstream userinfo endpoint:', userinfoUrl)
        const userinfoResponse = await fetch(userinfoUrl, {
            headers: {
                'Authorization': `Bearer ${upstreamToken.accessToken}`
            }
        })

        if (!userinfoResponse.ok) {
            console.error('[OAuth UserInfo] Upstream userinfo request failed:', userinfoResponse.status)
            
            // If upstream fails, return minimal info
            return new Response(JSON.stringify({
                sub: upstreamToken.mcpServerUserId
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        const userinfo = await userinfoResponse.json()
        console.log('[OAuth UserInfo] Received userinfo:', {
            sub: userinfo.sub,
            hasEmail: !!userinfo.email,
            hasName: !!userinfo.name
        })
        
        // Update the user ID in our database if we have a sub from upstream
        if (userinfo.sub && upstreamToken.mcpServerUserId !== userinfo.sub) {
            console.log('[OAuth UserInfo] Updating user ID from', upstreamToken.mcpServerUserId, 'to', userinfo.sub)
            await db
                .update(schema.upstreamOAuthTokens)
                .set({ mcpServerUserId: userinfo.sub })
                .where(eq(schema.upstreamOAuthTokens.id, upstreamToken.id))
        }

        // Return the user info to the MCP client
        console.log('[OAuth UserInfo] Returning userinfo to MCP client')
        return new Response(JSON.stringify(userinfo), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        })

    } catch (error) {
        console.error('[OAuth UserInfo] Error fetching upstream userinfo:', error)
        
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
        console.log('[OAuth UserInfo] Fetching metadata from:', metadataUrl)
        const response = await fetch(metadataUrl)
        if (response.ok) {
            const metadata = await response.json()
            const userinfoEndpoint = metadata.userinfo_endpoint || null
            console.log('[OAuth UserInfo] UserInfo endpoint from metadata:', userinfoEndpoint)
            return userinfoEndpoint
        }
    } catch (error) {
        console.error('[OAuth UserInfo] Failed to fetch OAuth metadata:', error)
    }
    return null
}

// Handle CORS preflight
export async function OPTIONS() {
    console.log('[OAuth UserInfo] CORS preflight request received')
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