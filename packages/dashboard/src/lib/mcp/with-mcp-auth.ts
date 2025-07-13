import type { OAuthAccessToken } from 'better-auth/plugins'

export const withMcpAuth = <
    Auth extends {
        api: {
            getMcpSession: (...args: any) => Promise<OAuthAccessToken | null>
        }
    }
>(
    auth: Auth,
    handler: (req: Request, sesssion: OAuthAccessToken) => Response | Promise<Response>
) => {
    return async (req: Request) => {
        const session = await auth.api.getMcpSession({
            headers: req.headers
        })
        const host = req.headers.get('host')
        const wwwAuthenticateValue = `Bearer resource_metadata=${host?.includes('localhost') ? 'http' : 'https'}://${host}/authtenant/auth/.well-known/oauth-authorization-server`
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
        return handler(req, session)
    }
}
