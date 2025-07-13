import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { protectedResourceHandler } from '../../../lib/mcp'

/**
 * This function builds the handler on the fly based on the host.
 * @param request
 * @returns
 */
async function handler(request: Request) {
    const host = request.headers.get('host')
    if (!host) {
        return new Response('Invalid host', { status: 404 })
    }

    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        console.log('Invalid host; subdomain not found or not valid', { host, parts })
        return new Response('Invalid host; subdomain not found or not valid', { status: 404 })
    }
    console.log('host', host)
    console.log('parts', parts)

    const subdomain = parts[0]
    console.log('subdomain', subdomain)
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    console.log('mcpServerConfiguration', mcpServerConfiguration)

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
        const authServerUrl = mcpServerConfiguration.oauthIssuerUrl!

        const prh = protectedResourceHandler({
            // Specify the Issuer URL of the associated Authorization Server
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
