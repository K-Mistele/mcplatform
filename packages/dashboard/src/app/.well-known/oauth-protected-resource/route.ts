import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { protectedResourceHandler } from '../../../lib/mcp'

export const dynamic = 'force-dynamic'

/**
 * This function builds the handler on the fly based on the host.
 * @param request
 * @returns
 */
async function handler(request: Request) {
    await headers()
    const host = request.headers.get('host')
    if (!host) {
        return new Response('Invalid host', { status: 404 })
    }

    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        console.log('Invalid host; subdomain not found or not valid', { host, parts })
        return new Response('Invalid host; subdomain not found or not valid', { status: 404 })
    }

    const subdomain = parts[0]
    const [{ mcp_servers: mcpServerConfiguration, custom_oauth_configs: customOAuthConfig }] = await db
        .select()
        .from(schema.mcpServers)
        .leftJoin(schema.customOAuthConfigs, eq(schema.mcpServers.customOAuthConfigId, schema.customOAuthConfigs.id))
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    if (!mcpServerConfiguration) {
        return new Response('Invalid host; subdomain not found', { status: 404 })
    }

    if (mcpServerConfiguration.authType === 'platform_oauth') {
        const authServerUrl = `${host.includes('localhost') ? 'http' : 'https'}://${host}`
        console.log('authServerUrl', authServerUrl)

        const prh = protectedResourceHandler({
            // Specify the Issuer URL of the associated Authorization Server
            authServerUrls: [authServerUrl]
        })

        return prh(request)
    }
    if (mcpServerConfiguration.authType === 'custom_oauth') {
        if (!customOAuthConfig) return new Response('OAuth config not found', { status: 404 })

        console.log(
            '[oauth-protected-resource] Custom OAuth config found, fetching metadata from:',
            customOAuthConfig.metadataUrl
        )
        const authServerUrl = `${host.includes('localhost') ? 'http' : 'https'}://${host}`
        console.log('authServerUrl', authServerUrl)

        const prh = protectedResourceHandler({
            // Use the issuer URL from the OAuth server's metadata
            authServerUrls: [authServerUrl]
        })

        return prh(request)
    }
    return new Response('Not an OAuth protected resource', { status: 404 })
}

export { handler as GET }

export async function OPTIONS(request: Request) {
    return new Response('', {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400'
        }
    })
}
