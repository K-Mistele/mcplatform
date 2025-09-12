---
date: "2025-09-12T11:53:22-05:00"
researcher: "Assistant"
git_commit: "1e9eee49f2f7c242bd0410eada9e705058852f58"
branch: "08-custom-oauth"
repository: "mcplatform"
topic: "OAuth User Creation with Better Auth - Foreign Key Constraint Investigation"
tags: [research, oauth, better-auth, user-provisioning, mcp-server-user, foreign-key]
status: complete
last_updated: "2025-09-12"
last_updated_by: "Assistant"
type: research
---

# Research: OAuth User Creation with Better Auth - Foreign Key Constraint Investigation

**Date**: 2025-09-12T11:53:22-05:00
**Researcher**: Assistant
**Git Commit**: 1e9eee49f2f7c242bd0410eada9e705058852f58
**Branch**: 08-custom-oauth
**Repository**: mcplatform

## Research Question
Why is the PKCE implementation failing with a foreign key constraint violation when storing upstream OAuth tokens, and what are the implications of implementing the missing user creation logic given that Better Auth manages user creation?

## Summary
The OAuth callback handler in the custom OAuth proxy implementation creates placeholder user IDs (`mcp_user_${nanoid()}`) but never creates corresponding `mcpServerUser` records in the database. This causes a foreign key constraint violation when trying to store upstream OAuth tokens. The system needs to properly create users by fetching userinfo from the upstream OAuth provider and following the established user creation patterns in the codebase. Better Auth is used for platform authentication but NOT for the custom OAuth proxy flow - these are intentionally separate systems.

## Detailed Findings

### Root Cause of the Error
- **Location**: `packages/dashboard/src/app/oauth/callback/route.ts:173-191`
- **Issue**: Generates placeholder user ID `mcp_user_${nanoid()}` at line 175
- **Problem**: Attempts to insert into `upstreamOAuthTokens` with non-existent `mcpServerUserId`
- **Database Constraint**: Foreign key requires valid reference to `mcp_server_user.id`
- **Correct ID Format**: Should be `mcpu_${nanoid(12)}` per schema default

### Dual Authentication Architecture

#### Platform Authentication (Better Auth)
- **Purpose**: Manages dashboard access for paying customers
- **Tables**: `user`, `session`, `account` (standard Better Auth schema)
- **Configuration**: `packages/dashboard/src/lib/auth/auth.ts:22-56`
- **Plugins**: Organization management, MCP OAuth server
- **Users**: Platform customers with dashboard access

#### MCP OAuth System (Custom Proxy)
- **Purpose**: De-anonymizes end-users of customer products
- **Tables**: `mcp_server_user`, `upstream_oauth_tokens`, `mcp_proxy_tokens`
- **Configuration**: Custom OAuth proxy endpoints (`/oauth/*`)
- **Implementation**: Separate from Better Auth, manually managed
- **Users**: End-users who NEVER get dashboard access

#### Sub-tenant Authentication (Better Auth MCP Instance)
- **Purpose**: Alternative OAuth identification for end-users
- **Tables**: `mcp_oauth_user`, `mcp_oauth_session`, `mcp_oauth_account`
- **Configuration**: `packages/dashboard/src/lib/auth/mcp/auth.ts:17-52`
- **Base Path**: `/mcp-oidc/auth`
- **Note**: Separate Better Auth instance, not used by custom OAuth proxy

### OAuth Callback Flow Analysis

1. **Token Exchange** (`route.ts:126-167`)
   - Successfully exchanges authorization code with upstream provider
   - Receives access_token and optional refresh_token

2. **User ID Generation** (`route.ts:173-176`)
   ```typescript
   // Current problematic implementation
   const userId = `mcp_user_${nanoid()}`  // Wrong format, no DB record
   ```

3. **Token Storage Failure** (`route.ts:179-191`)
   - Tries to insert into `upstreamOAuthTokens`
   - Foreign key constraint fails - user doesn't exist

### Existing User Creation Patterns

#### Pattern from Tracking System
- **Location**: `packages/dashboard/src/lib/mcp/tracking.ts:138-220`
- **Approach**: Upsert with conflict handling
```typescript
const query = db.insert(schema.mcpServerUser).values({
    email,
    trackingId
}).onConflictDoUpdate({
    target: [schema.mcpServerUser.trackingId],
    set: { email }
})
```
- **ID Generation**: `mcpu_${nanoid(12)}` via schema default
- **Deduplication**: By email or trackingId

#### UserInfo Endpoint Implementation
- **Location**: `packages/dashboard/src/app/oauth/userinfo/route.ts:133-174`
- **Fetches**: User profile from upstream OAuth provider
- **Updates**: `upstreamOAuthTokens.mcpServerUserId` with upstream `sub`
- **Missing**: Doesn't create `mcpServerUser` records

## Architecture Insights

### Why Better Auth Isn't Used for Custom OAuth
1. **Intentional Separation**: Custom OAuth proxy handles customer-specific OAuth providers
2. **Security Boundary**: End-users must never access platform features
3. **Flexibility**: Supports any OAuth provider, not just preconfigured social logins

### Database Relationships
- `mcpServerUser`: Core user tracking table with analytics fields
- `upstreamOAuthTokens`: Links OAuth tokens to users (foreign key to `mcpServerUser`)
- `mcpProxyTokens`: Tokens issued to MCP clients
- `mcpOAuthUser`: Separate table for Better Auth MCP instance (not used here)

### Security Considerations
- **No Dashboard Access**: Custom OAuth users must remain isolated
- **Organization Scoping**: Users belong to specific MCP servers/organizations
- **Token Isolation**: Upstream tokens never exposed to clients
- **Session Management**: Custom OAuth sessions separate from platform sessions

## Implementation Requirements

### Immediate Fix Needed
1. **Fetch UserInfo**: Call upstream userinfo endpoint after token exchange
2. **Create User Record**: Insert into `mcpServerUser` with proper ID format
3. **Handle Deduplication**: Check for existing users by email/sub
4. **Update Token Record**: Link `upstreamOAuthTokens` to real user ID

### Proposed Implementation Location
- **File**: `packages/dashboard/src/app/oauth/callback/route.ts`
- **After Line**: 167 (successful token exchange)
- **Before Line**: 179 (token storage)

### Code Pattern to Follow
```typescript
// After successful token exchange (line 167)
// Fetch userinfo from upstream provider
const userinfoUrl = oauthConfig.userinfoUrl || 
    await discoverUserinfoEndpoint(oauthConfig)

const userinfoResponse = await fetch(userinfoUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
})

let email: string | undefined
let upstreamUserId: string | undefined

if (userinfoResponse.ok) {
    const userinfo = await userinfoResponse.json()
    email = userinfo.email
    upstreamUserId = userinfo.sub
}

// Create or find mcpServerUser
let mcpServerUserId: string | undefined

if (email || upstreamUserId) {
    // Try to find existing user
    const [existingUser] = await db
        .select()
        .from(schema.mcpServerUser)
        .where(email ? eq(schema.mcpServerUser.email, email) : 
               sql`false`)
        .limit(1)
    
    if (existingUser) {
        mcpServerUserId = existingUser.id
    } else {
        // Create new user
        const [newUser] = await db
            .insert(schema.mcpServerUser)
            .values({ email })
            .returning()
        mcpServerUserId = newUser.id
    }
} else {
    // Fallback: Create user without email
    const [newUser] = await db
        .insert(schema.mcpServerUser)
        .values({})
        .returning()
    mcpServerUserId = newUser.id
}

// Now store tokens with valid user ID
const [upstreamToken] = await db
    .insert(schema.upstreamOAuthTokens)
    .values({
        id: `uoat_${nanoid()}`,
        mcpServerUserId,  // Valid foreign key
        // ... rest of token data
    })
```

## Historical Context (from thoughts/)
- Custom OAuth was designed as a three-phase implementation (Core → Proxy → UI)
- Phase 2 (OAuth Proxy) was marked complete but left user creation as TODO
- PKCE support was added separately to fix MCP client compatibility
- User creation was never part of PKCE scope - it's a pre-existing gap

## Related Research
- `specifications/08-custom-oauth/research/research_2025-09-05_10-35-05_comprehensive-oauth-system-analysis.md` - Original OAuth system analysis
- `specifications/08-custom-oauth/02-code-challenge/research_2025-09-12_10-44-28_pkce-s256-implementation.md` - PKCE implementation research
- `specifications/08-custom-oauth/implementation-plan.md` - Master implementation plan

## Open Questions
1. **User Deduplication**: Should users be deduplicated across different MCP servers in the same organization?
2. **Missing Userinfo**: How to handle OAuth providers that don't provide userinfo endpoints?
3. **Profile Updates**: Should the system periodically refresh user profile data from upstream?
4. **Email Verification**: Is email verification needed for OAuth-created users?

## Code References
- `packages/dashboard/src/app/oauth/callback/route.ts:173-191` - Problematic placeholder user creation
- `packages/dashboard/src/lib/mcp/tracking.ts:138-220` - Proper user creation pattern to follow
- `packages/dashboard/src/app/oauth/userinfo/route.ts:133-174` - Existing userinfo fetching
- `packages/database/src/schema.ts:157-168` - mcpServerUser table schema
- `packages/database/src/schema.ts:486-508` - upstreamOAuthTokens foreign key constraint