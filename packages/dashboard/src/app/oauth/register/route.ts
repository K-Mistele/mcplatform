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
    token_endpoint_auth_method: z.enum(['client_secret_basic', 'client_secret_post']).optional(),
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
    await headers()
    const host = request.headers.get('host')
    if (!host) {
        return new Response(JSON.stringify({ error: 'invalid_request', error_description: 'Host header not found' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // Parse and validate the registration request
    let body: unknown
    try {
        body = await request.json()
    } catch (_error) {
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
        return new Response(JSON.stringify({ 
            error: 'invalid_client_metadata', 
            error_description: validation.error.errors[0]?.message || 'Invalid client metadata' 
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const registrationData = validation.data

    // Extract subdomain from host for VHost lookup
    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        return new Response(JSON.stringify({ 
            error: 'invalid_request', 
            error_description: 'Invalid host; subdomain not found' 
        }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    const subdomain = parts[0]

    // Look up MCP server configuration
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    if (!mcpServerConfiguration) {
        return new Response(JSON.stringify({ 
            error: 'invalid_request', 
            error_description: 'MCP server not found' 
        }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        })
    }

    // Ensure the server is configured for custom OAuth
    if (mcpServerConfiguration.authType !== 'custom_oauth' || !mcpServerConfiguration.customOAuthConfigId) {
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
    const clientSecret = `mcp_secret_${nanoid(32)}`

    // Store the client registration
    const [clientRegistration] = await db
        .insert(schema.mcpClientRegistrations)
        .values({
            id: `mcr_${nanoid()}`,
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
            },
            createdAt: BigInt(Date.now())
        })
        .returning()

    // Return the client registration response per RFC 7591
    const response = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Number(clientRegistration.createdAt) / 1000),
        client_secret_expires_at: 0, // 0 means it doesn't expire
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

    return new Response(JSON.stringify(response), {
        status: 201,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
            'Pragma': 'no-cache'
        }
    })
}

// Handle CORS preflight
export async function OPTIONS() {
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