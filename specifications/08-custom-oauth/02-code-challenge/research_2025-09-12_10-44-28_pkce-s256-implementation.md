---
date: 2025-09-12T10:44:28-05:00
researcher: Claude
git_commit: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
branch: 08-custom-oauth
repository: mcplatform
topic: "PKCE S256 Code Challenge Implementation for Custom OAuth"
tags: [research, pkce, oauth, code-challenge, s256, authentication, custom-oauth]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: research
---

# Research: PKCE S256 Code Challenge Implementation for Custom OAuth

**Date**: 2025-09-12T10:44:28-05:00
**Researcher**: Claude
**Git Commit**: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
**Branch**: 08-custom-oauth
**Repository**: mcplatform

## Research Question
MCP clients are failing to connect with error "Incompatible auth server: does not support code challenge method S256" when using custom_oauth. What's missing in the custom OAuth implementation for PKCE support, and what needs to be implemented?

## Summary
The custom OAuth proxy implementation lacks PKCE (Proof Key for Code Exchange) support, while the platform OAuth correctly advertises S256 support. The issue stems from missing `code_challenge_methods_supported` in the OAuth discovery metadata for custom OAuth servers, and absent PKCE parameter handling throughout the authorization and token exchange flows. A complete PKCE implementation requires updates to discovery metadata, authorization request validation, session storage, and token verification logic.

## Detailed Findings

### Current State: Platform OAuth vs Custom OAuth

#### Platform OAuth (Working)
- `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:114` - Advertises `code_challenge_methods_supported: ['S256']`
- `packages/dashboard/src/lib/auth/mcp/auth.ts:38` - Uses better-auth v1.3.4 with built-in PKCE support
- Better-auth automatically handles code_challenge storage and code_verifier validation
- Discovery metadata correctly signals PKCE support to MCP clients

#### Custom OAuth (Not Working - Missing PKCE)
- `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:66-81` - Does NOT include `code_challenge_methods_supported`
- `packages/dashboard/src/app/oauth/authorize/route.ts:11-18` - Authorization schema missing `code_challenge` and `code_challenge_method` parameters
- `packages/dashboard/src/app/oauth/token/route.ts:10-18` - Token schema missing `code_verifier` parameter
- `packages/database/src/schema.ts:533-556` - Authorization sessions table missing PKCE fields

### PKCE RFC 7636 Requirements

PKCE is designed to protect OAuth authorization code flows from interception attacks. Key requirements:

1. **Discovery Metadata**: Must advertise `code_challenge_methods_supported: ['S256']`
2. **Authorization Request**: Accept `code_challenge` and `code_challenge_method` parameters
3. **Session Storage**: Store challenge and method with authorization code
4. **Token Exchange**: Validate `code_verifier` against stored challenge using SHA256
5. **Error Handling**: Return `invalid_grant` if PKCE verification fails

### What's Missing

#### 1. OAuth Discovery Metadata
The custom OAuth discovery endpoint doesn't advertise PKCE support, causing MCP clients to reject the server as incompatible.

**Location**: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:66-81`
**Missing**: `code_challenge_methods_supported: ['S256']`

#### 2. Authorization Request Parameters
The authorization endpoint doesn't accept or validate PKCE parameters from clients.

**Location**: `packages/dashboard/src/app/oauth/authorize/route.ts:11-18`
**Missing**: Schema validation for `code_challenge` and `code_challenge_method`

#### 3. Session Storage Schema
The database doesn't store PKCE parameters with authorization sessions.

**Location**: `packages/database/src/schema.ts:533-556` (mcpAuthorizationSessions table)
**Missing**: `codeChallenge` and `codeChallengeMethod` columns

#### 4. PKCE Verification Logic
The token endpoint doesn't verify code_verifier against the stored challenge.

**Location**: `packages/dashboard/src/app/oauth/token/route.ts:76-147`
**Missing**: Code verifier validation using SHA256 hashing

### Implementation Requirements

#### Phase 1: Update Discovery Metadata
```typescript
// packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:77
code_challenge_methods_supported: ['S256'],
```

#### Phase 2: Database Schema Changes
```typescript
// packages/database/src/schema.ts - Add to mcpAuthorizationSessions
codeChallenge: text('code_challenge'),
codeChallengeMethod: text('code_challenge_method')
```

#### Phase 3: Authorization Request Handling
```typescript
// packages/dashboard/src/app/oauth/authorize/route.ts:11-18
const authorizationRequestSchema = z.object({
    response_type: z.literal('code'),
    client_id: z.string(),
    redirect_uri: z.string().url(),
    scope: z.string().nullish(),
    state: z.string().nullish(),
    code_challenge: z.string().optional(),
    code_challenge_method: z.enum(['S256', 'plain']).optional()
})

// Store PKCE parameters in session (line 178-188)
await db.insert(schema.mcpAuthorizationSessions).values({
    // ... existing fields
    codeChallenge: validation.data.code_challenge || null,
    codeChallengeMethod: validation.data.code_challenge_method || 'plain'
})
```

#### Phase 4: Token Exchange Verification
```typescript
// packages/dashboard/src/app/oauth/token/route.ts:10-18
const tokenRequestSchema = z.object({
    grant_type: z.enum(['authorization_code', 'refresh_token']),
    code: z.string().optional(),
    redirect_uri: z.string().url().optional(),
    code_verifier: z.string().optional(),
    // ... other fields
})

// Add verification logic after line 95 (authorization code lookup)
if (authSession.codeChallenge) {
    if (!body.code_verifier) {
        return new Response(JSON.stringify({
            error: 'invalid_request',
            error_description: 'code_verifier required for PKCE flow'
        }), { status: 400 })
    }
    
    const { createHash } = await import('node:crypto')
    const expectedChallenge = authSession.codeChallengeMethod === 'S256'
        ? createHash('sha256').update(body.code_verifier).digest('base64url')
        : body.code_verifier
    
    if (expectedChallenge !== authSession.codeChallenge) {
        return new Response(JSON.stringify({
            error: 'invalid_grant',
            error_description: 'PKCE verification failed'
        }), { status: 400 })
    }
}
```

#### Phase 5: Forward PKCE to Upstream (Optional)
If upstream OAuth servers support PKCE, forward the parameters:

```typescript
// packages/dashboard/src/app/oauth/authorize/route.ts:191-209
if (validation.data.code_challenge) {
    upstreamAuthUrl.searchParams.set('code_challenge', validation.data.code_challenge)
    upstreamAuthUrl.searchParams.set('code_challenge_method', validation.data.code_challenge_method || 'S256')
}
```

## Code References
- `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:114` - Platform OAuth PKCE advertisement
- `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:66-81` - Custom OAuth missing PKCE
- `packages/dashboard/src/app/oauth/authorize/route.ts:11-18` - Authorization request schema
- `packages/dashboard/src/app/oauth/token/route.ts:10-18` - Token request schema
- `packages/database/src/schema.ts:533-556` - Authorization sessions table
- `packages/dashboard/src/lib/auth/mcp/auth.ts:38` - Better-auth with PKCE support

## Architecture Insights

### Dual Authentication System
MCPlatform uses two separate authentication systems:
1. **Platform OAuth** (better-auth): Dashboard users, includes PKCE support
2. **Custom OAuth** (proxy implementation): End-user authentication, missing PKCE

### OAuth Proxy Architecture
- MCPlatform acts as an OAuth authorization server to MCP clients
- Proxies authentication to upstream customer OAuth servers
- Issues proxy tokens, never exposes upstream tokens to MCP clients
- PKCE verification happens at the proxy level, not forwarded upstream

### Security Considerations
- PKCE is now recommended for ALL OAuth clients (RFC 8252), not just public clients
- Protects against authorization code interception attacks
- S256 (SHA256) method is mandatory, plain method is optional
- Must use timing-safe comparison for code verifier validation

## Historical Context (from thoughts/)
`specifications/08-custom-oauth/handoffs/handoff_2025-09-09_20-03-58_custom-oauth-phase2-complete.md:76` - "PKCE Not Required: Initially added PKCE support but removed it for minimal implementation"

The PKCE support was intentionally removed during Phase 2 to simplify the initial custom OAuth implementation.

## Related Research
- `specifications/08-custom-oauth/implementation-plan.md` - Overall custom OAuth implementation strategy
- `specifications/08-custom-oauth/feature.md` - Feature requirements and architecture

## Open Questions
1. Should PKCE be mandatory or optional for custom OAuth configurations?
2. Do all upstream OAuth servers support PKCE forwarding?
3. Should we support the 'plain' method or only 'S256'?
4. How to handle legacy MCP clients that don't support PKCE?