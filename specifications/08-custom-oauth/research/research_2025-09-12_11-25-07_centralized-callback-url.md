---
date: 2025-09-12T11:25:07-05:00
researcher: Claude
git_commit: 1e9eee49f2f7c242bd0410eada9e705058852f58
branch: 08-custom-oauth
repository: mcplatform
topic: "Centralized OAuth Callback URL Implementation"
tags: [research, oauth, callback-url, state-parameter, vhost-routing, custom-oauth]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
last_updated_note: "Added NEXT_PUBLIC_BETTER_AUTH_URL as the environment variable to use"
type: research
---

# Research: Centralized OAuth Callback URL Implementation

**Date**: 2025-09-12T11:25:07-05:00
**Researcher**: Claude
**Git Commit**: 1e9eee49f2f7c242bd0410eada9e705058852f58
**Branch**: 08-custom-oauth
**Repository**: mcplatform

## Research Question
How to implement a single, centralized callback URL for all custom OAuth configurations across different MCP servers, eliminating the need for subdomain-specific callback URLs while maintaining proper MCP server association through state parameter management.

## Summary
The current OAuth implementation is already well-positioned for centralized callback URLs. The callback handler uses state-based session lookup without vhost dependencies, and all necessary context is stored in the authorization session. Only two changes are needed:
1. Modify the callback URL generation in the authorization endpoint to use a fixed platform URL
2. Ensure the UI consistently displays the centralized callback URL using client-side `window.origin` detection

## Detailed Findings

### Current OAuth Callback Architecture

#### State Parameter Management (`packages/dashboard/src/app/oauth/authorize/route.ts:175-194`)
The system generates unique state parameters and stores complete session context:
```typescript
const oauthState = nanoid(32)

await db.insert(schema.mcpAuthorizationSessions).values({
    id: `mas_${nanoid()}`,
    mcpClientRegistrationId: clientRegistration.id,  // Links to MCP server
    customOAuthConfigId: customOAuthConfig.id,       // OAuth configuration
    state: oauthState,                               // Unique identifier
    clientState: state || null,                      // Original client state
    redirectUri: redirect_uri,                       // Final destination
    scope: scope || customOAuthConfig.scopes,
    codeChallenge: code_challenge || null,
    codeChallengeMethod: code_challenge_method || null,
    createdAt: BigInt(Date.now()),
    expiresAt: BigInt(Date.now() + 10 * 60 * 1000)
})
```

#### Callback Processing (`packages/dashboard/src/app/oauth/callback/route.ts:65-81`)
The callback handler already uses pure state-based lookup without vhost detection:
```typescript
const [session] = await db
    .select()
    .from(schema.mcpAuthorizationSessions)
    .where(
        and(
            eq(schema.mcpAuthorizationSessions.state, state),
            gt(schema.mcpAuthorizationSessions.expiresAt, Date.now())
        )
    )
    .limit(1)
```

### Current Problem: Subdomain-Specific Callback URLs

#### Problematic Callback URL Generation (`packages/dashboard/src/app/oauth/authorize/route.ts:198`)
```typescript
const callbackUrl = `${request.nextUrl.protocol}//${host}/oauth/callback`
```
This creates subdomain-specific callbacks like `acme-corp.mcplatform.com/oauth/callback`.

### UI Implementation for Callback URL Display

#### Existing Pattern in Add Dialog (`packages/dashboard/src/components/add-oauth-config-dialog.tsx:64-68, 269-280`)
```typescript
const [redirectUrl, setRedirectUrl] = useState<string>('')

useEffect(() => {
    if (typeof window !== 'undefined') {
        setRedirectUrl(`${window.location.origin}/oauth/callback`)
    }
}, [])

// Display component
{showCredentialFields && redirectUrl && (
    <Alert className="mt-2">
        <AlertDescription className="text-xs">
            <strong>Important:</strong> Add this redirect URL to your OAuth provider's allowed callbacks:
            <br />
            <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                {redirectUrl}
            </code>
        </AlertDescription>
    </Alert>
)}
```

#### Missing Implementation in Edit Dialog
The edit dialog (`edit-oauth-config-dialog.tsx`) lacks callback URL display entirely, despite having all other OAuth configuration fields.

## Architecture Insights

### Why Centralized Callbacks Work
1. **State-Based Session Recovery**: The authorization session table stores complete context including MCP server identity via `mcpClientRegistrationId`
2. **No Callback Vhost Dependency**: The callback handler doesn't parse the Host header - it relies entirely on state parameter lookup
3. **Secure Association**: The state parameter cryptographically binds the OAuth flow to a specific MCP server configuration

### Data Flow with Centralized Callback
1. User initiates OAuth at `subdomain.mcplatform.com`
2. Authorization endpoint stores MCP server identity in session with unique state
3. User redirected to upstream OAuth with centralized callback URL (e.g., `mcplatform.com/oauth/callback`)
4. Upstream OAuth calls back to centralized URL with state parameter
5. Callback handler recovers full context from state, including original MCP server
6. Flow continues normally with proper MCP server association

## Implementation Requirements

### Backend Changes

#### 1. Modify Callback URL Generation
**File**: `packages/dashboard/src/app/oauth/authorize/route.ts:198`
**Change**: Replace vhost-specific callback with centralized URL
```typescript
// OLD: const callbackUrl = `${request.nextUrl.protocol}//${host}/oauth/callback`
// NEW: Use NEXT_PUBLIC_BETTER_AUTH_URL environment variable
const betterAuthUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL
if (!betterAuthUrl) {
    // Fallback to extracting base domain from host
    const baseDomain = extractBaseDomain(host)
    const callbackUrl = `${request.nextUrl.protocol}//${baseDomain}/oauth/callback`
} else {
    const callbackUrl = `${betterAuthUrl}/oauth/callback`
}
```

**Note**: The `NEXT_PUBLIC_BETTER_AUTH_URL` environment variable is already used by the Better Auth configuration and provides the platform's base URL, making it ideal for constructing the centralized callback URL.

#### 2. Add Base Domain Extraction Utility (Fallback)
Create a utility to extract the base domain from subdomain hosts when environment variable is not available:
```typescript
function extractBaseDomain(host: string): string {
    const parts = host.split('.')
    if (host.includes('localhost')) {
        return 'localhost:3000'
    }
    // Remove subdomain, keep base domain
    return parts.slice(1).join('.')
}
```

### Frontend Changes

#### 1. Update Edit OAuth Config Dialog
**File**: `packages/dashboard/src/components/edit-oauth-config-dialog.tsx`
**Changes**: Add callback URL display matching the creation dialog pattern

Add state variable:
```typescript
const [redirectUrl, setRedirectUrl] = useState<string>('')
```

Add useEffect for client-side detection:
```typescript
useEffect(() => {
    if (typeof window !== 'undefined') {
        // Use base origin without subdomain
        const origin = window.location.origin
        const url = new URL(origin)
        const baseDomain = url.hostname.includes('localhost') 
            ? origin 
            : `${url.protocol}//${url.hostname.split('.').slice(1).join('.')}`
        setRedirectUrl(`${baseDomain}/oauth/callback`)
    }
}, [])
```

Add display component after validation success:
```typescript
{showCredentialFields && redirectUrl && (
    <Alert className="mt-2">
        <AlertDescription className="text-xs">
            <strong>Important:</strong> Ensure this redirect URL is configured in your OAuth provider:
            <br />
            <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 inline-block">
                {redirectUrl}
            </code>
        </AlertDescription>
    </Alert>
)}
```

#### 2. Consider Adding to Table View
Optionally add callback URL to the table view for quick reference without opening dialogs.

## Code References
- `packages/dashboard/src/app/oauth/authorize/route.ts:198` - Callback URL generation that needs modification
- `packages/dashboard/src/app/oauth/callback/route.ts:65-81` - State-based session lookup (no changes needed)
- `packages/dashboard/src/app/oauth/authorize/route.ts:175-194` - Session storage with MCP server context
- `packages/dashboard/src/components/add-oauth-config-dialog.tsx:64-68` - Client-side URL detection pattern
- `packages/dashboard/src/components/edit-oauth-config-dialog.tsx` - Missing callback URL display

## Historical Context (from thoughts/)
Based on the implementation plan (`specifications/08-custom-oauth/implementation-plan.md`), the OAuth proxy architecture was designed to handle multiple MCP servers through vhost routing. The centralized callback approach aligns with the goal of simplifying customer configuration while maintaining the security benefits of the proxy architecture.

## Related Research
- `specifications/08-custom-oauth/feature.md` - Original feature specification
- `specifications/08-custom-oauth/implementation-plan.md` - Implementation strategy with OAuth proxy architecture
- `specifications/08-custom-oauth/research/research_2025-09-05_10-35-05_comprehensive-oauth-system-analysis.md` - OAuth system analysis

## Open Questions
1. ~~Should we use an environment variable for the base platform domain or detect it dynamically?~~ **RESOLVED**: Use `NEXT_PUBLIC_BETTER_AUTH_URL` which is already configured
2. Should the callback URL be displayed in the OAuth configs table for quick reference?
3. ~~How should we handle local development where the base domain might vary?~~ **RESOLVED**: `NEXT_PUBLIC_BETTER_AUTH_URL` handles this across environments

## Recommendations

### Immediate Actions
1. Modify the callback URL generation in the authorization endpoint to use a centralized URL
2. Add callback URL display to the edit OAuth config dialog using the established pattern
3. Ensure consistent base domain extraction in both backend and frontend

### Benefits of This Approach
- **Simplified Customer Configuration**: One callback URL for all MCP servers
- **Maintained Security**: State parameter ensures proper MCP server association
- **Minimal Code Changes**: Leverages existing state-based session management
- **Better UX**: Customers don't need to manage multiple callback URLs

### Implementation Complexity
**Low** - The architecture already supports this approach. Only minor modifications are needed to callback URL generation and UI display logic.