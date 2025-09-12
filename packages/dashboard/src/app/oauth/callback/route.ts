import { db, schema } from 'database'
import { and, eq, gt, sql } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { nanoid } from 'nanoid'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    console.log('[OAuth Callback] Callback received from upstream OAuth server')
    
    await headers()
    
    // Get query parameters from the upstream OAuth server callback
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    console.log('[OAuth Callback] Callback parameters:', {
        hasCode: !!code,
        state: state,
        error: error,
        errorDescription: errorDescription
    })

    // Handle OAuth errors from upstream
    if (error) {
        console.error('[OAuth Callback] OAuth error from upstream:', error, errorDescription)
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
        console.error('[OAuth Callback] Missing required parameters - code:', !!code, 'state:', !!state)
        return new Response('Missing authorization code or state', { status: 400 })
    }

    // Look up the authorization session by state
    console.log('[OAuth Callback] Looking up authorization session for state:', state)
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
        console.error('[OAuth Callback] Authorization session not found or expired for state:', state)
        return new Response('Invalid or expired authorization session', { status: 400 })
    }
    
    console.log('[OAuth Callback] Found authorization session:', {
        id: session.id,
        clientRegistrationId: session.mcpClientRegistrationId,
        customOAuthConfigId: session.customOAuthConfigId,
        redirectUri: session.redirectUri
    })

    // Get the custom OAuth configuration
    console.log('[OAuth Callback] Fetching OAuth configuration:', session.customOAuthConfigId)
    const [customOAuthConfig] = await db
        .select()
        .from(schema.customOAuthConfigs)
        .where(eq(schema.customOAuthConfigs.id, session.customOAuthConfigId))
        .limit(1)

    if (!customOAuthConfig) {
        console.error('[OAuth Callback] OAuth configuration not found:', session.customOAuthConfigId)
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

    // Track redirect URL to return after try-catch
    let successRedirectUrl: string | null = null
    let errorRedirectUrl: string | null = null

    try {
        // Exchange code for tokens with upstream OAuth server
        const callbackUrl = `${request.nextUrl.protocol}//${request.headers.get('host')}/oauth/callback`
        console.log('[OAuth Callback] Exchanging code for tokens with upstream OAuth server:', {
            tokenUrl: tokenUrl,
            clientId: customOAuthConfig.clientId,
            callbackUrl: callbackUrl
        })
        
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${customOAuthConfig.clientId}:${customOAuthConfig.clientSecret}`).toString('base64')}`
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: callbackUrl
            })
        })

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.text()
            console.error('[OAuth Callback] Token exchange failed:', tokenResponse.status, errorData)
            const errorParams = new URLSearchParams({
                error: 'access_denied',
                error_description: 'Failed to exchange authorization code'
            })
            if (session.clientState) {
                errorParams.set('state', session.clientState)
            }
            errorRedirectUrl = `${session.redirectUri}?${errorParams.toString()}`
            throw new Error('Token exchange failed') // Exit try block
        }

        const tokenData = await tokenResponse.json()
        console.log('[OAuth Callback] Token exchange successful:', {
            hasAccessToken: !!tokenData.access_token,
            hasRefreshToken: !!tokenData.refresh_token,
            expiresIn: tokenData.expires_in
        })
        
        // Store the upstream tokens
        const expiresAt = tokenData.expires_in 
            ? Date.now() + tokenData.expires_in * 1000
            : null

        // Fetch userinfo from upstream OAuth provider
        let email: string | null = null
        let upstreamSub: string | null = null
        let profileData: any = null
        
        const userinfoUrl = await getUserinfoUrlFromMetadata(customOAuthConfig.metadataUrl)
        
        if (userinfoUrl) {
            console.log('[OAuth Callback] Fetching userinfo from:', userinfoUrl)
            try {
                const userinfoResponse = await fetch(userinfoUrl, {
                    headers: {
                        'Authorization': `Bearer ${tokenData.access_token}`
                    }
                })
                
                if (userinfoResponse.ok) {
                    profileData = await userinfoResponse.json()
                    email = profileData.email || null
                    upstreamSub = profileData.sub || null
                    console.log('[OAuth Callback] Userinfo retrieved:', {
                        hasEmail: !!email,
                        hasSub: !!upstreamSub,
                        hasName: !!profileData.name
                    })
                } else {
                    console.error('[OAuth Callback] Failed to fetch userinfo:', userinfoResponse.status)
                }
            } catch (error) {
                console.error('[OAuth Callback] Error fetching userinfo:', error)
            }
        } else {
            console.log('[OAuth Callback] No userinfo endpoint available')
        }

        // Organization-scoped user deduplication
        let mcpServerUserId: string | undefined
        
        // First try to find existing user within the organization scope
        if (email || upstreamSub) {
            console.log('[OAuth Callback] Looking for existing user with email:', email, 'or sub:', upstreamSub)
            
            // Build query to find users within the same organization
            const existingUserQuery = db
                .selectDistinct({ userId: schema.mcpServerUser.id })
                .from(schema.mcpServerUser)
                .leftJoin(
                    schema.mcpServerSession,
                    eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id)
                )
                .leftJoin(
                    schema.mcpServers,
                    eq(schema.mcpServers.slug, schema.mcpServerSession.mcpServerSlug)
                )
                .where(
                    and(
                        eq(schema.mcpServers.organizationId, customOAuthConfig.organizationId),
                        email && upstreamSub
                            ? sql`(${schema.mcpServerUser.email} = ${email} OR ${schema.mcpServerUser.upstreamSub} = ${upstreamSub})`
                            : email 
                                ? eq(schema.mcpServerUser.email, email)
                                : eq(schema.mcpServerUser.upstreamSub, upstreamSub!)
                    )
                )
                .limit(1)
            
            const [existingUser] = await existingUserQuery
            
            if (existingUser) {
                mcpServerUserId = existingUser.userId
                console.log('[OAuth Callback] Found existing user:', mcpServerUserId)
                
                // Update user profile data if we have new information
                if (profileData) {
                    await db
                        .update(schema.mcpServerUser)
                        .set({
                            email: email || undefined,
                            upstreamSub: upstreamSub || undefined,
                            profileData: profileData
                        })
                        .where(eq(schema.mcpServerUser.id, mcpServerUserId))
                }
            }
        }
        
        // If no existing user found, create a new one
        if (!mcpServerUserId) {
            console.log('[OAuth Callback] Creating new user with email:', email, 'sub:', upstreamSub)
            const [newUser] = await db
                .insert(schema.mcpServerUser)
                .values({
                    email: email,
                    upstreamSub: upstreamSub,
                    profileData: profileData
                })
                .returning()
            mcpServerUserId = newUser.id
            console.log('[OAuth Callback] Created new user:', mcpServerUserId)
        }

        console.log('[OAuth Callback] Storing upstream tokens with user ID:', mcpServerUserId)
        const [upstreamToken] = await db
            .insert(schema.upstreamOAuthTokens)
            .values({
                mcpServerUserId: mcpServerUserId!, // Now using real user ID
                oauthConfigId: customOAuthConfig.id,
                accessToken: tokenData.access_token, // TODO: Encrypt this
                refreshToken: tokenData.refresh_token || null, // TODO: Encrypt this
                expiresAt
            })
            .returning()
        console.log('[OAuth Callback] Upstream tokens stored:', upstreamToken.id)

        // Generate our own authorization code for the MCP client
        const ourAuthCode = `mcp_code_${nanoid(32)}`
        console.log('[OAuth Callback] Generated MCP authorization code:', ourAuthCode.substring(0, 20) + '...')
        
        await db.insert(schema.mcpAuthorizationCodes).values({
            mcpClientRegistrationId: session.mcpClientRegistrationId,
            authorizationSessionId: session.id,
            upstreamTokenId: upstreamToken.id,
            code: ourAuthCode,
            expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
            used: 'false'
        })
        console.log('[OAuth Callback] MCP authorization code stored')

        // Note: We don't delete the authorization session here anymore
        // It's needed for PKCE verification in the token endpoint
        // It will expire naturally based on its expiresAt field

        // Redirect back to the MCP client with our authorization code
        const redirectParams = new URLSearchParams({
            code: ourAuthCode
        })
        if (session.clientState) {
            redirectParams.set('state', session.clientState)
        }
        
        console.log('[OAuth Callback] Redirecting to MCP client:', {
            redirectUri: session.redirectUri,
            hasState: !!session.clientState
        })

        successRedirectUrl = `${session.redirectUri}?${redirectParams.toString()}`

    } catch (error) {
        console.error('[OAuth Callback] Token exchange error:', error)
        
        // If we don't already have an error redirect URL, create one
        if (!errorRedirectUrl) {
            const errorParams = new URLSearchParams({
                error: 'server_error',
                error_description: 'Token exchange failed'
            })
            if (session.clientState) {
                errorParams.set('state', session.clientState)
            }
            errorRedirectUrl = `${session.redirectUri}?${errorParams.toString()}`
        }
    }
    
    // Perform the redirect outside of the try-catch block
    if (successRedirectUrl) {
        return redirect(successRedirectUrl)
    } else if (errorRedirectUrl) {
        return redirect(errorRedirectUrl)
    }
    
    // Fallback error response (should not normally reach here)
    return new Response('OAuth callback failed', { status: 500 })
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

// Helper function to get userinfo URL from metadata
async function getUserinfoUrlFromMetadata(metadataUrl: string): Promise<string | null> {
    try {
        console.log('[OAuth Callback] Fetching metadata for userinfo endpoint from:', metadataUrl)
        const response = await fetch(metadataUrl)
        if (response.ok) {
            const metadata = await response.json()
            const userinfoEndpoint = metadata.userinfo_endpoint || null
            console.log('[OAuth Callback] UserInfo endpoint from metadata:', userinfoEndpoint)
            return userinfoEndpoint
        }
    } catch (error) {
        console.error('[OAuth Callback] Failed to fetch OAuth metadata for userinfo:', error)
    }
    return null
}