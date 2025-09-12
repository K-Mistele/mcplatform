import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// OAuth authorization request parameters per RFC 6749
const authorizationRequestSchema = z.object({
    response_type: z.literal('code'),
    client_id: z.string(),
    redirect_uri: z.string().url(),
    scope: z.string().nullish(),
    state: z.string().nullish()
})

export async function GET(request: NextRequest) {
    console.log('[OAuth Authorize] Authorization request received')

    await headers()
    const host = request.headers.get('host')
    console.log('[OAuth Authorize] Host:', host)

    if (!host) {
        console.error('[OAuth Authorize] Missing host header')
        return new Response('Invalid request: Host header not found', { status: 400 })
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams
    const params = {
        response_type: searchParams.get('response_type'),
        client_id: searchParams.get('client_id'),
        redirect_uri: searchParams.get('redirect_uri'),
        scope: searchParams.get('scope'),
        state: searchParams.get('state')
    }
    console.log('[OAuth Authorize] Request parameters:', params)

    // Validate parameters
    const validation = authorizationRequestSchema.safeParse(params)
    if (!validation.success) {
        console.error('[OAuth Authorize] Parameter validation failed:', validation.error.errors)
        const error = validation.error.errors[0]
        const errorParams = new URLSearchParams({
            error: 'invalid_request',
            error_description: error?.message || 'Invalid authorization request parameters'
        })
        if (params.state) {
            errorParams.set('state', params.state)
        }
        // If we have a redirect_uri, redirect with error, otherwise return error response
        if (params.redirect_uri) {
            console.log('[OAuth Authorize] Redirecting with error to:', params.redirect_uri)
            return redirect(`${params.redirect_uri}?${errorParams.toString()}`)
        }
        return new Response('Invalid request parameters', { status: 400 })
    }

    const { client_id, redirect_uri, scope, state } = validation.data
    console.log('[OAuth Authorize] Validated parameters - client_id:', client_id, 'scope:', scope)

    // Extract subdomain from host for VHost lookup
    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        console.error('[OAuth Authorize] Invalid host format, cannot extract subdomain:', { host, parts })
        const errorParams = new URLSearchParams({
            error: 'invalid_request',
            error_description: 'Invalid host; subdomain not found'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

    const subdomain = parts[0]
    console.log('[OAuth Authorize] Extracted subdomain:', subdomain)

    // Look up MCP server configuration
    console.log('[OAuth Authorize] Looking up MCP server with slug:', subdomain)
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    if (!mcpServerConfiguration) {
        console.error('[OAuth Authorize] MCP server not found for subdomain:', subdomain)
        const errorParams = new URLSearchParams({
            error: 'invalid_request',
            error_description: 'MCP server not found'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

    console.log('[OAuth Authorize] Found MCP server:', {
        id: mcpServerConfiguration.id,
        authType: mcpServerConfiguration.authType,
        hasCustomOAuth: !!mcpServerConfiguration.customOAuthConfigId
    })

    // Ensure the server is configured for custom OAuth
    if (mcpServerConfiguration.authType !== 'custom_oauth' || !mcpServerConfiguration.customOAuthConfigId) {
        const errorParams = new URLSearchParams({
            error: 'invalid_request',
            error_description: 'Custom OAuth not configured for this server'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

    // Validate the proxy client_id against registered clients
    console.log('[OAuth Authorize] Validating proxy client_id:', client_id)
    const [clientRegistration] = await db
        .select()
        .from(schema.mcpClientRegistrations)
        .where(
            and(
                eq(schema.mcpClientRegistrations.mcpServerId, mcpServerConfiguration.id),
                eq(schema.mcpClientRegistrations.clientId, client_id)
            )
        )
        .limit(1)

    if (!clientRegistration) {
        console.error('[OAuth Authorize] Client not registered:', client_id)
        const errorParams = new URLSearchParams({
            error: 'invalid_client',
            error_description: 'Client not registered'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

    console.log('[OAuth Authorize] Found client registration:', {
        id: clientRegistration.id,
        redirectUris: clientRegistration.redirectUris
    })

    // Validate redirect_uri matches registered redirect_uris
    const registeredRedirectUris = clientRegistration.redirectUris as string[]
    if (!registeredRedirectUris.includes(redirect_uri)) {
        const errorParams = new URLSearchParams({
            error: 'invalid_request',
            error_description: 'Redirect URI not registered'
        })
        if (state) errorParams.set('state', state)
        // Can't redirect to an unregistered URI, return error response
        return new Response('Redirect URI not registered', { status: 400 })
    }

    // Look up the custom OAuth configuration
    const [customOAuthConfig] = await db
        .select()
        .from(schema.customOAuthConfigs)
        .where(eq(schema.customOAuthConfigs.id, mcpServerConfiguration.customOAuthConfigId))
        .limit(1)

    if (!customOAuthConfig) {
        const errorParams = new URLSearchParams({
            error: 'server_error',
            error_description: 'OAuth configuration not found'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

    // Generate our own state parameter for security
    const oauthState = nanoid(32)
    console.log('[OAuth Authorize] Generated OAuth state:', oauthState)

    // Store the authorization session in a temporary store (we'll use a database table for this)
    // This allows us to track the flow and validate the callback
    console.log('[OAuth Authorize] Storing authorization session...')
    await db.insert(schema.mcpAuthorizationSessions).values({
        id: `mas_${nanoid()}`,
        mcpClientRegistrationId: clientRegistration.id,
        customOAuthConfigId: customOAuthConfig.id,
        state: oauthState,
        clientState: state || null,
        redirectUri: redirect_uri,
        scope: scope || customOAuthConfig.scopes || 'openid profile email',
        createdAt: BigInt(Date.now()),
        expiresAt: BigInt(Date.now() + 10 * 60 * 1000) // 10 minutes
    })
    console.log('[OAuth Authorize] Authorization session stored successfully')

    // Build the upstream OAuth authorization URL
    const callbackUrl = `${request.nextUrl.protocol}//${host}/oauth/callback`
    const upstreamAuthUrl = new URL(customOAuthConfig.authorizationUrl)
    upstreamAuthUrl.searchParams.set('response_type', 'code')
    upstreamAuthUrl.searchParams.set('client_id', customOAuthConfig.clientId)
    upstreamAuthUrl.searchParams.set('redirect_uri', callbackUrl)
    upstreamAuthUrl.searchParams.set('state', oauthState)
    const effectiveScope = scope || customOAuthConfig.scopes || 'openid profile email'
    upstreamAuthUrl.searchParams.set('scope', effectiveScope)

    console.log('[OAuth Authorize] Redirecting to upstream OAuth server:', {
        authorizationUrl: customOAuthConfig.authorizationUrl,
        upstreamClientId: customOAuthConfig.clientId,
        callbackUrl,
        scope: effectiveScope
    })

    // Redirect the user to the upstream OAuth server
    return redirect(upstreamAuthUrl.toString())
}
