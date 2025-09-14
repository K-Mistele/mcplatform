---
date: 2025-09-12T20:53:51-05:00
researcher: Claude
git_commit: 6c057ac1186801b9cc126a751b7b579c827db00b
branch: master
repository: mcplatform
topic: "Custom OAuth get_support Tool Authentication Fix"
tags: [implementation, custom-oauth, authentication, mcp-tools, bug-fix, tracking]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: Custom OAuth get_support Tool Authentication Fix

## Task(s)
1. **Root cause analysis of get_support tool authentication failure** (completed)
   - Investigated why the tool returns "To get support, please log in and then call this tool again" for custom OAuth users
   - Added comprehensive logging throughout the authentication flow
   - Identified the root cause as a race condition in the request flow

2. **Implement fix for authentication issue** (completed)
   - Modified the tracking system to handle proxy tokens directly
   - Passed request object through to enable pre-middleware token resolution
   - Verified fix resolves the issue

3. **Code cleanup and refactoring strategy** (planned/discussed)
   - Identified refactoring opportunities to make the code more maintainable
   - Proposed extraction of reusable functions for proxy token resolution

## Recent changes
1. `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:46-49` - Added request parameter to getAndTrackMcpServerUser call and logging
2. `packages/dashboard/src/lib/mcp/tracking.ts:7` - Added missing imports (and, gt)
3. `packages/dashboard/src/lib/mcp/tracking.ts:57-123` - Added request parameter and direct proxy token resolution logic for custom OAuth
4. `packages/dashboard/src/lib/mcp/tracking.ts:73-131` - Added comprehensive logging for debugging (to be removed)
5. `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:33-92` - Added logging for proxy token validation flow (to be removed)
6. `packages/dashboard/src/lib/mcp/tools/support.ts:97-129` - Added logging for email resolution in support tool (to be removed)

## Learnings

### Root Cause: Race Condition in Authentication Flow
The critical issue was that `getAndTrackMcpServerUser` was being called **before** the `withMcpAuth` middleware ran. This meant:
- The Better Auth session wasn't established yet when trying to get user info
- The tracking system couldn't access the OAuth session data
- It would create/find a different user than the one authenticated via proxy token

### Dual User Creation Issue
The system was creating two different users:
1. `mcpu_*` (mcpServerUser) - Created by custom OAuth flow, contains the actual user email
2. `mcpou_*` (mcpOAuthUser) - Created by Better Auth MCP instance for platform OAuth

The confusion arose because the request flow was:
1. Route handler calls tracking (no auth yet) → creates/finds wrong user
2. Handler wrapped with withMcpAuth → authenticates correct user
3. Support tool receives wrong user's (empty) email

### Authentication Architecture
- **Two separate auth systems**: Platform auth (dashboard users) vs MCP auth (end-users)
- **Proxy token pattern**: MCPlatform acts as OAuth proxy, never exposing upstream tokens
- **Token chain**: `mcpProxyTokens` → `upstreamOAuthTokens` → `mcpServerUser`
- **Session types**: Proxy sessions have `tokenType: 'proxy'`, platform sessions don't

### Database Schema Insights
- `mcpServerUser` table stores custom OAuth users with email field
- `mcpOAuthUser` table stores platform OAuth users (separate system)
- Previous fix in tracking.ts for session type discrimination was correct but ineffective due to race condition

## Artifacts
1. `/Users/kyle/Documents/Projects/mcplatform/specifications/08-custom-oauth/research/research_2025-09-12_16-35-59_custom-oauth-get-support-tool-auth-issue.md` - Original bug research (now outdated)
2. `/Users/kyle/Documents/Projects/mcplatform/specifications/08-custom-oauth/research/research_2025-09-12_20-27-19_get-support-tool-auth-issue-resolved.md` - Updated research showing fix status
3. Modified source files listed in Recent Changes section

## Action Items & Next Steps

### Immediate: Remove Debug Logging
1. Remove all console.log statements from:
   - `packages/dashboard/src/lib/mcp/tracking.ts` (lines 73-131 contain extensive logging)
   - `packages/dashboard/src/lib/mcp/with-mcp-auth.ts` (lines 33-92)
   - `packages/dashboard/src/lib/mcp/tools/support.ts` (lines 97-129)
   - `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts` (lines 51-56)

### Refactoring: Extract Reusable Functions
1. **Create `resolveProxyTokenToUser()` function**:
   - Extract proxy token lookup logic from `tracking.ts:82-121`
   - Should return `{userId: string, email: string | null}`
   - Reuse in both `withMcpAuth` and `tracking.ts`

2. **Create `isProxySession()` type guard**:
   - Replace inline checks `'tokenType' in session && session.tokenType === 'proxy'`
   - Use throughout codebase for cleaner session type discrimination

3. **Consolidate duplicate token lookups**:
   - Same logic appears in `withMcpAuth.ts:38-80` and `tracking.ts:87-121`
   - Should have single source of truth

4. **Simplify email resolution hierarchy**:
   - Clear order: proxy token → Better Auth session → tracking ID
   - Remove redundant fallback logic in `tracking.ts:125-145`

### Testing
1. Verify fix works for all custom OAuth configurations
2. Ensure platform OAuth still functions correctly
3. Test other MCP tools that depend on user email/authentication

## Other Notes

### Key File Locations
- **OAuth endpoints**: `packages/dashboard/src/app/oauth/` - Custom OAuth proxy implementation
- **MCP OAuth**: `packages/dashboard/src/app/mcp-oidc/` - Platform OAuth (Better Auth)
- **Auth configuration**: `packages/dashboard/src/lib/auth/mcp/auth.ts` - MCP Better Auth instance
- **OAuth discovery**: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts` - Returns correct endpoints based on auth type

### Important Patterns
- VHost-based routing extracts server config from subdomain
- OAuth discovery endpoint correctly returns `/oauth/*` endpoints for custom OAuth
- Proxy tokens use `mcp_at_` prefix for easy identification
- Session establishment happens in middleware, not in route handlers

### SQL Queries for Debugging
To check which user a token points to:
```sql
-- Check proxy token mapping
SELECT pt.token, ut.mcp_server_user_id, msu.email
FROM mcp_proxy_tokens pt
JOIN upstream_oauth_tokens ut ON pt.upstream_token_id = ut.id
JOIN mcp_server_user msu ON ut.mcp_server_user_id = msu.id
WHERE pt.access_token = 'mcp_at_YOUR_TOKEN';
```

### Configuration Dependencies
- Server must have `authType: 'custom_oauth'` 
- Must have valid `customOAuthConfigId` pointing to OAuth configuration
- OAuth configuration must return email in userInfo response