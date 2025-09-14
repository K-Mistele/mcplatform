---
date: 2025-09-12T11:03:38-05:00
researcher: Claude
git_commit: c836960e9cb6be084cc5edc4d9b14cf2f571c549
branch: 08-custom-oauth
repository: mcplatform
topic: "PKCE S256 Support for Custom OAuth Proxy Implementation Strategy"
tags: [implementation, strategy, pkce, s256, code-challenge, custom-oauth, authentication]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: implementation_strategy
---

# PKCE S256 Support for Custom OAuth Proxy Implementation Plan

## Overview

Implementing PKCE (Proof Key for Code Exchange) with S256 code challenge support for the custom OAuth proxy to enable MCP clients to securely connect to MCP servers configured with custom OAuth. This addresses the current incompatibility where MCP clients fail with "does not support code challenge method S256" errors.

## Current State Analysis

The custom OAuth proxy implementation is functionally complete but lacks PKCE support, which is now required by MCP SDK clients. The platform OAuth (better-auth) correctly advertises and handles PKCE, while the custom OAuth proxy does not.

### Key Discoveries:
- **Missing Advertisement**: Custom OAuth discovery endpoint doesn't include `code_challenge_methods_supported` - `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:66-81`
- **No PKCE Parameters**: Authorization and token endpoints don't accept PKCE parameters - `packages/dashboard/src/app/oauth/authorize/route.ts:11-18`
- **Database Ready**: Authorization sessions table exists but lacks PKCE storage fields - `packages/database/src/schema.ts:533-556`
- **Clear Architecture**: PKCE validation happens ONLY between MCP clients and MCPlatform, NOT forwarded upstream

## What We're NOT Doing

- **NOT forwarding PKCE to upstream OAuth servers** - The proxy validates PKCE from MCP clients but doesn't forward it upstream (would break the security model)
- **NOT supporting 'plain' method** - Only implementing S256 as it's the secure standard
- **NOT implementing upstream PKCE** - If upstream servers require PKCE, that would be a separate implementation

## Implementation Approach

Single-phase focused implementation adding PKCE support to all OAuth proxy endpoints while maintaining the existing proxy architecture.

## Phase 1: PKCE S256 Implementation

### Overview
Add complete PKCE S256 support to the custom OAuth proxy, enabling MCP clients to securely connect using the code challenge flow.

### Changes Required:

#### 1. Database Schema Update
**File**: `packages/database/src/schema.ts`
**Changes**: Add PKCE fields to mcpAuthorizationSessions table

**Implementation Requirements:**
- Add `codeChallenge` and `codeChallengeMethod` columns to the existing `mcpAuthorizationSessions` table (lines 533-556)
- Follow existing column patterns: use `text()` type with snake_case database names
- Make `codeChallenge` nullable since PKCE might be optional in future
- Make `codeChallengeMethod` nullable with default assumption of 'S256' when challenge is present
- No new tables needed, just extend the existing session storage
- Generate and run database migration after schema changes

#### 2. OAuth Discovery Metadata Update
**File**: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts`
**Changes**: Advertise PKCE S256 support for custom OAuth

**Implementation Requirements:**
- Add `code_challenge_methods_supported: ['S256']` to the custom OAuth metadata object (after line 80)
- Match the exact format used by platform OAuth metadata (line 114)
- Ensure the array only includes 'S256' (not 'plain') for security
- This single line addition enables MCP clients to recognize PKCE support
- No conditional logic needed - always advertise S256 for custom OAuth

#### 3. Authorization Endpoint PKCE Handling
**File**: `packages/dashboard/src/app/oauth/authorize/route.ts`
**Changes**: Accept and store PKCE parameters

**Implementation Requirements:**
- Extend `authorizationRequestSchema` (lines 11-18) to include:
  - `code_challenge: z.string().min(43).max(128).regex(/^[A-Za-z0-9_-]+$/).optional()`
  - `code_challenge_method: z.literal('S256').optional()` (only S256, not plain)
- Validate that if `code_challenge` is present, `code_challenge_method` must be 'S256' or undefined
- Store PKCE parameters in the authorization session (lines 178-188):
  - Add `codeChallenge: validation.data.code_challenge || null`
  - Add `codeChallengeMethod: validation.data.code_challenge_method || null`
- No changes to upstream OAuth redirect - PKCE stays with MCPlatform only
- Maintain existing error handling patterns for invalid requests

#### 4. Token Endpoint PKCE Verification
**File**: `packages/dashboard/src/app/oauth/token/route.ts`
**Changes**: Validate code_verifier against stored challenge

**Implementation Requirements:**
- Extend `tokenRequestSchema` (lines 10-18) to include:
  - `code_verifier: z.string().min(43).max(128).regex(/^[A-Za-z0-9_-]+$/).optional()`
- After retrieving authorization session (around line 95), implement PKCE verification:
  - Check if session has `codeChallenge` stored
  - If yes, require `code_verifier` in request (return error if missing)
  - Use Node.js crypto module to compute SHA256 hash of code_verifier
  - Convert hash to base64url encoding (no padding, URL-safe characters)
  - Compare computed hash with stored `codeChallenge` using timing-safe comparison
  - Return `invalid_grant` error if verification fails
- Place verification BEFORE marking authorization code as used
- Follow OAuth error response format for PKCE failures

#### 5. PKCE Verification Utility
**File**: `packages/dashboard/src/lib/oauth/pkce.ts` (new file)
**Changes**: Create reusable PKCE verification function

**Implementation Requirements:**
- Create a utility function `verifyPKCEChallenge(verifier: string, challenge: string, method: string)`
- Use Node.js built-in `crypto` module for SHA256 hashing
- Implement base64url encoding (base64 with URL-safe characters, no padding)
- Handle edge cases: empty strings, invalid base64, mismatched lengths
- Export for use in token endpoint
- Include proper TypeScript types and JSDoc comments

### Success Criteria:

**Manual Verification**
- [ ] OAuth discovery endpoint returns `code_challenge_methods_supported: ['S256']` for custom OAuth servers
- [ ] MCP clients no longer show "does not support code challenge method S256" error
- [ ] Authorization endpoint accepts and stores PKCE parameters in database
- [ ] Token endpoint correctly validates code_verifier using SHA256
- [ ] Invalid code_verifier returns proper OAuth error response
- [ ] Existing non-PKCE flows continue to work (backward compatibility)
- [ ] PKCE parameters are NOT forwarded to upstream OAuth servers
- [ ] End-to-end MCP client connection works with PKCE flow

## Performance Considerations
- SHA256 computation is fast (~microseconds) and won't impact performance
- PKCE adds minimal overhead (two extra database columns, one hash computation)
- No caching needed as authorization codes are single-use

## Migration Notes
- Existing authorization sessions without PKCE will continue to work
- New sessions can optionally use PKCE (graceful upgrade path)
- No data migration needed, just schema addition
- Database migration is additive only (no breaking changes)

## References
* Original implementation plan: `specifications/08-custom-oauth/implementation-plan.md`
* PKCE research: `specifications/08-custom-oauth/02-code-challenge/research_2025-09-12_10-44-28_pkce-s256-implementation.md`
* OAuth discovery endpoint: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:66-81`
* Authorization endpoint: `packages/dashboard/src/app/oauth/authorize/route.ts:11-18`
* Token endpoint: `packages/dashboard/src/app/oauth/token/route.ts:10-18`
* Authorization sessions table: `packages/database/src/schema.ts:533-556`
* RFC 7636 (PKCE): https://datatracker.ietf.org/doc/html/rfc7636