import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'

export const dynamic = 'force-dynamic'

// OAuth authorization request parameters per RFC 6749
const authorizationRequestSchema = z.object({
    response_type: z.literal('code'),
    client_id: z.string(),
    redirect_uri: z.string().url(),
    scope: z.string().optional(),
    state: z.string().optional()
})

export async function GET(request: NextRequest) {
    await headers()
    const host = request.headers.get('host')
    if (!host) {
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

    // Validate parameters
    const validation = authorizationRequestSchema.safeParse(params)
    if (!validation.success) {
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
            return redirect(`${params.redirect_uri}?${errorParams.toString()}`)
        }
        return new Response('Invalid request parameters', { status: 400 })
    }

    const { client_id, redirect_uri, scope, state } = validation.data

    // Extract subdomain from host for VHost lookup
    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        const errorParams = new URLSearchParams({
            error: 'invalid_request',
            error_description: 'Invalid host; subdomain not found'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

    const subdomain = parts[0]

    // Look up MCP server configuration
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    if (!mcpServerConfiguration) {
        const errorParams = new URLSearchParams({
            error: 'invalid_request',
            error_description: 'MCP server not found'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

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
        const errorParams = new URLSearchParams({
            error: 'invalid_client',
            error_description: 'Client not registered'
        })
        if (state) errorParams.set('state', state)
        return redirect(`${redirect_uri}?${errorParams.toString()}`)
    }

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
    
    // Store the authorization session in a temporary store (we'll use a database table for this)
    // This allows us to track the flow and validate the callback
    await db.insert(schema.mcpAuthorizationSessions).values({
        id: `mas_${nanoid()}`,
        mcpClientRegistrationId: clientRegistration.id,
        customOAuthConfigId: customOAuthConfig.id,
        state: oauthState,
        clientState: state || null,
        redirectUri: redirect_uri,
        scope: scope || 'openid profile email',
        createdAt: BigInt(Date.now()),
        expiresAt: BigInt(Date.now() + 10 * 60 * 1000) // 10 minutes
    })

    // Build the upstream OAuth authorization URL
    const upstreamAuthUrl = new URL(customOAuthConfig.authorizationUrl)
    upstreamAuthUrl.searchParams.set('response_type', 'code')
    upstreamAuthUrl.searchParams.set('client_id', customOAuthConfig.clientId)
    upstreamAuthUrl.searchParams.set('redirect_uri', `${request.nextUrl.protocol}//${host}/oauth/callback`)
    upstreamAuthUrl.searchParams.set('state', oauthState)
    if (scope) {
        upstreamAuthUrl.searchParams.set('scope', scope)
    }

    // Redirect the user to the upstream OAuth server
    return redirect(upstreamAuthUrl.toString())
}