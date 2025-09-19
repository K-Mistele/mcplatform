---
date: 2025-09-12T16:35:59-05:00
researcher: Claude
git_commit: 42c81168789b646f9ae4a8d419b1629bc296f0de
branch: master
repository: mcplatform
topic: "Custom OAuth get_support Tool Authentication Issue"
tags: [research, codebase, custom-oauth, authentication, mcp-tools, debugging]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: research
---

# Research: Custom OAuth get_support Tool Authentication Issue

**Date**: 2025-09-12T16:35:59-05:00
**Researcher**: Claude
**Git Commit**: 42c81168789b646f9ae4a8d419b1629bc296f0de
**Branch**: master
**Repository**: mcplatform

## Research Question
Why does the get_support MCP tool return "To get support, please log in and then call this tool again" when accessed through a custom OAuth-authenticated MCP server, even though the user was successfully authorized (able to list MCP tools)?

## Summary
The root cause is a table mismatch in the user email resolution logic. When using custom OAuth, the system correctly validates proxy tokens and creates sessions, but fails to retrieve user emails because it queries the wrong database table (`mcpOAuthUser` instead of `mcpServerUser`). This occurs in `packages/dashboard/src/lib/mcp/tracking.ts:75-80`.

## Detailed Findings

### Authentication Flow Analysis

#### Entry Point and Request Routing
- Request arrives at `/api/mcpserver/[...slug]/route.ts:22`
- VHost-based routing in `getMcpServerConfiguration()` extracts server config (`lib/mcp/index.ts:117-159`)
- Server config determines authentication type: `custom_oauth` vs `platform_oauth`

#### Custom OAuth Proxy Token Validation
When `authType === 'custom_oauth'`:
1. `withMcpAuth` middleware intercepts requests (`lib/mcp/with-mcp-auth.ts:23`)
2. Detects proxy tokens by `mcp_at_` prefix (`with-mcp-auth.ts:34`)
3. Validates token in `mcpProxyTokens` table (`with-mcp-auth.ts:38-46`)
4. Links to `upstreamOAuthTokens` via `upstreamTokenId` (`with-mcp-auth.ts:51-55`)
5. Creates session with `tokenType: 'proxy'` and `userId: upstreamToken.mcpServerUserId` (`with-mcp-auth.ts:58-64`)

#### User Context Resolution Bug
The critical failure occurs in `getAndTrackMcpServerUser()` (`lib/mcp/tracking.ts:72-82`):
```typescript
// Line 73: Gets session (works correctly for both auth types)
const session = await auth.api.getMcpSession({ headers: await headers() })

// Lines 75-80: INCORRECT - queries wrong table for custom OAuth
const user = await db.query.mcpOAuthUser.findFirst({
    where: eq(mcpOAuthUser.id, session.userId),
})
if (user) {
    email = user.email
}
```

**Problem**: For custom OAuth, `session.userId` contains `mcpServerUserId`, but the code queries `mcpOAuthUser` table which only contains platform OAuth users.

#### Tool-Level Authentication Check
The `get_support` tool checks for email availability (`lib/mcp/tools/support.ts:111-114`):
```typescript
if ('email' in args) submissionEmail = args.email as string
else if (email) submissionEmail = email  // This is null due to bug above
else return {
    content: [{ type: 'text', text: 'To get support, please log in and then call this tool again.' }]
}
```

### Database Schema Analysis

#### Platform OAuth Tables
- `mcpOAuthUser`: Stores platform OAuth users
- `mcpOAuthSession`: Platform OAuth sessions
- `mcpOAuthAccount`: OAuth provider accounts

#### Custom OAuth Tables
- `mcpServerUser`: Stores ALL MCP server users (including custom OAuth)
- `upstreamOAuthTokens`: Links to upstream OAuth tokens
- `mcpProxyTokens`: Proxy tokens issued to MCP clients
- `customOAuthConfigs`: OAuth server configurations

The user email for custom OAuth is stored in `mcpServerUser.email`, not `mcpOAuthUser.email`.

### Session Type Discrimination
Sessions can be differentiated using the `tokenType` property:
- Custom OAuth: `{ tokenType: 'proxy', userId: string, accessToken: string, expiresAt?: number }`
- Platform OAuth: Standard `OAuthAccessToken` type (no `tokenType` property)

## Code References
- `packages/dashboard/src/lib/mcp/tracking.ts:75-80` - Bug location: incorrect table query
- `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:58-64` - Proxy session creation
- `packages/dashboard/src/lib/mcp/tools/support.ts:111-114` - Login required message
- `packages/dashboard/src/app/oauth/callback/route.ts:264-277` - User creation for custom OAuth
- `packages/database/src/schema.ts:199-212` - mcpServerUser table definition

## Architecture Insights
1. **Dual Authentication Systems**: Platform auth (for dashboard customers) vs MCP auth (for end-users)
2. **VHost-Based Routing**: Server identification through subdomain (`acme.mcplatform.com`)
3. **Proxy Token Pattern**: MCPlatform acts as OAuth proxy, never exposing upstream tokens to MCP clients
4. **Layered Authentication**: Transport-level (withMcpAuth) and tool-level (email requirement) checks

## Proposed Solutions

### Option 1: Fix Table Query Based on Session Type (Recommended)
Modify `packages/dashboard/src/lib/mcp/tracking.ts:72-82` to check session type:

```typescript
if (serverConfig.authType?.includes('oauth')) {
    const session = await auth.api.getMcpSession({ headers: await headers() })
    if (session) {
        // Check if this is a proxy session (custom OAuth)
        if ('tokenType' in session && session.tokenType === 'proxy') {
            // Query mcpServerUser table for custom OAuth
            const user = await db.query.mcpServerUser.findFirst({
                where: eq(mcpServerUser.id, session.userId),
            })
            if (user) {
                email = user.email
            }
        } else {
            // Existing logic for platform OAuth
            const user = await db.query.mcpOAuthUser.findFirst({
                where: eq(mcpOAuthUser.id, session.userId),
            })
            if (user) {
                email = user.email
            }
        }
    }
}
```

### Option 2: Unified User Lookup
Create a helper function that abstracts user lookup across both authentication systems:

```typescript
async function getMcpUserEmail(session: McpAuthSession): Promise<string | null> {
    if ('tokenType' in session && session.tokenType === 'proxy') {
        const user = await db.query.mcpServerUser.findFirst({
            where: eq(mcpServerUser.id, session.userId),
        })
        return user?.email ?? null
    } else {
        const user = await db.query.mcpOAuthUser.findFirst({
            where: eq(mcpOAuthUser.id, session.userId),
        })
        return user?.email ?? null
    }
}
```

### Option 3: Store Email in Session
Modify the proxy session creation in `withMcpAuth` to include the email directly, avoiding the need for an additional database query. This would require updating the session type definition and proxy token validation logic.

## Impact Analysis
- **Option 1**: Minimal change, fixes the immediate issue, maintains existing architecture
- **Option 2**: Better code organization, reusable helper, slightly more refactoring
- **Option 3**: Performance improvement (fewer DB queries), but requires session type changes

## Recommendation
Implement **Option 1** as an immediate fix, as it:
- Requires minimal code changes
- Maintains backward compatibility
- Fixes the issue without architectural changes
- Can be easily tested with existing custom OAuth setups

The fix should be applied to `packages/dashboard/src/lib/mcp/tracking.ts:72-82` with proper session type checking using the `tokenType` discriminator.