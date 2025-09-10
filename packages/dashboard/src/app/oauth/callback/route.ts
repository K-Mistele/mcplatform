import { db, schema } from 'database'
import { and, eq, gt } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    await headers()
    
    // Get query parameters from the upstream OAuth server callback
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors from upstream
    if (error) {
        console.error('OAuth error from upstream:', error, errorDescription)
        // We need to find the session to know where to redirect the error
        if (state) {
            const [session] = await db
                .select()
                .from(schema.mcpAuthorizationSessions)
                .where(
                    and(
                        eq(schema.mcpAuthorizationSessions.state, state),
                        gt(schema.mcpAuthorizationSessions.expiresAt, Date.now())
                    )
                )
                .limit(1)
            
            if (session) {
                const errorParams = new URLSearchParams({
                    error: error,
                    error_description: errorDescription || 'Authorization failed'
                })
                if (session.clientState) {
                    errorParams.set('state', session.clientState)
                }
                return redirect(`${session.redirectUri}?${errorParams.toString()}`)
            }
        }
        return new Response('OAuth authorization failed', { status: 400 })
    }

    // Validate required parameters
    if (!code || !state) {
        return new Response('Missing authorization code or state', { status: 400 })
    }

    // Look up the authorization session by state
    const [session] = await db
        .select()
        .from(schema.mcpAuthorizationSessions)
        .where(
            and(
                eq(schema.mcpAuthorizationSessions.state, state),
                gt(schema.mcpAuthorizationSessions.expiresAt, Date.now())
            )
        )
        .limit(1)

    if (!session) {
        console.error('Authorization session not found or expired for state:', state)
        return new Response('Invalid or expired authorization session', { status: 400 })
    }

    // Get the custom OAuth configuration
    const [customOAuthConfig] = await db
        .select()
        .from(schema.customOAuthConfigs)
        .where(eq(schema.customOAuthConfigs.id, session.customOAuthConfigId))
        .limit(1)

    if (!customOAuthConfig) {
        console.error('OAuth configuration not found:', session.customOAuthConfigId)
        const errorParams = new URLSearchParams({
            error: 'server_error',
            error_description: 'OAuth configuration not found'
        })
        if (session.clientState) {
            errorParams.set('state', session.clientState)
        }
        return redirect(`${session.redirectUri}?${errorParams.toString()}`)
    }

    // Exchange the authorization code for tokens with the upstream OAuth server
    const tokenUrl = customOAuthConfig.tokenUrl || 
        (customOAuthConfig.metadataUrl ? await getTokenUrlFromMetadata(customOAuthConfig.metadataUrl) : null)
    
    if (!tokenUrl) {
        console.error('Token endpoint URL not found for OAuth config:', customOAuthConfig.id)
        const errorParams = new URLSearchParams({
            error: 'server_error',
            error_description: 'Token endpoint not configured'
        })
        if (session.clientState) {
            errorParams.set('state', session.clientState)
        }
        return redirect(`${session.redirectUri}?${errorParams.toString()}`)
    }

    try {
        // Exchange code for tokens with upstream OAuth server
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${customOAuthConfig.clientId}:${customOAuthConfig.clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: `${request.nextUrl.protocol}//${request.headers.get('host')}/oauth/callback`
            })
        })

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text()
            console.error('Token exchange failed:', tokenResponse.status, errorData)
            const errorParams = new URLSearchParams({
                error: 'access_denied',
                error_description: 'Failed to exchange authorization code'
            })
            if (session.clientState) {
                errorParams.set('state', session.clientState)
            }
            return redirect(`${session.redirectUri}?${errorParams.toString()}`)
        }

        const tokenData = await tokenResponse.json()
        
        // Store the upstream tokens
        const expiresAt = tokenData.expires_in 
            ? BigInt(Date.now() + tokenData.expires_in * 1000)
            : null

        // First, we need to get or create a user
        // For now, we'll use a placeholder user ID until we implement user info fetching
        const userId = `mcp_user_${nanoid()}`

        const [upstreamToken] = await db
            .insert(schema.upstreamOAuthTokens)
            .values({
                id: `uoat_${nanoid()}`,
                mcpServerUserId: userId, // This should be resolved from userinfo endpoint
                oauthConfigId: customOAuthConfig.id,
                accessToken: tokenData.access_token, // TODO: Encrypt this
                refreshToken: tokenData.refresh_token || null, // TODO: Encrypt this
                expiresAt,
                createdAt: BigInt(Date.now())
            })
            .returning()

        // Generate our own authorization code for the MCP client
        const ourAuthCode = `mcp_code_${nanoid(32)}`
        
        await db.insert(schema.mcpAuthorizationCodes).values({
            id: `mac_${nanoid()}`,
            mcpClientRegistrationId: session.mcpClientRegistrationId,
            upstreamTokenId: upstreamToken.id,
            code: ourAuthCode,
            expiresAt: BigInt(Date.now() + 10 * 60 * 1000), // 10 minutes
            used: 'false',
            createdAt: BigInt(Date.now())
        })

        // Clean up the authorization session
        await db
            .delete(schema.mcpAuthorizationSessions)
            .where(eq(schema.mcpAuthorizationSessions.id, session.id))

        // Redirect back to the MCP client with our authorization code
        const redirectParams = new URLSearchParams({
            code: ourAuthCode
        })
        if (session.clientState) {
            redirectParams.set('state', session.clientState)
        }

        return redirect(`${session.redirectUri}?${redirectParams.toString()}`)

    } catch (error) {
        console.error('Token exchange error:', error)
        const errorParams = new URLSearchParams({
            error: 'server_error',
            error_description: 'Token exchange failed'
        })
        if (session.clientState) {
            errorParams.set('state', session.clientState)
        }
        return redirect(`${session.redirectUri}?${errorParams.toString()}`)
    }
}

// Helper function to get token URL from metadata
async function getTokenUrlFromMetadata(metadataUrl: string): Promise<string | null> {
    try {
        const response = await fetch(metadataUrl)
        if (response.ok) {
            const metadata = await response.json()
            return metadata.token_endpoint || null
        }
    } catch (error) {
        console.error('Failed to fetch OAuth metadata:', error)
    }
    return null
}