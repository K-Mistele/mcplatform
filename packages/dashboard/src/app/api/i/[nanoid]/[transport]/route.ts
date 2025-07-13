import { configureMcpServer, withMcpAuth } from '@/lib/mcp'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { createMcpHandler } from 'mcp-handler'
import { NextResponse } from 'next/server'

async function mcpServerHandler(
    request: Request,
    { params }: { params: Promise<{ transport: string; nanoid: string }> }
) {
    const { nanoid, transport } = await params

    // Pull the slug from the host header and see if we can find a server with that slug.
    const host = request.headers.get('host')
    if (!host) {
        return NextResponse.json({ error: 'Host not found' }, { status: 400 })
    }
    const slug = host.split('.')[0]
    console.log('slug', slug)
    const [mcpServerConfiguration] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, slug))
        .limit(1)

    if (!mcpServerConfiguration) {
        return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    // Now we create the MCP server

    console.log('mcpServerConfiguration', mcpServerConfiguration)
    const handler = createMcpHandler(
        async (server) => {
            configureMcpServer(server, mcpServerConfiguration, nanoid)

            await db
                .insert(schema.mcpServerUser)
                .values({
                    distinctId: nanoid
                })
                .onConflictDoNothing()
            await db.insert(schema.mcpServerConnection).values({
                distinctId: nanoid,
                slug: slug,
                transport: transport
            })
        },
        {
            serverInfo: {
                name: mcpServerConfiguration.name,
                version: '1.0.0'
            }
        },
        {
            redisUrl: process.env.REDIS_URL,
            basePath: `/api/i/${nanoid}`
        }
    )

    console.log('request.headers.get(host)', request.headers.get('host'))

    // TODO need a fork of `withMcpAuth` that works off the host header instead of the request url's origin

    if (mcpServerConfiguration.authType === 'platform_oauth' || mcpServerConfiguration.authType === 'custom_oauth') {
        console.log('auth required')
        // make authorization required
        const authHandler = withMcpAuth(handler, verifyToken, {
            required: true, // Make auth required for all requests
            requiredScopes: ['email', 'profile', 'openid'], // Optional: Require specific scopes
            resourceMetadataPath: '/.well-known/oauth-protected-resource'
        })
        return await authHandler(request)
    }
    console.log('auth not required, ', mcpServerConfiguration.authType)

    return await handler(request)
}

// Wrap your handler with authorization
async function verifyToken(req: Request, bearerToken?: string): Promise<any | undefined> {
    if (!bearerToken) return undefined

    console.log('bearerToken', bearerToken)

    // Replace this example with actual token verification logic
    // Return an AuthInfo object if verification succeeds
    // Otherwise, return undefined
    const isValid = bearerToken.startsWith('TEST')

    if (!isValid) return undefined

    return {
        token: bearerToken,
        scopes: ['email', 'profile', 'openid'], // Add relevant scopes
        clientId: 'user123', // Add user/client identifier
        extra: {
            // Optional extra information like user id
        }
    }
}

export { mcpServerHandler as GET, mcpServerHandler as POST }
