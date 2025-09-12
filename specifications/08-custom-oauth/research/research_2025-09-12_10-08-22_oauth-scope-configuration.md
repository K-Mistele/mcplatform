---
date: 2025-09-12T10:08:22-05:00
researcher: Kyle Mistele
git_commit: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
branch: 08-custom-oauth
repository: mcplatform
topic: "OAuth Scope Configuration for Custom OAuth Providers"
tags: [research, codebase, oauth, scopes, custom-oauth, authorization]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: research
---

# Research: OAuth Scope Configuration for Custom OAuth Providers

**Date**: 2025-09-12T10:08:22-05:00
**Researcher**: Kyle Mistele
**Git Commit**: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
**Branch**: 08-custom-oauth
**Repository**: mcplatform

## Research Question
When doing proxy authorization and redirecting users to upstream authorization servers, we need to include a list of scopes to request. How should we implement configurable scope support for custom OAuth providers, allowing users to specify scopes with different formatting requirements across various OAuth providers?

## Summary
The current implementation uses a hardcoded default scope of `'openid profile email'` when no scope is provided. The system lacks configurable scope support at the OAuth configuration level. To support provider-specific scope requirements and formatting, we need to:

1. Add a `scopes` field to the `customOAuthConfigs` table as a text field
2. Update the UI to include a scope input field in the OAuth configuration dialog
3. Modify server actions to store and retrieve scope configurations
4. Update the authorization flow to use configured scopes instead of hardcoded defaults

## Detailed Findings

### Current Scope Implementation

#### Default Scope Handling (`packages/dashboard/src/app/oauth/authorize/route.ts:185`)
The system currently defaults to `'openid profile email'` when no scope is provided:
```typescript
scope: scope || 'openid profile email',
```

#### Scope Storage (`packages/database/src/schema.ts:547`)
Authorization sessions store the requested scope as a text field:
```typescript
scope: text('scope').notNull(),
```

#### Scope Forwarding (`packages/dashboard/src/app/oauth/authorize/route.ts:198-200`)
Scopes are conditionally forwarded to upstream OAuth servers:
```typescript
if (scope) {
    upstreamAuthUrl.searchParams.set('scope', scope)
}
```

### Database Schema Patterns

#### Current OAuth Configuration Schema (`packages/database/src/schema.ts:109-130`)
The `customOAuthConfigs` table currently stores:
- `id`, `organizationId`, `name`
- `authorizationUrl`, `tokenUrl`, `metadataUrl`
- `clientId`, `clientSecret`
- **Missing**: No `scopes` field

#### Existing Scope Storage Patterns
The codebase uses two patterns for storing scopes:
1. **Text fields** for protocol-level scopes: `text('scope')` or `text('scopes')`
2. **JSON arrays** for structured data: `jsonb('field').$type<string[]>()`

Examples from `packages/database/src/auth-schema.ts`:
- `account.scope`: `text('scope')` at line 45
- `oauthAccessToken.scopes`: `text('scopes')` at line 83

### UI Component Structure

#### Add OAuth Config Dialog (`packages/dashboard/src/components/add-oauth-config-dialog.tsx`)
Current form state (lines 28-36):
- `name`, `metadataUrl`, `clientId`, `clientSecret`
- **Missing**: No scope input field

Progressive disclosure pattern (lines 201-248):
- Initial form shows name and metadata URL
- Credential fields appear after successful validation
- **Scope field should be added** alongside credential fields

#### Server Actions (`packages/dashboard/src/lib/orpc/actions/oauth-configs.ts`)
Current input validation schemas (lines 19-24):
```typescript
const createOAuthConfigSchema = z.object({
    name: z.string().min(1).max(100),
    metadataUrl: z.string().url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1)
    // Missing: scopes field
})
```

### OAuth Proxy Flow

#### Authorization Request Processing
1. Accepts optional `scope` parameter (`packages/dashboard/src/app/oauth/authorize/route.ts:16`)
2. Stores scope in authorization session with default fallback (line 185)
3. Forwards scope to upstream OAuth server if provided (lines 198-200)

#### Current Limitations
- No validation of requested scopes against OAuth server capabilities
- Hardcoded default scope value throughout codebase
- No organization-level or per-configuration scope settings
- No handling of provider-specific scope formatting

## Code References
- `packages/dashboard/src/app/oauth/authorize/route.ts:185` - Default scope fallback logic
- `packages/dashboard/src/app/oauth/authorize/route.ts:198-200` - Scope forwarding to upstream
- `packages/database/src/schema.ts:109-130` - customOAuthConfigs table definition
- `packages/dashboard/src/components/add-oauth-config-dialog.tsx:28-36` - Form state management
- `packages/dashboard/src/lib/orpc/actions/oauth-configs.ts:19-24` - Create config schema
- `packages/database/src/schema.ts:547` - Authorization session scope storage

## Architecture Insights

### Design Patterns
1. **Text Storage for Scopes**: The codebase consistently uses text fields for OAuth scopes, allowing flexibility in formatting
2. **Progressive Disclosure UI**: OAuth configuration uses progressive disclosure, revealing fields after validation
3. **Default Fallback Pattern**: System provides sensible defaults when values aren't specified
4. **VHost-Based Routing**: OAuth configurations are resolved via subdomain lookup

### Provider Compatibility Considerations
Different OAuth providers handle scopes differently:
- **Standard**: Space-delimited strings (OAuth 2.0 RFC 6749)
- **Microsoft**: Space-delimited, case-sensitive
- **GitHub**: Space or comma-delimited
- **Custom Providers**: May use different delimiters or formats

Storing scopes as a raw text string allows maximum flexibility for provider-specific requirements.

## Historical Context (from thoughts/)

### Scope Handling Decision
The implementation explicitly excluded custom scope mapping to focus on core OAuth proxy functionality. The design chose standardization (fixed `'openid profile email'` scopes) over flexibility, with custom scope mapping listed as a future enhancement.

### Key Trade-offs
- **Simplicity over Complexity**: Fixed scope set chosen over dynamic scope mapping
- **Security over Flexibility**: Controlled token issuance prioritized over preserving upstream token details
- **Standards Compliance**: RFC adherence with major providers (Google, GitHub, Auth0) as compatibility targets

## Implementation Recommendations

### 1. Database Schema Addition
Add to `customOAuthConfigs` table (`packages/database/src/schema.ts:123`):
```typescript
scopes: text('scopes').default('openid profile email'),
```

### 2. UI Component Updates
Add scope input to OAuth config dialog after client secret field:
```typescript
// In form state
const [scopes, setScopes] = useState('openid profile email')

// In form UI
<Input
    placeholder="e.g., openid profile email"
    value={scopes}
    onChange={(e) => setScopes(e.target.value)}
/>
<p className="text-sm text-muted-foreground">
    Space-delimited list of scopes to request. Format may vary by provider.
</p>
```

### 3. Server Action Updates
Update validation schemas and database operations:
```typescript
// Add to createOAuthConfigSchema
scopes: z.string().default('openid profile email')

// Include in database insert
scopes: input.scopes
```

### 4. Authorization Flow Updates
Replace hardcoded default with configured scopes:
```typescript
// In authorize/route.ts
scope: scope || oauthConfig.scopes || 'openid profile email',
```

## Related Research
- `specifications/08-custom-oauth/implementation-plan.md` - Overall implementation strategy
- `specifications/08-custom-oauth/feature.md` - Original feature requirements
- `specifications/08-custom-oauth/oauth-proxy-sequence-diagram.md` - OAuth flow documentation

## Open Questions
4. Should scope configuration be editable after creation, considering security implications? Yes, to the extent that the oauth configuration is (or isn't) able to be edited after creation.