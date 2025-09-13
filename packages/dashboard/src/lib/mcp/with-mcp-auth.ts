import type { OAuthAccessToken } from 'better-auth/plugins'
import { db, schema } from 'database'
import { and, eq, gt } from 'drizzle-orm'

// Extended session type to support both platform OAuth and proxy tokens
export type McpAuthSession = OAuthAccessToken | {
    tokenType: 'proxy'
    accessToken: string
    userId: string
    expiresAt?: number | null
}

export const withMcpAuth = <
    Auth extends {
        api: {
            getMcpSession: (...args: any) => Promise<OAuthAccessToken | null>
        }
    }
>(
    auth: Auth,
    handler: (req: Request, session: McpAuthSession) => Response | Promise<Response>
) => {
    return async (req: Request) => {
        const host = req.headers.get('host')
        const authHeader = req.headers.get('authorization')
        
        // Determine which OAuth discovery endpoint to use based on the server configuration
        // For custom OAuth, point to our proxy endpoints
        const wwwAuthenticateValue = `Bearer resource_metadata=${host?.includes('localhost') ? 'http' : 'https'}://${host}/.well-known/oauth-authorization-server`
        
        let session: McpAuthSession | null = null
        
        console.log('[WithMcpAuth] Auth header:', authHeader?.substring(0, 20) + '...')
        
        // Check if this is a proxy token (starts with mcp_at_)
        if (authHeader?.startsWith('Bearer mcp_at_')) {
            const accessToken = authHeader.slice(7) // Remove 'Bearer ' prefix
            console.log('[WithMcpAuth] Detected proxy token, looking up in mcpProxyTokens')
            
            // Look up the proxy token
            const [proxyToken] = await db
                .select()
                .from(schema.mcpProxyTokens)
                .where(
                    and(
                        eq(schema.mcpProxyTokens.accessToken, accessToken),
                        gt(schema.mcpProxyTokens.expiresAt, Date.now())
                    )
                )
                .limit(1)
            
            console.log('[WithMcpAuth] Proxy token lookup result:', {
                found: !!proxyToken,
                upstreamTokenId: proxyToken?.upstreamTokenId,
                expiresAt: proxyToken?.expiresAt
            })
            
            if (proxyToken) {
                // Get the upstream token to find the user ID
                const [upstreamToken] = await db
                    .select()
                    .from(schema.upstreamOAuthTokens)
                    .where(eq(schema.upstreamOAuthTokens.id, proxyToken.upstreamTokenId))
                    .limit(1)
                
                console.log('[WithMcpAuth] Upstream token lookup result:', {
                    found: !!upstreamToken,
                    mcpServerUserId: upstreamToken?.mcpServerUserId,
                    oauthConfigId: upstreamToken?.oauthConfigId
                })
                
                if (upstreamToken) {
                    session = {
                        tokenType: 'proxy',
                        accessToken: accessToken,
                        userId: upstreamToken.mcpServerUserId,
                        expiresAt: proxyToken.expiresAt
                    }
                    console.log('[WithMcpAuth] Created proxy session with userId:', upstreamToken.mcpServerUserId)
                }
            }
        } else {
            console.log('[WithMcpAuth] Not a proxy token, trying platform OAuth session')
            // Try platform OAuth session
            session = await auth.api.getMcpSession({
                headers: req.headers
            })
            console.log('[WithMcpAuth] Platform OAuth session result:', {
                found: !!session,
                userId: session?.userId,
                sessionKeys: session ? Object.keys(session) : []
            })
        }
        
        if (!session) {
            return Response.json(
                {
                    jsonrpc: '2.0',
                    error: {
                        code: -32000,
                        message: 'Unauthorized: Authentication required',
                        'www-authenticate': wwwAuthenticateValue
                    },
                    id: null
                },
                {
                    status: 401,
                    headers: {
                        'WWW-Authenticate': wwwAuthenticateValue
                    }
                }
            )
        }
        return await Promise.resolve(handler(req, session))
    }
}
