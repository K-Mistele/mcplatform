---
date: 2025-09-12T10:28:50-05:00
researcher: Claude
git_commit: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
branch: 08-custom-oauth
repository: mcplatform
topic: "Dynamic Client Registration CORS Issue Analysis"
tags: [research, codebase, oauth, dcr, cors, rfc7591]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: research
---

# Research: Dynamic Client Registration CORS Issue Analysis

**Date**: 2025-09-12T10:28:50-05:00
**Researcher**: Claude
**Git Commit**: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
**Branch**: 08-custom-oauth
**Repository**: mcplatform

## Research Question
The endpoint for dynamic client registration appears to work successfully when MCP clients connect and use it, and the records are created in the database, and a 201 status code is returned from `/oauth/register`, but clients still seem to indicate that there's a failure. Need to analyze against the DCR IETF RFC to ensure the response is RFC-compliant.

## Summary
The Dynamic Client Registration endpoint at `/oauth/register` is **functionally correct and RFC 7591 compliant** in terms of response body structure and content. However, **the successful 201 response is missing CORS headers**, which causes browser-based MCP clients to fail when trying to read the response, even though the registration succeeds server-side. This is why clients report failure despite the server returning 201 and creating database records successfully.

## Root Cause Identified

### The Critical Issue: Missing CORS Headers in Successful Response

**Location**: `packages/dashboard/src/app/oauth/register/route.ts:201-208`

The successful DCR response (201 Created) **lacks CORS headers**:
```typescript
return new Response(JSON.stringify(response), {
    status: 201,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache'
        // ❌ MISSING: Access-Control-Allow-Origin and other CORS headers
    }
})
```

While the OPTIONS preflight handler correctly includes CORS headers (lines 222-233), the actual POST response does not. This causes browser-based clients to:
1. Successfully complete the preflight check
2. Send the registration request
3. Server processes it successfully and returns 201
4. **Browser blocks the response due to CORS policy**
5. Client JavaScript cannot read the successful response
6. Client reports failure despite server-side success

## Detailed Findings

### RFC 7591 Compliance Analysis

#### ✅ Required Fields Present
- `client_id`: REQUIRED - Present (line 179)
- `client_id_issued_at`: OPTIONAL - Present (line 180)
- `client_secret`: OPTIONAL - Conditionally present for confidential clients (lines 195-198)
- `client_secret_expires_at`: REQUIRED if client_secret issued - Present when applicable (line 197)

#### ✅ Response Body Structure
The response correctly echoes all registered metadata as required by RFC 7591 Section 3.2.1:
- `redirect_uris` (line 181)
- `client_name` (line 182)
- `token_endpoint_auth_method` (line 183)
- `grant_types` (line 184)
- `response_types` (line 185)
- `scope` (line 186)
- Additional optional fields (lines 187-191)

#### ✅ HTTP Status Code
- Returns `201 Created` as specified by RFC 7591 (line 202)

#### ✅ Content-Type Header
- Returns `application/json` as required (line 204)

#### ✅ Cache Control
- Includes appropriate cache prevention headers (lines 205-206)

### CORS Implementation Gap

#### Current State
- **OPTIONS handler**: Properly configured with CORS headers (lines 222-233)
- **Error responses**: Missing CORS headers (lines 34-37, 47-53, 59-65, etc.)
- **Success response**: **Missing CORS headers** (lines 201-208)

#### Expected State (Based on Other OAuth Endpoints)
All other OAuth proxy endpoints include CORS headers. For example:

**Token endpoint** (`packages/dashboard/src/app/oauth/token/route.ts:165-179`):
```typescript
// Note: Token endpoint also lacks CORS in success response
// This is a pattern across multiple endpoints
```

**Discovery endpoint** (`packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:76-84`):
```typescript
return new Response(JSON.stringify(metadata), {
    headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
    }
})
```

### Why MCP Clients Fail

1. **Browser Security Model**: Cross-origin requests require CORS headers on the actual response, not just preflight
2. **MCP Inspector**: Being a browser-based tool, it's subject to CORS restrictions
3. **Silent Failure**: The registration succeeds server-side, but the client can't read the response
4. **Misleading Error**: Clients report "registration failed" when actually "reading response failed"

### Evidence from Logs

From `.next.log`:
```
[Dynamic Client Registration] Registration successful, returning response
POST /oauth/register 201 in 187ms
```

This confirms:
- Server processes the request successfully
- Database record is created
- 201 status is returned
- But client still reports failure (due to CORS blocking)

## Architecture Insights

### Consistent CORS Pattern Needed
The codebase shows inconsistent CORS header application:
- Discovery endpoints: ✅ Include CORS
- OPTIONS handlers: ✅ Include CORS  
- Success responses: ❌ Often missing CORS
- Error responses: ❌ Missing CORS

### Middleware vs. Endpoint-Level CORS
- `middleware.ts` handles some CORS for specific paths
- OAuth endpoints handle their own CORS
- This split responsibility creates gaps

## Historical Context

From `specifications/08-custom-oauth/handoffs/handoff_2025-09-09_20-03-58_custom-oauth-phase2-complete.md`:
- Phase 2 implemented the DCR endpoint
- Testing was done with non-browser clients
- CORS wasn't identified as a requirement initially

From recent commits (e42caed):
- Added support for public clients (`token_endpoint_auth_method: 'none'`)
- This enabled browser-based clients like MCP Inspector
- Exposed the CORS issue that wasn't visible with confidential clients

## Solution Required

Add CORS headers to the successful DCR response:

```typescript
return new Response(JSON.stringify(response), {
    status: 201,
    headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
        // Add these CORS headers
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
    }
})
```

Also add CORS headers to all error responses in the DCR endpoint for consistency.

## Code References
- `packages/dashboard/src/app/oauth/register/route.ts:201-208` - Missing CORS in success response
- `packages/dashboard/src/app/oauth/register/route.ts:222-233` - Correct CORS in OPTIONS handler
- `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:76-84` - Example of correct CORS implementation
- `packages/dashboard/src/app/oauth/token/route.ts:165-179` - Also missing CORS (systemic issue)

## Related Research
- `specifications/08-custom-oauth/handoffs/handoff_2025-09-09_20-03-58_custom-oauth-phase2-complete.md` - Phase 2 DCR implementation
- `specifications/08-custom-oauth/research/research_2025-09-05_11-45-30_comprehensive-custom-oauth-implementation.md` - Initial OAuth implementation research

## Open Questions
1. Should CORS headers be centralized in middleware rather than per-endpoint?
2. Should the `Access-Control-Allow-Origin` be restricted to known MCP client origins rather than `*`?
3. Are other OAuth endpoints (token, userinfo) also affected by missing CORS headers in success responses?