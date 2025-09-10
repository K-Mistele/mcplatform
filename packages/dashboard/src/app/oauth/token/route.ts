import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// OAuth token request schema per RFC 6749
const tokenRequestSchema = z.object({
    grant_type: z.enum(['authorization_code', 'refresh_token']),
    code: z.string().optional(),
    redirect_uri: z.string().url().optional(),
    refresh_token: z.string().optional(),
    client_id: z.string().optional(),
    client_secret: z.string().optional()
})

export async function POST(request: NextRequest) {
    await headers()
    
    // Parse the request body
    const contentType = request.headers.get('content-type')
    let body: any
    
    try {
        if (contentType?.includes('application/x-www-form-urlencoded')) {
            const text = await request.text()
            body = Object.fromEntries(new URLSearchParams(text))
        } else if (contentType?.includes('application/json')) {
            body = await request.json()
        } else {
            return new Response(JSON.stringify({
                error: 'invalid_request',
                error_description: 'Unsupported content type'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }
    } catch (_error) {
        return new Response(JSON.stringify({
            error: 'invalid_request',
            error_description: 'Invalid request body'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // Extract client credentials from Authorization header if present
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Basic ')) {
        const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
        const [clientId, clientSecret] = credentials.split(':')
        body.client_id = body.client_id || clientId
        body.client_secret = body.client_secret || clientSecret
    }

    // Validate the request
    const validation = tokenRequestSchema.safeParse(body)
    if (!validation.success) {
        return new Response(JSON.stringify({
            error: 'invalid_request',
            error_description: validation.error.errors[0]?.message || 'Invalid token request'
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const { grant_type, code, refresh_token, client_id, client_secret } = validation.data

    // Handle authorization code grant
    if (grant_type === 'authorization_code') {
        if (!code || !client_id || !client_secret) {
            return new Response(JSON.stringify({
                error: 'invalid_request',
                error_description: 'Missing required parameters for authorization_code grant'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            })
        }

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

        if (!authCode) {
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

        // Verify client credentials
        const [clientRegistration] = await db
            .select()
            .from(schema.mcpClientRegistrations)
            .where(
                and(
                    eq(schema.mcpClientRegistrations.id, authCode.mcpClientRegistrationId),
                    eq(schema.mcpClientRegistrations.clientId, client_id),
                    eq(schema.mcpClientRegistrations.clientSecret, client_secret)
                )
            )
            .limit(1)

        if (!clientRegistration) {
            return new Response(JSON.stringify({
                error: 'invalid_client',
                error_description: 'Invalid client credentials'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            })
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
            id: `mpt_${nanoid()}`,
            mcpClientRegistrationId: clientRegistration.id,
            upstreamTokenId: authCode.upstreamTokenId,
            accessToken,
            refreshToken,
            expiresAt: BigInt(Date.now() + expiresIn * 1000),
            createdAt: BigInt(Date.now())
        })

        // Return the token response
        return new Response(JSON.stringify({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: expiresIn,
            refresh_token: refreshToken,
            scope: 'openid profile email'
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
            }
        })
    }

    // Handle refresh token grant
    if (grant_type === 'refresh_token') {
        if (!refresh_token || !client_id || !client_secret) {
            return new Response(JSON.stringify({
                error: 'invalid_request',
                error_description: 'Missing required parameters for refresh_token grant'
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
        const [clientRegistration] = await db
            .select()
            .from(schema.mcpClientRegistrations)
            .where(
                and(
                    eq(schema.mcpClientRegistrations.id, proxyToken.mcpClientRegistrationId),
                    eq(schema.mcpClientRegistrations.clientId, client_id),
                    eq(schema.mcpClientRegistrations.clientSecret, client_secret)
                )
            )
            .limit(1)

        if (!clientRegistration) {
            return new Response(JSON.stringify({
                error: 'invalid_client',
                error_description: 'Invalid client credentials'
            }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            })
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
            id: `mpt_${nanoid()}`,
            mcpClientRegistrationId: clientRegistration.id,
            upstreamTokenId: proxyToken.upstreamTokenId,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresAt: BigInt(Date.now() + expiresIn * 1000),
            createdAt: BigInt(Date.now())
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
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache'
            }
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