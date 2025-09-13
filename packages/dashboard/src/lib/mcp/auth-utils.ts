import { db, schema } from 'database'
import { and, eq, gt } from 'drizzle-orm'
import { auth } from '../auth/mcp/auth'
import type { McpServerConfig } from './types'

/**
 * Information about a proxy token and its associated user
 */
export interface ProxyTokenInfo {
    userId: string
    email: string | null
    upstreamTokenId: string
    expiresAt: number | null
}

/**
 * Unified authentication information for MCP users
 */
export interface McpUserAuth {
    userId: string
    email: string | null
    authType: 'proxy' | 'platform' | 'tracking'
    sessionId?: string
}

/**
 * Type guard to check if a session is a proxy session
 */
export function isProxySession(session: any): session is { tokenType: 'proxy'; accessToken: string; userId: string } {
    return session?.tokenType === 'proxy'
}

/**
 * Resolve a proxy token to its associated user information
 * @param accessToken The proxy access token to resolve
 * @returns User information or null if token is invalid/expired
 */
export async function resolveProxyTokenToUser(accessToken: string): Promise<{ userId: string; email: string | null; expiresAt: number | null } | null> {
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
    
    if (!proxyToken) {
        return null
    }
    
    // Get the upstream token to find the user ID
    const [upstreamToken] = await db
        .select()
        .from(schema.upstreamOAuthTokens)
        .where(eq(schema.upstreamOAuthTokens.id, proxyToken.upstreamTokenId))
        .limit(1)
    
    if (!upstreamToken) {
        return null
    }
    
    // Get the user's email from mcpServerUser
    const [user] = await db
        .select()
        .from(schema.mcpServerUser)
        .where(eq(schema.mcpServerUser.id, upstreamToken.mcpServerUserId))
        .limit(1)
    
    return {
        userId: upstreamToken.mcpServerUserId,
        email: user?.email || null,
        expiresAt: proxyToken.expiresAt
    }
}

/**
 * Comprehensive function to resolve MCP user authentication from various sources
 * @param request The incoming request
 * @param serverConfig The MCP server configuration
 * @param trackingId Optional tracking ID
 * @returns Unified authentication information
 */
export async function resolveMcpUserAuth(
    request: Request,
    serverConfig: McpServerConfig,
    trackingId?: string | null
): Promise<McpUserAuth | null> {
    const authHeader = request.headers.get('authorization')
    
    // 1. Check for proxy token in Authorization header (only for custom OAuth servers)
    if (serverConfig.authType === 'custom_oauth' && authHeader?.startsWith('Bearer mcp_at_')) {
        const accessToken = authHeader.slice(7) // Remove 'Bearer ' prefix
        const proxyUser = await resolveProxyTokenToUser(accessToken)
        
        if (proxyUser) {
            return {
                userId: proxyUser.userId,
                email: proxyUser.email,
                authType: 'proxy'
            }
        }
    }
    
    // 2. Check for Better Auth session (proxy or platform)
    const session = await auth.api.getMcpSession({ headers: request.headers })
    if (session) {
        // Check if it's a proxy session
        if (isProxySession(session)) {
            const proxyUser = await resolveProxyTokenToUser(session.accessToken)
            if (proxyUser) {
                return {
                    userId: proxyUser.userId,
                    email: proxyUser.email,
                    authType: 'proxy'
                }
            }
        } else {
            // Platform OAuth session
            const [oauthUser] = await db
                .select()
                .from(schema.mcpOauthUser)
                .where(eq(schema.mcpOauthUser.id, session.userId))
                .limit(1)
            
            if (oauthUser) {
                return {
                    userId: oauthUser.id,
                    email: oauthUser.email,
                    authType: 'platform',
                    sessionId: session.sessionId
                }
            }
        }
    }
    
    // 3. Check existing session via Mcp-Session-Id header
    const sessionId = request.headers.get('Mcp-Session-Id')
    if (sessionId) {
        const [existingSession] = await db
            .select()
            .from(schema.mcpServerSession)
            .where(eq(schema.mcpServerSession.id, sessionId))
            .limit(1)
        
        if (existingSession?.mcpServerUserId) {
            const [user] = await db
                .select()
                .from(schema.mcpServerUser)
                .where(eq(schema.mcpServerUser.id, existingSession.mcpServerUserId))
                .limit(1)
            
            if (user) {
                return {
                    userId: user.id,
                    email: user.email,
                    authType: 'tracking',
                    sessionId
                }
            }
        }
    }
    
    // 4. Fallback to tracking ID
    if (trackingId) {
        // This will be handled by the calling code as it needs to create a new user
        return null
    }
    
    return null
}

/**
 * Resolve user email with clear priority order
 * @param request The incoming request
 * @param serverConfig The MCP server configuration
 * @param trackingId Optional tracking ID
 * @param emailParam Optional email parameter
 * @returns Email resolution result
 */
export async function resolveMcpUserEmail(
    request: Request,
    serverConfig: McpServerConfig,
    trackingId?: string | null,
    emailParam?: string | null
): Promise<{ email: string | null; userId: string; method: 'proxy' | 'session' | 'tracking' | 'fallback' }> {
    // Try to get auth information
    const authInfo = await resolveMcpUserAuth(request, serverConfig, trackingId)
    
    if (authInfo) {
        return {
            email: authInfo.email,
            userId: authInfo.userId,
            method: authInfo.authType === 'proxy' ? 'proxy' : authInfo.authType === 'platform' ? 'session' : 'tracking'
        }
    }
    
    // If no auth found but we have trackingId or email param, create/find user
    if (trackingId || emailParam) {
        // This logic will be handled by the calling code as it involves user creation
        // Return a placeholder that indicates fallback is needed
        return {
            email: emailParam || null,
            userId: '', // Will be filled by calling code
            method: 'fallback'
        }
    }
    
    // No identification possible
    return {
        email: null,
        userId: '',
        method: 'fallback'
    }
}