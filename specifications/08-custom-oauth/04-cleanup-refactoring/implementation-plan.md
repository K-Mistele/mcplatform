---
date: 2025-09-12T21:00:37-05:00
researcher: Claude
git_commit: 6c057ac1186801b9cc126a751b7b579c827db00b
branch: master
repository: mcplatform
topic: "Custom OAuth Authentication Cleanup & Refactoring Implementation Strategy"
tags: [implementation, strategy, custom-oauth, authentication, refactoring, mcp-tools, cleanup]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: implementation_strategy
---

# Custom OAuth Authentication Cleanup & Refactoring Implementation Plan

## Overview

This plan addresses the cleanup and refactoring of the custom OAuth authentication system following the successful fix for the get_support tool authentication issue. We'll remove debug logging, extract reusable authentication utilities, and create a centralized interface for all MCP server tool authentication needs.

## Current State Analysis

The custom OAuth authentication fix is working but has accumulated technical debt:
- Extensive debug logging across 4 files exposing sensitive data
- Duplicate proxy token resolution logic in `tracking.ts` and `with-mcp-auth.ts`
- Complex cascading email resolution scattered across multiple functions
- No single source of truth for MCP authentication lookups

### Key Discoveries:
- Proxy token resolution logic duplicated in `packages/dashboard/src/lib/mcp/tracking.ts:82-121` and `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:35-81`
- Debug logging spans 100+ lines across 4 files
- Email resolution uses 4-level cascade that could be simplified
- Authentication type checking uses inline string comparisons instead of type guards

## What We're NOT Doing

- Changing the core authentication flow or business logic
- Modifying database schemas or migrations
- Altering the dual authentication system architecture
- Changing the proxy token format or OAuth endpoints
- Adding new authentication methods

## Implementation Approach

We'll create centralized authentication utilities that provide a clean interface for MCP server tools, remove all debug logging, and refactor existing code to use these utilities. This will establish a single source of truth for authentication while maintaining backward compatibility.

## Phase 1: Core Authentication Utilities

### Overview
Create a new utilities module with reusable authentication functions that consolidate all MCP auth-related lookups and provide a unified interface for tools.

### Changes Required:

#### 1. Create Authentication Utilities Module
**File**: `packages/dashboard/src/lib/mcp/auth-utils.ts` (new file)
**Changes**: Create new file with utility functions

**Implementation Requirements:**
- Export `resolveProxyTokenToUser()` function that handles proxy token → upstream token → user resolution
  - Accept access token string as input
  - Query mcpProxyTokens table with expiration check
  - Join with upstreamOAuthTokens to get user ID
  - Join with mcpServerUser to get email
  - Return `{userId: string, email: string | null}` or null if not found
- Export `isProxySession()` type guard for session type discrimination
  - Check for presence of `tokenType` field
  - Verify `tokenType === 'proxy'`
  - Return type predicate for TypeScript narrowing
- Export `resolveMcpUserAuth()` comprehensive function for tools
  - Accept request, serverConfig, and trackingId parameters
  - Check authorization header for proxy tokens first
  - Fall back to Better Auth session lookup
  - Query appropriate user table based on auth type
  - Return unified `McpUserAuth` object with email and userId
- Include proper TypeScript types for all return values
- Handle null/undefined cases gracefully without throwing
- Use existing database schema imports from `@/db/schema`
- Follow existing error handling patterns

#### 2. Type Definitions
**File**: `packages/dashboard/src/lib/mcp/types.ts` (update or create)
**Changes**: Add/update authentication-related types

**Implementation Requirements:**
- Define `McpUserAuth` interface:
  ```typescript
  interface McpUserAuth {
    userId: string
    email: string | null
    authType: 'proxy' | 'platform' | 'tracking'
    sessionId?: string
  }
  ```
- Define `ProxyTokenInfo` interface:
  ```typescript
  interface ProxyTokenInfo {
    userId: string
    email: string | null
    upstreamTokenId: string
    expiresAt: number
  }
  ```
- Add `McpSessionWithType` type extending existing session:
  ```typescript
  type McpSessionWithType = McpAuthSession & {
    tokenType?: 'proxy'
  }
  ```
- Ensure types are exported and reusable across modules
- Include JSDoc comments for clarity

### Success Criteria:

**Automated verification**
- [ ] `bun run typecheck` passes without errors
- [ ] `bun lint` passes without warnings

**Manual Verification**
- [ ] New utility functions are properly typed and exported
- [ ] Functions handle null/undefined inputs gracefully
- [ ] No runtime errors when imported in other modules

## Phase 2: Remove Debug Logging

### Overview
Remove all console.log statements added during debugging while preserving core functionality.

### Changes Required:

#### 1. Clean Tracking Module
**File**: `packages/dashboard/src/lib/mcp/tracking.ts`
**Changes**: Remove debug logging from lines 73-131

**Implementation Requirements:**
- Remove console.log at line 75 (OAuth detection)
- Remove console.log at lines 80, 84 (proxy token detection)
- Remove console.log at lines 107, 116 (token lookup results)
- Remove console.log at lines 128-134 (session analysis)
- Remove console.log at lines 139, 146-151, 154, 157-163 (user queries)
- Preserve all functional code between log statements
- Maintain proper error handling without logs

#### 2. Clean Authentication Middleware
**File**: `packages/dashboard/src/lib/mcp/with-mcp-auth.ts`
**Changes**: Remove debug logging from lines 33-92

**Implementation Requirements:**
- Remove console.log at line 33 (auth header substring)
- Remove console.log at line 38 (proxy token detection)
- Remove console.log at lines 52-56 (proxy token lookup)
- Remove console.log at lines 66-70 (upstream token lookup)
- Remove console.log at line 79 (session creation)
- Remove console.log at line 83 (platform OAuth attempt)
- Remove console.log at lines 88-92 (platform OAuth session)
- Keep all authentication logic intact

#### 3. Clean Support Tool
**File**: `packages/dashboard/src/lib/mcp/tools/support.ts`
**Changes**: Remove debug logging from lines 97-129

**Implementation Requirements:**
- Remove console.log at lines 97-103 (email parameters)
- Remove console.log at lines 107, 120, 123, 125 (decision flow)
- Preserve email resolution logic structure
- Maintain error response formatting

#### 4. Clean Route Handler
**File**: `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts`
**Changes**: Remove debug logging from lines 31, 51-56, 71

**Implementation Requirements:**
- Remove console.log at line 31 (JSON RPC request)
- Remove console.log at lines 52-56 (user data logging)
- Remove console.log at line 71 (JSON RPC response)
- Keep request/response stream handling
- Maintain session header injection

### Success Criteria:

**Automated verification**
- [ ] `bun lint` passes without errors
- [ ] `bun run typecheck` passes

**Manual Verification**
- [ ] No console.log statements remain in cleaned files
- [ ] Authentication flow still works correctly
- [ ] No sensitive data logged to console

## Phase 3: Refactor to Use Utilities

### Overview
Update existing code to use the new authentication utilities, eliminating code duplication.

### Changes Required:

#### 1. Refactor Tracking Module
**File**: `packages/dashboard/src/lib/mcp/tracking.ts`
**Changes**: Use new utility functions

**Implementation Requirements:**
- Import `resolveProxyTokenToUser`, `isProxySession`, `resolveMcpUserAuth` from auth-utils
- Replace inline proxy token resolution (lines 82-121) with:
  ```typescript
  const proxyUser = await resolveProxyTokenToUser(accessToken)
  if (proxyUser) {
    userId = proxyUser.userId
    email = proxyUser.email
  }
  ```
- Replace inline session type checks with `isProxySession(session)`
- Extract duplicate user insertion logic (lines 222-237, 276-287) into helper function
- Extract duplicate user lookup logic (lines 244-253, 294-303) into helper function
- Maintain existing function signatures for backward compatibility
- Keep session and user tracking logic intact

#### 2. Refactor Authentication Middleware
**File**: `packages/dashboard/src/lib/mcp/with-mcp-auth.ts`
**Changes**: Use shared token resolution

**Implementation Requirements:**
- Import `resolveProxyTokenToUser` from auth-utils
- Replace duplicate token lookup (lines 35-81) with:
  ```typescript
  const proxyUser = await resolveProxyTokenToUser(accessToken)
  if (proxyUser) {
    session = {
      tokenType: 'proxy',
      accessToken,
      userId: proxyUser.userId,
      expiresAt: proxyUser.expiresAt
    }
  }
  ```
- Maintain session object creation with proper types
- Keep WWW-Authenticate header construction
- Preserve error response format

#### 3. Update Support Tool
**File**: `packages/dashboard/src/lib/mcp/tools/support.ts`
**Changes**: Use centralized auth resolution

**Implementation Requirements:**
- Import `resolveMcpUserAuth` from auth-utils
- Replace complex email resolution (lines 105-129) with simplified logic
- Use utility function result to get email directly
- Maintain tool registration flow
- Keep database operation atomicity
- Simplify conditional logic for email handling

### Success Criteria:

**Automated verification**
- [ ] `bun run typecheck` passes
- [ ] `bun lint` passes
- [ ] `bun run tests` passes (if tests exist)

**Manual Verification**
- [ ] Custom OAuth flow works end-to-end
- [ ] Platform OAuth still functions
- [ ] Support tool correctly resolves email
- [ ] No duplicate code remains

## Phase 4: Simplify Email Resolution Hierarchy

### Overview
Streamline the cascading email resolution to be more maintainable and predictable.

### Changes Required:

#### 1. Consolidate Email Resolution in Utilities
**File**: `packages/dashboard/src/lib/mcp/auth-utils.ts`
**Changes**: Add comprehensive email resolver

**Implementation Requirements:**
- Create `resolveMcpUserEmail()` function with clear priority order:
  1. Direct proxy token from Authorization header
  2. Better Auth session (proxy or platform)
  3. Existing session lookup via Mcp-Session-Id
  4. TrackingId or email parameter fallback
- Document each resolution level with comments
- Handle all edge cases (no auth, missing email, etc.)
- Return structured result:
  ```typescript
  {
    email: string | null,
    userId: string,
    method: 'proxy' | 'session' | 'tracking' | 'fallback'
  }
  ```
- Use consistent null/undefined handling

#### 2. Update Tracking Function
**File**: `packages/dashboard/src/lib/mcp/tracking.ts`
**Changes**: Simplify email resolution section

**Implementation Requirements:**
- Replace complex cascading logic (lines 73-206) with:
  ```typescript
  const authResult = await resolveMcpUserEmail(request, serverConfig, trackingId)
  userId = authResult.userId
  email = authResult.email
  ```
- Remove redundant fallback patterns
- Maintain session update logic
- Keep user creation/update flow
- Preserve trackingId handling

### Success Criteria:

**Automated verification**
- [ ] `bun run typecheck` passes
- [ ] `bun lint` passes

**Manual Verification**
- [ ] Email resolution works for all auth types
- [ ] Tracking IDs still function
- [ ] Anonymous users handled correctly
- [ ] Edge cases don't cause errors

## Performance Considerations

- Removing console.log statements will reduce I/O overhead
- Consolidating database queries may reduce round trips
- Extracted utilities can be optimized in one place
- Type guards enable better TypeScript optimization

## Migration Notes

- No database migrations required
- Changes are backward compatible
- Existing sessions will continue to work
- No configuration changes needed

## Testing Strategy

### Manual Testing Checklist:
1. Test custom OAuth login flow end-to-end
2. Test platform OAuth login flow
3. Test get_support tool with authenticated user
4. Test get_support tool with anonymous user
5. Test proxy token expiration handling
6. Test session continuity across requests
7. Verify no sensitive data in logs

### Automated Testing (if applicable):
- Add unit tests for new utility functions
- Test edge cases (null tokens, expired tokens, missing users)
- Verify type guards work correctly
- Test email resolution priority order

## References

* Original bug ticket: `specifications/08-custom-oauth/handoffs/handoff_2025-09-12_20-53-51_get-support-auth-fix.md`
* Initial research: `specifications/08-custom-oauth/research/research_2025-09-12_16-35-59_custom-oauth-get-support-tool-auth-issue.md`
* Resolution research: `specifications/08-custom-oauth/research/research_2025-09-12_20-27-19_get-support-tool-auth-issue-resolved.md`
* Tracking implementation: `packages/dashboard/src/lib/mcp/tracking.ts:57-324`
* Auth middleware: `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:13-115`
* Support tool: `packages/dashboard/src/lib/mcp/tools/support.ts:11-170`
* Route handler: `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:22-95`