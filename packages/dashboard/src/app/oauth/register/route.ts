import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// RFC 7591 compliant dynamic client registration schema
const clientRegistrationSchema = z.object({
    redirect_uris: z.array(z.string().url()).min(1),
    client_name: z.string().optional(),
    token_endpoint_auth_method: z.enum(['client_secret_basic', 'client_secret_post', 'none']).optional(),
    grant_types: z.array(z.enum(['authorization_code', 'refresh_token'])).optional(),
    response_types: z.array(z.enum(['code'])).optional(),
    scope: z.string().optional(),
    contacts: z.array(z.string().email()).optional(),
    logo_uri: z.string().url().optional(),
    client_uri: z.string().url().optional(),
    policy_uri: z.string().url().optional(),
    tos_uri: z.string().url().optional()
})

export async function POST(request: NextRequest) {
    console.log('[Dynamic Client Registration] New registration attempt started')
    
    await headers()
    const host = request.headers.get('host')
    console.log('[Dynamic Client Registration] Host:', host)
    
    if (!host) {
        console.error('[Dynamic Client Registration] Missing host header')
        return new Response(JSON.stringify({ error: 'invalid_request', error_description: 'Host header not found' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // Parse and validate the registration request
    let body: unknown
    try {
        body = await request.json()
        console.log('[Dynamic Client Registration] Request body:', JSON.stringify(body, null, 2))
    } catch (_error) {
        console.error('[Dynamic Client Registration] Failed to parse JSON body')
        return new Response(JSON.stringify({ 
            error: 'invalid_request', 
            error_description: 'Invalid JSON in request body' 
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const validation = clientRegistrationSchema.safeParse(body)
    if (!validation.success) {
        console.error('[Dynamic Client Registration] Schema validation failed:', validation.error.errors)
        return new Response(JSON.stringify({ 
            error: 'invalid_client_metadata', 
            error_description: validation.error.errors[0]?.message || 'Invalid client metadata' 
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const registrationData = validation.data
    console.log('[Dynamic Client Registration] Validated registration data:', {
        redirect_uris: registrationData.redirect_uris,
        client_name: registrationData.client_name,
        grant_types: registrationData.grant_types,
        scope: registrationData.scope
    })

    // Extract subdomain from host for VHost lookup
    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        console.error('[Dynamic Client Registration] Invalid host format, cannot extract subdomain:', { host, parts })
        return new Response(JSON.stringify({ 
            error: 'invalid_request', 
            error_description: 'Invalid host; subdomain not found' 
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const subdomain = parts[0]
    console.log('[Dynamic Client Registration] Extracted subdomain:', subdomain)

    // Look up MCP server configuration
    console.log('[Dynamic Client Registration] Looking up MCP server with slug:', subdomain)
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    if (!mcpServerConfiguration) {
        console.error('[Dynamic Client Registration] MCP server not found for subdomain:', subdomain)
        return new Response(JSON.stringify({ 
            error: 'invalid_request', 
            error_description: 'MCP server not found' 
        }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    console.log('[Dynamic Client Registration] Found MCP server:', {
        id: mcpServerConfiguration.id,
        name: mcpServerConfiguration.name,
        authType: mcpServerConfiguration.authType,
        hasCustomOAuthConfig: !!mcpServerConfiguration.customOAuthConfigId
    })

    // Ensure the server is configured for custom OAuth
    if (mcpServerConfiguration.authType !== 'custom_oauth' || !mcpServerConfiguration.customOAuthConfigId) {
        console.error('[Dynamic Client Registration] Server not configured for custom OAuth:', {
            authType: mcpServerConfiguration.authType,
            customOAuthConfigId: mcpServerConfiguration.customOAuthConfigId
        })
        return new Response(JSON.stringify({ 
            error: 'invalid_request', 
            error_description: 'Dynamic client registration not supported for this server' 
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // Generate proxy client credentials
    const clientId = `mcp_client_${nanoid()}`
    // Only generate client_secret for confidential clients (not for 'none' auth method)
    const isPublicClient = registrationData.token_endpoint_auth_method === 'none'
    const clientSecret = isPublicClient ? null : `mcp_secret_${nanoid(32)}`
    console.log('[Dynamic Client Registration] Generated proxy credentials:', {
        clientId,
        isPublicClient,
        clientSecretPrefix: clientSecret ? clientSecret.substring(0, 15) + '...' : 'none (public client)'
    })

    // Store the client registration
    try {
        console.log('[Dynamic Client Registration] Storing client registration in database...')
        const [clientRegistration] = await db
            .insert(schema.mcpClientRegistrations)
            .values({
                mcpServerId: mcpServerConfiguration.id,
                clientId,
                clientSecret, // TODO: Encrypt this in production
                redirectUris: registrationData.redirect_uris,
                clientMetadata: {
                    client_name: registrationData.client_name,
                    token_endpoint_auth_method: registrationData.token_endpoint_auth_method || 'client_secret_basic',
                    grant_types: registrationData.grant_types || ['authorization_code'],
                    response_types: registrationData.response_types || ['code'],
                    scope: registrationData.scope || 'openid profile email',
                    contacts: registrationData.contacts,
                    logo_uri: registrationData.logo_uri,
                    client_uri: registrationData.client_uri,
                    policy_uri: registrationData.policy_uri,
                    tos_uri: registrationData.tos_uri
                }
            })
            .returning()
        
        console.log('[Dynamic Client Registration] Successfully stored client registration:', {
            id: clientRegistration.id,
            mcpServerId: clientRegistration.mcpServerId,
            redirectUris: clientRegistration.redirectUris
        })

        // Return the client registration response per RFC 7591
        const response: any = {
            client_id: clientId,
            client_id_issued_at: Math.floor(Number(clientRegistration.createdAt) / 1000),
            redirect_uris: registrationData.redirect_uris,
            client_name: registrationData.client_name,
            token_endpoint_auth_method: registrationData.token_endpoint_auth_method || 'client_secret_basic',
            grant_types: registrationData.grant_types || ['authorization_code'],
            response_types: registrationData.response_types || ['code'],
            scope: registrationData.scope || 'openid profile email',
            contacts: registrationData.contacts,
            logo_uri: registrationData.logo_uri,
            client_uri: registrationData.client_uri,
            policy_uri: registrationData.policy_uri,
            tos_uri: registrationData.tos_uri
        }

        // Only include client_secret fields for confidential clients
        if (!isPublicClient && clientSecret) {
            response.client_secret = clientSecret
            response.client_secret_expires_at = 0 // 0 means it doesn't expire
        }

        console.log('[Dynamic Client Registration] Registration successful, returning response')
        return new Response(JSON.stringify(response), {
            status: 201,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store',
                'Pragma': 'no-cache',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            }
        })
    } catch (error) {
        console.error('[Dynamic Client Registration] Database error during registration:', error)
        return new Response(JSON.stringify({ 
            error: 'server_error', 
            error_description: 'Failed to store client registration' 
        }), { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        })
    }
}

// Handle CORS preflight
export async function OPTIONS() {
    console.log('[Dynamic Client Registration] CORS preflight request received')
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    })
}