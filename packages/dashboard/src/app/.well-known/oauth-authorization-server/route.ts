import { oAuthDiscoveryMetadata } from 'better-auth/plugins'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { auth } from '../../../lib/auth/auth'

export async function GET(request: NextRequest) {
    const host = request.headers.get('host')
    if (!host) {
        return new Response('Invalid host; host not found', { status: 404 })
    }

    const parts = host.split('.')
    if ((host.includes('localhost') && parts.length < 2) || (!host.includes('localhost') && parts.length < 3)) {
        console.log('Invalid host; subdomain not found or not valid', { host, parts })
        return new Response('Invalid host; subdomain not found or not valid', { status: 404 })
    }

    const subdomain = parts[0]
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)

    if (!mcpServerConfiguration) {
        return new Response('Invalid host; subdomain not found', { status: 404 })
    }

    // Use BetterAuth's OAuth discovery metadata IFF they want to use platform OAuth
    if (mcpServerConfiguration.authType === 'platform_oauth') {
        console.log('Using platform OAuth for server', mcpServerConfiguration.name)
        return oAuthDiscoveryMetadata(auth)(request)
    }

    // TODO - support custom oauth / openid connect
    if (mcpServerConfiguration.authType === 'custom_oauth') {
        console.log('Using custom OAuth for server', mcpServerConfiguration.name)
        return new Response('Not implemented', { status: 501 })
    }

    // otherwise we don't support this endpoint.
    return new Response('Not found', { status: 404 })
}
