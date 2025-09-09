---
date: 2025-09-05T11:45:30-05:00
researcher: Kyle Mistele
git_commit: e331e3d22c8c9d3da23e1ae092a91f4edad380e1
branch: master
repository: mcplatform
topic: "Comprehensive Custom OAuth Implementation Research"
tags: [research, custom-oauth, oauth, authentication, implementation, ui, database, middleware, routing]
status: complete
last_updated: 2025-09-05
last_updated_by: Kyle Mistele
type: research
---

# Research: Comprehensive Custom OAuth Implementation Research

**Date**: 2025-09-05T11:45:30-05:00  
**Researcher**: Kyle Mistele  
**Git Commit**: e331e3d22c8c9d3da23e1ae092a91f4edad380e1  
**Branch**: master  
**Repository**: mcplatform

## Research Question
Comprehensive investigation of all implementation requirements for the 08-custom-oauth feature, covering OAuth server discovery & validation, database schema design, OAuth proxy flow architecture, authentication middleware enhancement, progressive UI configuration, OAuth configuration management system, and VHost-based custom OAuth routing.

## Summary
The MCPlatform codebase provides a robust foundation for custom OAuth implementation with established VHost routing, dual authentication architecture, and progressive UI patterns. However, the custom OAuth feature requires significant development across 7 key areas: RFC 8414-compliant OAuth discovery validation, new database tables for configuration storage, OAuth proxy flow implementation, enhanced authentication middleware, progressive disclosure UI, organization-scoped configuration management, and VHost routing integration. The existing patterns provide clear implementation guidance for each component.

## Detailed Findings

### 1. OAuth Server Discovery & Validation Implementation

#### Current Foundation
- **Validation Pattern**: Established debounced validation in `packages/dashboard/src/components/add-server-modal.tsx:97-128` with 2-second delay
- **Server Actions**: oRPC pattern in `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:56-84` for validation actions
- **OAuth Metadata**: Basic structure in `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:57-74`

#### Implementation Requirements
**RFC 8414 Zod Schema**:
```typescript
const rfc8414Schema = z.object({
    issuer: z.string().url(),
    authorization_endpoint: z.string().url(),
    token_endpoint: z.string().url(),
    userinfo_endpoint: z.string().url().optional(),
    jwks_uri: z.string().url(),
    scopes_supported: z.array(z.string()),
    response_types_supported: z.array(z.string()),
    response_modes_supported: z.array(z.string()).optional(),
    grant_types_supported: z.array(z.string()),
    subject_types_supported: z.array(z.string()),
    id_token_signing_alg_values_supported: z.array(z.string()),
    token_endpoint_auth_methods_supported: z.array(z.string()).optional(),
    code_challenge_methods_supported: z.array(z.string()).optional(),
    claims_supported: z.array(z.string()).optional()
})
```

**Server Action Pattern**:
```typescript
export const validateOAuthServerAction = base
    .input(z.object({ oauthUrl: z.string().url() }))
    .handler(async ({ input, errors }) => {
        await requireSession()
        
        const metadataUrl = `${input.oauthUrl}/.well-known/oauth-authorization-server`
        const response = await fetch(metadataUrl)
        const metadata = await response.json()
        
        const validation = rfc8414Schema.safeParse(metadata)
        if (!validation.success) {
            throw errors.INVALID_OAUTH_METADATA({
                message: 'OAuth server metadata does not conform to RFC 8414'
            })
        }
        
        return { success: true, metadata: validation.data }
    })
    .actionable({})
```

#### UI Integration Pattern
- **Progressive Disclosure**: Show client ID/secret fields only after successful URL validation
- **Real-time Feedback**: Loading states, success checkmarks, error messages
- **Error Styling**: `border-red-500 focus-visible:ring-red-500` for validation errors
- **Debounced Input**: 2-second delay following existing slug validation pattern

### 2. Database Schema Design for Custom OAuth

#### Required Tables
**Custom OAuth Configurations**:
```typescript
export const customOAuthConfigs = pgTable(
    'custom_oauth_configs',
    {
        id: text('id').primaryKey().$defaultFn(() => `coac_${nanoid(8)}`),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        name: text('name').notNull(), // Human-readable identifier
        issuerUrl: text('issuer_url').notNull(),
        clientId: text('client_id').notNull(),
        encryptedClientSecret: text('encrypted_client_secret').notNull(),
        authorizationEndpoint: text('authorization_endpoint'),
        tokenEndpoint: text('token_endpoint'),
        userinfoEndpoint: text('userinfo_endpoint'),
        jwksUri: text('jwks_uri'),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        metadata: jsonb('metadata').$defaultFn(() => ({}))
    },
    (t) => [
        index('custom_oauth_configs_organization_id_idx').on(t.organizationId),
        unique('custom_oauth_configs_name_org_unique').on(t.name, t.organizationId)
    ]
)
```

**Upstream Token Storage**:
```typescript
export const upstreamOAuthTokens = pgTable(
    'upstream_oauth_tokens',
    {
        id: text('id').primaryKey().$defaultFn(() => `uoat_${nanoid(12)}`),
        customOAuthConfigId: text('custom_oauth_config_id')
            .references(() => customOAuthConfigs.id, { onDelete: 'cascade' })
            .notNull(),
        mcpServerUserId: text('mcp_server_user_id')
            .references(() => mcpServerUser.id, { onDelete: 'cascade' })
            .notNull(),
        encryptedAccessToken: text('encrypted_access_token').notNull(),
        encryptedRefreshToken: text('encrypted_refresh_token'),
        accessTokenExpiresAt: bigint('access_token_expires_at', { mode: 'number' }),
        upstreamUserId: text('upstream_user_id'),
        upstreamUserEmail: text('upstream_user_email'),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        lastUsedAt: bigint('last_used_at', { mode: 'number' }),
        metadata: jsonb('metadata').$defaultFn(() => ({}))
    },
    (t) => [
        index('upstream_oauth_tokens_config_id_idx').on(t.customOAuthConfigId),
        index('upstream_oauth_tokens_mcp_user_id_idx').on(t.mcpServerUserId),
        index('upstream_oauth_tokens_expires_idx').on(t.accessTokenExpiresAt),
        unique('upstream_oauth_tokens_user_config_unique').on(t.mcpServerUserId, t.customOAuthConfigId)
    ]
)
```

**MCP Server Reference Update**:
```typescript
// Add to existing mcp_servers table:
customOAuthConfigId: text('custom_oauth_config_id')
    .references(() => customOAuthConfigs.id, { onDelete: 'set null' })
```

#### Encryption Implementation
**AES-256-GCM Pattern**:
```typescript
export function encryptSensitiveData(plaintext: string): string {
    const key = getEncryptionKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    const tag = cipher.getAuthTag()
    
    // Format: iv:tag:encrypted
    return [iv.toString('hex'), tag.toString('hex'), encrypted].join(':')
}
```

#### Migration Strategy
1. **Phase 1**: Add new tables without touching existing `oauthIssuerUrl` field
2. **Phase 2**: Create migration to populate from existing data
3. **Phase 3**: Update application code to use new tables
4. **Phase 4**: Remove deprecated field after transition period

### 3. OAuth Proxy Flow Architecture & Token Management

#### Complete Authentication Flow
1. **MCP Server → MCPlatform**: Dynamic client registration with secondary OAuth tenant
2. **User Authorization Request**: User redirected to MCPlatform OAuth system
3. **VHost Detection**: MCPlatform detects custom OAuth via Host header → MCP server lookup
4. **Upstream Redirect**: MCPlatform immediately redirects to upstream OAuth authorization server
5. **User OAuth Flow**: User completes OAuth with customer's system
6. **Callback to MCPlatform**: Upstream server redirects back with authorization code
7. **Token Exchange**: MCPlatform exchanges code for access token using `application/x-www-form-urlencoded`
8. **Token Storage**: Store upstream access/refresh tokens with computed expiration
9. **Proxy Token Issuance**: Issue MCPlatform proxy token to user

#### Token Lifecycle Management
```typescript
// Token expiration computation
const expiresAt = Date.now() + (expiresInSeconds * 1000)

// Token validation
const isExpired = Date.now() > token.accessTokenExpiresAt
if (isExpired) {
    return new Response('Unauthorized', {
        status: 401,
        headers: { 'WWW-Authenticate': `Bearer realm="${discoveryUrl}"` }
    })
}
```

#### Integration with VHost Routing
- **Host Header Detection**: Extract subdomain from `Host` header in `packages/dashboard/src/lib/mcp/index.ts:117-159`
- **Server Configuration Lookup**: Map subdomain to `mcp_servers.slug` for OAuth config resolution
- **Custom OAuth Detection**: Check `authType === 'custom_oauth'` and load associated config

### 4. Authentication Middleware Enhancement

#### Enhanced Middleware Pattern
```typescript
export const withCustomOAuthAuth = <Config extends { customOAuthConfigId?: string }>(
    serverConfig: Config,
    handler: McpHandler
): McpHandler => {
    return async (request, info) => {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader?.startsWith('Bearer ')) {
            return unauthorized(request)
        }
        
        const token = authHeader.slice(7)
        
        // Validate token against custom OAuth provider
        const isValid = await validateUpstreamToken(token, serverConfig.customOAuthConfigId)
        if (!isValid) {
            return unauthorized(request)
        }
        
        return handler(request, info)
    }
}
```

#### Custom OAuth Provider Detection
```typescript
// In createHandlerForServer
if (serverConfig.authType === 'custom_oauth' && serverConfig.customOAuthConfigId) {
    return withCustomOAuthAuth(serverConfig, handler)
} else if (serverConfig.authType?.includes('oauth')) {
    return withMcpAuth(auth, handler)
}
```

#### Upstream Token Validation Strategy
- **Discovery Endpoint**: Cache OAuth server metadata from `/.well-known/oauth-authorization-server`
- **Token Introspection**: RFC 7662 introspection endpoint if available
- **JWKs Validation**: Verify JWT tokens using cached JWKs
- **Fallback Validation**: Userinfo endpoint validation for opaque tokens

### 5. Progressive UI Configuration Implementation

#### Authentication Type Selection Enhancement
```typescript
// Enhanced select with custom OAuth option
<Select onValueChange={(value) => {
    field.onChange(value)
    if (value === 'custom_oauth') {
        setShowOAuthFields(true)
    } else {
        setShowOAuthFields(false)
        form.setValue('customOAuthConfigId', undefined)
    }
}} defaultValue={field.value}>
    <SelectItem value="none">None</SelectItem>
    <SelectItem value="platform_oauth">Platform OAuth</SelectItem>
    <SelectItem value="custom_oauth">Custom OAuth</SelectItem>
    <SelectItem value="collect_email">Collect Email</SelectItem>
</Select>
```

#### Progressive Disclosure Pattern
```typescript
const authType = form.watch('authType')
const [oauthValidationState, setOAuthValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle')

// Show OAuth configuration dropdown only after auth type selection
{authType === 'custom_oauth' && (
    <FormField
        control={form.control}
        name="customOAuthConfigId"
        render={({ field }) => (
            <FormItem>
                <FormLabel>OAuth Configuration</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectContent>
                        {oauthConfigs.map((config) => (
                            <SelectItem key={config.id} value={config.id}>
                                {config.name} ({config.issuerUrl})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <FormDescription>
                    Select an existing OAuth configuration or create a new one
                </FormDescription>
            </FormItem>
        )}
    />
)}
```

#### Client Secret Field with Toggle
```typescript
const [showClientSecret, setShowClientSecret] = useState(false)

<div className="relative">
    <Input 
        type={showClientSecret ? "text" : "password"}
        placeholder="Enter client secret"
        {...field}
    />
    <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3"
        onClick={() => setShowClientSecret(!showClientSecret)}
    >
        {showClientSecret ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
    </Button>
</div>
```

### 6. OAuth Configuration Management System

#### Organization-Scoped CRUD Pattern
```typescript
export const createOAuthConfigAction = base
    .input(createOAuthConfigSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        
        // Validate OAuth server before creating config
        const validation = await validateOAuthServer(input.issuerUrl)
        if (!validation.success) {
            throw errors.INVALID_OAUTH_METADATA({
                message: 'OAuth server validation failed'
            })
        }
        
        const [newConfig] = await db
            .insert(schema.customOAuthConfigs)
            .values({
                ...input,
                organizationId: session.session.activeOrganizationId,
                encryptedClientSecret: encryptSensitiveData(input.clientSecret)
            })
            .returning()
            
        revalidatePath('/dashboard/oauth-configs')
        return newConfig
    })
    .actionable({})
```

#### Configuration List/Detail Views
```typescript
// Server component data fetching pattern
export default async function OAuthConfigsPage() {
    const session = await requireSession()
    const configsPromise = db
        .select()
        .from(schema.customOAuthConfigs)
        .where(eq(schema.customOAuthConfigs.organizationId, session.session.activeOrganizationId))
    
    return (
        <div className="container">
            <Suspense fallback={<Skeleton className="h-96" />}>
                <OAuthConfigsList configsPromise={configsPromise} />
            </Suspense>
        </div>
    )
}
```

#### Reusability Implementation
- **One-to-Many Relationship**: One OAuth config can be used by multiple MCP servers
- **Reference Counting**: Show which servers use each configuration
- **Cascade Protection**: Prevent deletion of configs in use
- **Migration Support**: Handle server reassignment when configs change

### 7. VHost-Based Custom OAuth Routing

#### Enhanced VHost Detection
```typescript
// Enhanced getMcpServerConfiguration with OAuth config loading
export async function getMcpServerConfigurationWithOAuth(request: Request) {
    const baseConfig = await getMcpServerConfiguration(request)
    
    if (baseConfig.authType === 'custom_oauth' && baseConfig.customOAuthConfigId) {
        const [oauthConfig] = await db
            .select()
            .from(schema.customOAuthConfigs)
            .where(eq(schema.customOAuthConfigs.id, baseConfig.customOAuthConfigId))
            
        return { ...baseConfig, oauthConfig }
    }
    
    return baseConfig
}
```

#### Custom OAuth Discovery Enhancement
```typescript
// Enhanced oauth-authorization-server route
if (mcpServerConfiguration.authType === 'custom_oauth' && mcpServerConfiguration.oauthConfig) {
    const customMetadata = {
        issuer: mcpServerConfiguration.oauthConfig.issuerUrl,
        authorization_endpoint: mcpServerConfiguration.oauthConfig.authorizationEndpoint,
        token_endpoint: mcpServerConfiguration.oauthConfig.tokenEndpoint,
        userinfo_endpoint: mcpServerConfiguration.oauthConfig.userinfoEndpoint,
        jwks_uri: mcpServerConfiguration.oauthConfig.jwksUri,
        scopes_supported: ['openid', 'profile', 'email'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code']
    }
    
    return new Response(JSON.stringify(customMetadata), { 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
}
```

#### OAuth Callback Routing
```typescript
// New route: /mcp-oidc/custom-auth/[subdomain]/callback/route.ts
export async function GET(request: Request, { params }: { params: { subdomain: string } }) {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    
    // Resolve server config from subdomain
    const serverConfig = await getMcpServerConfigurationWithOAuth(request)
    
    // Exchange code for tokens with custom provider
    const tokenResponse = await fetch(serverConfig.oauthConfig.tokenEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: serverConfig.oauthConfig.clientId,
            client_secret: decryptSensitiveData(serverConfig.oauthConfig.encryptedClientSecret),
            redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/mcp-oidc/custom-auth/${params.subdomain}/callback`
        })
    })
    
    const tokens = await tokenResponse.json()
    
    // Store tokens and create MCP session
    await storeUpstreamTokens(tokens, serverConfig.oauthConfig.id, mcpUserId)
    
    // Redirect back to MCP client
    return new Response('', { 
        status: 302, 
        headers: { Location: state || '/' }
    })
}
```

## Code References

### Database Schema
- `packages/database/src/schema.ts:108-127` - MCP servers table with auth type and OAuth URL fields
- `packages/database/src/mcp-auth-schema.ts:60-96` - Existing OAuth application tables for reference

### Authentication Core
- `packages/dashboard/src/lib/auth/mcp/auth.ts:17-52` - MCP OAuth authentication instance
- `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:3-40` - Current authentication middleware
- `packages/dashboard/src/lib/mcp/index.ts:117-159` - VHost routing and server configuration

### API Routes
- `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts:8-55` - OAuth discovery metadata
- `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:22-67` - Main MCP server API endpoint
- `packages/dashboard/src/app/mcp-oidc/auth/[[...all]]/route.ts:6-40` - OAuth callback handler

### UI Components
- `packages/dashboard/src/components/add-server-modal.tsx:97-128` - Debounced validation pattern
- `packages/dashboard/src/components/add-server-modal.tsx:240-266` - Auth type selection
- `packages/dashboard/src/components/edit-server-configuration.tsx:127-220` - Progressive disclosure pattern

### Server Actions
- `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:56-84` - Server validation action pattern
- `packages/dashboard/src/lib/orpc/actions/organization.ts:11-113` - Organization-scoped CRUD pattern

## Architecture Insights

### Dual Authentication Philosophy
The system maintains strict separation between two user types:
1. **Platform Customers**: Dashboard access, server management, organization admin
2. **End-Users**: MCP server interaction, OAuth identification only, no dashboard access

### VHost-Based Multi-tenancy
Subdomain routing allows unlimited MCP servers per customer:
- `customer.mcplatform.com` → MCP server with slug `customer`
- Single API endpoint dynamically serves all servers
- Database lookup via Host header extraction

### OAuth Proxy Architecture
MCPlatform acts as an OAuth proxy because upstream OAuth servers don't support dynamic client registration that MCP servers require:
- MCP servers register with MCPlatform's secondary OAuth tenant
- MCPlatform proxies authentication to customer OAuth servers
- Proxy tokens issued to prevent upstream token abuse

### Progressive Configuration Pattern
UI follows established pattern of progressive disclosure:
1. Create/manage OAuth configurations separately from MCP servers
2. Select existing OAuth configuration when creating MCP servers
3. Enable reusability: one OAuth config → multiple MCP servers
4. Validate configuration in real-time with clear feedback

## Historical Context (from thoughts/)

### Authentication Evolution
From multiple research documents:
- Initial system used single authentication approach
- Dual auth system emerged from need to separate customer and end-user data
- VHost routing added to support unlimited MCP servers per organization

### Design Trade-offs
Key architectural decisions:
- **Token Isolation**: Chose proxy tokens over direct upstream tokens for security
- **Schema Separation**: Complete table isolation vs. shared tables with tenant flags
- **Better Auth**: Multiple instances vs. single instance with plugins
- **Session Management**: Separate tracking systems vs. unified session store

### OAuth 2.0 Standards Compliance
From comprehensive OAuth standards research:
- **Token Exchange**: MUST use `Content-Type: application/x-www-form-urlencoded`
- **RFC 8414 Compliance**: OAuth Authorization Server Metadata discovery
- **Token Expiration**: Handle `expires_in` in seconds, not milliseconds
- **Provider Compatibility**: Google, Microsoft, GitHub all follow standards

## Implementation Requirements Summary

### Critical Missing Components
1. **Database Schema**: New tables for custom OAuth configs and upstream tokens
2. **OAuth Discovery**: RFC 8414 compliant server validation with Zod schema
3. **UI Configuration**: Progressive disclosure forms with real-time validation
4. **Authentication Middleware**: Custom OAuth provider detection and token validation
5. **Proxy Flow**: Complete OAuth authorization code flow with upstream integration
6. **Configuration Management**: Organization-scoped CRUD with reusability
7. **VHost Integration**: Enhanced routing with custom OAuth config resolution

### Existing Foundation (Ready to Build Upon)
1. **VHost Routing**: Subdomain-based server resolution working
2. **Dual Authentication**: Platform and MCP OAuth systems established
3. **UI Patterns**: Form validation, progressive disclosure, server actions
4. **Database Architecture**: Organization scoping, indexing, relationships
5. **OAuth Infrastructure**: Discovery endpoints, session management, tracking
6. **Security Patterns**: Encryption, session isolation, proxy tokens

The codebase provides excellent patterns for all required functionality, ensuring consistency with existing approaches while adding comprehensive custom OAuth capabilities. The implementation can follow established patterns for validation, CRUD operations, UI components, and authentication flows.

## Success Metrics for Implementation

### Core Functionality
- [ ] OAuth configuration CRUD with organization scoping
- [ ] OAuth server URL validation with real-time feedback and RFC 8414 compliance
- [ ] Client credential storage with encryption at rest
- [ ] OAuth metadata discovery and caching system
- [ ] OAuth proxy flow implementation with VHost detection
- [ ] Upstream token validation and exchange using `application/x-www-form-urlencoded`
- [ ] Proxy token issuance and mapping system
- [ ] Token lifecycle management with proper expiration handling
- [ ] Session tracking isolation for custom OAuth users

### Integration Points
- [ ] Seamless integration with existing server creation flow
- [ ] No regression in platform OAuth functionality
- [ ] Proper organization-scoped configuration
- [ ] VHost routing compatibility
- [ ] User tracking and analytics preservation

### Security Requirements
- [ ] Client secret encryption at rest
- [ ] Fail-closed behavior on upstream errors
- [ ] Token validation against issuer
- [ ] Session isolation between auth systems
- [ ] Organization boundary enforcement

The research reveals a well-architected foundation ready for custom OAuth implementation, requiring focused development on configuration UI, upstream OAuth integration, and proxy token management while preserving the existing dual authentication architecture.