import type { OAuthAccessToken } from 'better-auth/plugins'
import { resolveProxyTokenToUser } from './auth-utils'
import type { McpSessionWithType } from './types'

// Re-export the session type for compatibility
export type McpAuthSession = McpSessionWithType

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
        
        
        // Check if this is a proxy token (starts with mcp_at_)
        if (authHeader?.startsWith('Bearer mcp_at_')) {
            const accessToken = authHeader.slice(7) // Remove 'Bearer ' prefix
            const proxyUser = await resolveProxyTokenToUser(accessToken)
            
            if (proxyUser) {
                session = {
                    tokenType: 'proxy',
                    accessToken: accessToken,
                    userId: proxyUser.userId,
                    expiresAt: proxyUser.expiresAt
                }
            }
        } else {
            // Try platform OAuth session
            session = await auth.api.getMcpSession({
                headers: req.headers
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
