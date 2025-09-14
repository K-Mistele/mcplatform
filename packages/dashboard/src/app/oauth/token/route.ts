import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { verifyPKCEChallenge } from '@/lib/oauth/pkce'

export const dynamic = 'force-dynamic'

// Helper function to add CORS headers to all responses
function corsHeaders(headers: Record<string, string> = {}) {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': 'true',
        ...headers
    }
}

// OAuth token request schema per RFC 6749 with PKCE
const tokenRequestSchema = z.object({
    grant_type: z.enum(['authorization_code', 'refresh_token']),
    code: z.string().optional(),
    redirect_uri: z.string().url().optional(),
    refresh_token: z.string().optional(),
    client_id: z.string().optional(),
    client_secret: z.string().optional(),
    // RFC 7636: code_verifier = 43-128 characters from unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
    code_verifier: z.string().min(43).max(128).regex(/^[A-Za-z0-9\-._~]+$/).optional()
})

export async function POST(request: NextRequest) {
    await headers()
    
    console.log('[OAuth Token] Incoming request')
    console.log('[OAuth Token] Method:', request.method)
    console.log('[OAuth Token] URL:', request.url)
    console.log('[OAuth Token] Headers:', Object.fromEntries(request.headers.entries()))
    
    // Parse the request body
    const contentType = request.headers.get('content-type')
    console.log('[OAuth Token] Content-Type:', contentType)
    
    let body: any
    
    try {
        if (contentType?.includes('application/x-www-form-urlencoded')) {
            const text = await request.text()
            console.log('[OAuth Token] Raw form body:', text)
            body = Object.fromEntries(new URLSearchParams(text))
            console.log('[OAuth Token] Parsed form body:', body)
        } else if (contentType?.includes('application/json')) {
            body = await request.json()
            console.log('[OAuth Token] JSON body:', body)
        } else {
            console.log('[OAuth Token] ERROR: Unsupported content type:', contentType)
            return new Response(JSON.stringify({
                error: 'invalid_request',
                error_description: 'Unsupported content type'
            }), {
                status: 400,
                headers: corsHeaders({ 'Content-Type': 'application/json' })
            })
        }
    } catch (_error) {
        console.log('[OAuth Token] ERROR: Failed to parse body:', _error)
        return new Response(JSON.stringify({
            error: 'invalid_request',
            error_description: 'Invalid request body'
        }), {
            status: 400,
            headers: corsHeaders({ 'Content-Type': 'application/json' })
        })
    }

    // Extract client credentials from Authorization header if present
    const authHeader = request.headers.get('authorization')
    console.log('[OAuth Token] Authorization header:', authHeader ? 'Present' : 'Not present')
    
    if (authHeader?.startsWith('Basic ')) {
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
        const [clientId, clientSecret] = credentials.split(':')
        console.log('[OAuth Token] Basic auth extracted - client_id:', clientId)
        body.client_id = body.client_id || clientId
        body.client_secret = body.client_secret || clientSecret
    }

    console.log('[OAuth Token] Final body for validation:', body)

    // Validate the request
    const validation = tokenRequestSchema.safeParse(body)
    if (!validation.success) {
        console.log('[OAuth Token] ERROR: Validation failed:', validation.error.errors)
        return new Response(JSON.stringify({
            error: 'invalid_request',
            error_description: validation.error.errors[0]?.message || 'Invalid token request'
        }), {
            status: 400,
            headers: corsHeaders({ 'Content-Type': 'application/json' })
        })
    }

    const { grant_type, code, refresh_token, client_id, client_secret, code_verifier } = validation.data

    // Handle authorization code grant
    if (grant_type === 'authorization_code') {
        console.log('[OAuth Token] Processing authorization_code grant')
        console.log('[OAuth Token] Provided params:', {
            code: code ? `${code.substring(0, 20)}...` : 'MISSING',
            client_id: client_id || 'MISSING',
            client_secret: client_secret ? '***PRESENT***' : 'NOT PROVIDED (public client?)',
            code_verifier: code_verifier ? '***PRESENT***' : 'NOT PROVIDED'
        })
        
        // Per RFC 6749, only code and client_id are required for public clients
        // client_secret is only required for confidential clients
        if (!code || !client_id) {
            console.log('[OAuth Token] ERROR: Missing required parameters')
            console.log('[OAuth Token] Missing:', {
                code: !code,
                client_id: !client_id
            })
            return new Response(JSON.stringify({
                error: 'invalid_request',
                error_description: 'Missing authorization code or client_id'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        console.log('[OAuth Token] Looking up authorization code:', code)
        
        // Look up the authorization code
        const [authCode] = await db
            .select()
            .from(schema.mcpAuthorizationCodes)
            .where(
                and(
                    eq(schema.mcpAuthorizationCodes.code, code),
                    eq(schema.mcpAuthorizationCodes.used, 'false')
                )
            )
            .limit(1)

        console.log('[OAuth Token] Authorization code lookup result:', authCode ? 'Found' : 'Not found')
        
        if (!authCode) {
            console.log('[OAuth Token] ERROR: Invalid or expired authorization code')
            return new Response(JSON.stringify({
                error: 'invalid_grant',
                error_description: 'Invalid or expired authorization code'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Check if code has expired
        if (authCode.expiresAt < Date.now()) {
            return new Response(JSON.stringify({
                error: 'invalid_grant',
                error_description: 'Authorization code has expired'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Retrieve the authorization session to check for PKCE
        const [authSession] = await db
            .select()
            .from(schema.mcpAuthorizationSessions)
            .where(eq(schema.mcpAuthorizationSessions.id, authCode.authorizationSessionId))
            .limit(1)

        // Verify PKCE if it was used during authorization
        if (authSession?.codeChallenge) {
            if (!code_verifier) {
                return new Response(JSON.stringify({
                    error: 'invalid_grant',
                    error_description: 'Code verifier required for PKCE'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                })
            }

            const pkceValid = verifyPKCEChallenge(
                code_verifier,
                authSession.codeChallenge,
                authSession.codeChallengeMethod || 'S256'
            )

            if (!pkceValid) {
                return new Response(JSON.stringify({
                    error: 'invalid_grant',
                    error_description: 'Invalid code verifier'
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
        }

        // Verify client credentials
        console.log('[OAuth Token] Verifying client credentials for client_id:', client_id)
        
        // First, look up the client registration to check if it's a public or confidential client
        const [clientRegistration] = await db
            .select()
            .from(schema.mcpClientRegistrations)
            .where(
                and(
                    eq(schema.mcpClientRegistrations.id, authCode.mcpClientRegistrationId),
                    eq(schema.mcpClientRegistrations.clientId, client_id)
                )
            )
            .limit(1)

        if (!clientRegistration) {
            console.log('[OAuth Token] ERROR: Client not found for client_id:', client_id)
            return new Response(JSON.stringify({
                error: 'invalid_client',
                error_description: 'Client not found'
            }), {
                status: 401,
                headers: corsHeaders({ 'Content-Type': 'application/json' })
            })
        }
        
        console.log('[OAuth Token] Client found, type:', clientRegistration.clientSecret ? 'confidential' : 'public')
        
        // If this is a confidential client (has a client_secret), verify it
        if (clientRegistration.clientSecret) {
            if (!client_secret) {
                console.log('[OAuth Token] ERROR: Client secret required for confidential client')
                return new Response(JSON.stringify({
                    error: 'invalid_client',
                    error_description: 'Client authentication required'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            
            if (clientRegistration.clientSecret !== client_secret) {
                console.log('[OAuth Token] ERROR: Invalid client secret')
                return new Response(JSON.stringify({
                    error: 'invalid_client',
                    error_description: 'Invalid client credentials'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
            console.log('[OAuth Token] Client secret verified successfully')
        } else {
            // Public client - no secret required, but PKCE is strongly recommended
            console.log('[OAuth Token] Public client detected, no client_secret required')
            if (!code_verifier) {
                console.log('[OAuth Token] WARNING: Public client without PKCE - security risk!')
            }
        }

        // Mark the authorization code as used
        await db
            .update(schema.mcpAuthorizationCodes)
            .set({ used: 'true' })
            .where(eq(schema.mcpAuthorizationCodes.id, authCode.id))

        // Generate proxy tokens
        const accessToken = `mcp_at_${nanoid(32)}`
        const refreshToken = `mcp_rt_${nanoid(32)}`
        const expiresIn = 3600 // 1 hour

        await db.insert(schema.mcpProxyTokens).values({
            mcpClientRegistrationId: clientRegistration.id,
            upstreamTokenId: authCode.upstreamTokenId,
            accessToken,
            refreshToken,
            expiresAt: Date.now() + expiresIn * 1000
        })

        // Return the token response
        console.log('[OAuth Token] Successfully issued tokens for client:', client_id)
        return new Response(JSON.stringify({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            refresh_token: refreshToken,
            scope: 'openid profile email'
        }), {
            status: 200,
            headers: corsHeaders({
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
            })
        })
    }

    // Handle refresh token grant
    if (grant_type === 'refresh_token') {
        console.log('[OAuth Token] Processing refresh_token grant')
        
        // Per RFC 6749, refresh_token and client_id are required
        // client_secret is only required for confidential clients
        if (!refresh_token || !client_id) {
            console.log('[OAuth Token] ERROR: Missing required parameters for refresh_token grant')
            return new Response(JSON.stringify({
                error: 'invalid_request',
                error_description: 'Missing refresh_token or client_id'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Look up the refresh token
        const [proxyToken] = await db
            .select()
            .from(schema.mcpProxyTokens)
            .where(eq(schema.mcpProxyTokens.refreshToken, refresh_token))
            .limit(1)

        if (!proxyToken) {
            return new Response(JSON.stringify({
                error: 'invalid_grant',
                error_description: 'Invalid refresh token'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

        // Verify client credentials
        console.log('[OAuth Token] Verifying client for refresh token')
        
        const [clientRegistration] = await db
            .select()
            .from(schema.mcpClientRegistrations)
            .where(
                and(
                    eq(schema.mcpClientRegistrations.id, proxyToken.mcpClientRegistrationId),
                    eq(schema.mcpClientRegistrations.clientId, client_id)
                )
            )
            .limit(1)

        if (!clientRegistration) {
            console.log('[OAuth Token] ERROR: Client not found for refresh token')
            return new Response(JSON.stringify({
                error: 'invalid_client',
                error_description: 'Client not found'
            }), {
                status: 401,
                headers: corsHeaders({ 'Content-Type': 'application/json' })
            })
        }
        
        // If this is a confidential client, verify the secret
        if (clientRegistration.clientSecret) {
            if (!client_secret || clientRegistration.clientSecret !== client_secret) {
                console.log('[OAuth Token] ERROR: Invalid client secret for refresh token')
                return new Response(JSON.stringify({
                    error: 'invalid_client',
                    error_description: 'Invalid client credentials'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                })
            }
        }

        // Delete the old proxy token
        await db
            .delete(schema.mcpProxyTokens)
            .where(eq(schema.mcpProxyTokens.id, proxyToken.id))

        // Generate new proxy tokens
        const newAccessToken = `mcp_at_${nanoid(32)}`
        const newRefreshToken = `mcp_rt_${nanoid(32)}`
        const expiresIn = 3600 // 1 hour

        await db.insert(schema.mcpProxyTokens).values({
            mcpClientRegistrationId: clientRegistration.id,
            upstreamTokenId: proxyToken.upstreamTokenId,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: Date.now() + expiresIn * 1000
        })

        // Return the token response
        return new Response(JSON.stringify({
            access_token: newAccessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            refresh_token: newRefreshToken,
            scope: 'openid profile email'
        }), {
            status: 200,
            headers: corsHeaders({
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
            })
        })
    }

    return new Response(JSON.stringify({
        error: 'unsupported_grant_type',
        error_description: 'Grant type not supported'
    }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
    })
}

// Handle CORS preflight
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        }
    })
}