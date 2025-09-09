---
date: 2025-09-05T09:26:42-05:00
researcher: Kyle Mistele
git_commit: e331e3d22c8c9d3da23e1ae092a91f4edad380e1
branch: master
repository: mcplatform
topic: "Custom OAuth Support for MCP Servers Feature Specification"
tags: [feature, requirements, specification, oauth, authentication, mcp-servers]
status: complete
last_updated: 2025-09-05
last_updated_by: Kyle Mistele
last_updated_note: "Updated with corrected OAuth proxy architecture and detailed database schema requirements"
type: feature
---

# Custom OAuth Support for MCP Servers Feature

## Overview
Enable MCP server customers to integrate their own OAuth authorization servers instead of using MCPlatform's built-in OAuth system. This allows customers to authenticate their MCP server(s)'s end-users through their existing identity providers while maintaining MCPlatform's user tracking and analytics capabilities.

A side-effect of this approach is that MCP servers are prompted to login/register through the platform customer's OAuth server and thereby onboarding users to the customer's platform as part of their interactions with the MCP server.

## Business Value

### For MCPlatform Customers
- **Reduced Integration Friction**: Use existing OAuth infrastructure without requiring users to create new accounts
- **Consistent User Experience**: End-users authenticate through familiar company login systems. E.g. if they are used to interacting with COMPANY who is a customer of our platform and they are trying to use COMPANY's mcp server; when the server prompts them to authorize they will see COMPANY's branded login experience rather than our branded one which is the secondary auth tenant of our platform. It creates a more familiar experience
- **User onboarding**: Users who are evaluating COMPANY's software through the MCP server, when prompted to login by the MCP server, will be directed to login or sign up with COMPANY's auth server rather than ours - this has the effect of the user being registered, onboarded and de-anonymized for the COMPANY rather than through us.

### For End-Users
- **Single Sign-On**: Authenticate using existing company credentials _or_ create an account with COMPANY's auths server rather than this platform's
- **Reduced Account Proliferation**: No need to create additional MCPlatform accounts
- **Familiar Authentication Flow**: Consistent with other company tools and services
- **Enhanced Security**: Benefit from company security policies and MFA requirements (if configure upstream)

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
Currently, MCP servers support four authentication types defined in `src/lib/schemas.isometric.ts:5`:
- `none`: **Not Implemented** -  No authentication required 
- `platform_oauth`: Uses MCPlatform's OAuth system (`src/lib/auth/mcp/auth.ts`) with Google/GitHub providers
- `collect_email`: Simple email collection
- `custom_oauth`: **Not implemented** - this feature will implement this option

The MCP server creation UI in `src/components/add-server-modal.tsx:254` already includes the `custom_oauth` option, but selecting it currently has no effect.

### Composition Pattern
- **Server Components**: MCP server pages use async server components that fetch data and pass promises to client components
- **Client Components**: Use `use()` hook with proper `<Suspense>` and `<ErrorBoundary>` wrappers
- **Server Actions**: Created with oRPC using `.actionable({})` for form submissions and mutations
- **Validation**: Real-time debounced validation using oRPC actions (pattern in `src/components/add-server-modal.tsx:97-128`)

### Data Model & OAuth Proxy Architecture

**IMPORTANT**: MCPlatform acts as an OAuth proxy because upstream OAuth servers don't support dynamic client registration that MCP servers require.

**Current OAuth System**: 
- `mcp-auth-schema.ts` tables are for MCP server dynamic client registration with MCPlatform's secondary OAuth tenant
- These tables are NOT suitable for custom OAuth server configurations
- Separate tables required for customer OAuth configurations and upstream token storage

**Required Database Schema**:
```sql
custom_oauth_configs (
    id,
    organization_id,     -- FK to organization  
    name,                -- Human-readable identifier
    authorization_url,   -- Direct OAuth authorization endpoint
    metadata_url,        -- .well-known/oauth-authorization-server endpoint
    client_id,           -- Registered with upstream OAuth server
    client_secret,       -- Encrypted client secret
    created_at
)

upstream_oauth_tokens (
    id,
    mcp_server_user_id,  -- FK to user who authorized
    oauth_config_id,     -- FK to custom OAuth configuration
    proxy_token_id,      -- FK to MCPlatform-issued proxy token
    access_token,        -- Encrypted upstream access token
    refresh_token,       -- Encrypted refresh token (nullable)
    expires_at,          -- Computed from expires_in seconds
    created_at
)
```

**MCP Server Reference**: Add `custom_oauth_config_id` FK to existing `mcp_servers` table

## User Stories
(in given/when/then format)

### Dashboard Users (MCPlatform Customers)
1. **OAuth Configuration Management**: **Given** I'm managing my organization, **when** I navigate to OAuth configurations, **then** I should be able to create, edit, and delete OAuth server configurations with organization scoping.

2. **OAuth Configuration Creation**: **Given** I'm creating a new OAuth configuration, **when** I enter OAuth server URL, client ID, and client secret, **then** I should see real-time validation with the client secret field being a `password`-type field with show/hide toggle.

3. **MCP Server OAuth Selection**: **Given** I'm creating an MCP server with "Custom OAuth" authentication type, **when** I select the authentication type, **then** I should see a dropdown to select from existing OAuth configurations (enabling reusability across multiple MCP servers).

4. **URL Validation**: **Given** I enter a custom OAuth server URL, **when** the system validates it, **then** it should automatically append `.well-known/oauth-authorization-server` if needed and validate the OAuth metadata endpoint per RFC 8414

5. **Configuration Feedback**: **Given** I enter an OAuth server URL, **when** validation completes, **then** I should see clear success/error indicators and cannot submit if validation fails

6. **OAuth Config Reusability**: **Given** I have multiple MCP servers, **when** they use the same OAuth provider, **then** I should be able to reuse the same OAuth configuration across multiple servers

### End-Users (Customer's Users)
1. **Authentication Flow**: **Given** I access an MCP server with custom OAuth, **when** I make an authenticated request and have not previously authorized / an auth token is not present, **then** I should be redirected to the customer's OAuth provider (not MCPlatform's)

2. **Token Exchange**: **Given** I successfully authenticate with the upstream OAuth server, **when** the authentication completes, **then** I should receive an MCPlatform-issued token for MCP API access (not the upstream token)

3. **MCP Access**: **Given** I have an MCPlatform-issued token from custom OAuth flow, **when** I make MCP tool requests, **then** they should work seamlessly with proper user tracking and analytics

## Core Functionality

### OAuth Server Discovery & Validation
- Real-time validation of OAuth server URLs using debounced pattern (2-second delay)
- Automatic `.well-known/oauth-authorization-server` path handling
- Validation against RFC 8414 OAuth Authorization Server Metadata specification using zod schema (https://datatracker.ietf.org/doc/html/rfc8414#section-2 defines the fields and their optionality/required nature; this should be reflected in the schema) 
- Clear user feedback for validation states (checking, valid, invalid, error)

### Custom OAuth Configuration Storage
- Secure storage of client credentials (client ID, client secret)
- Organization-scoped configuration (each customer manages their own OAuth settings)

### OAuth Proxy Flow Integration

**Complete Authentication Flow**:
1. **MCP Server → MCPlatform**: MCP server uses dynamic client registration with secondary OAuth tenant
2. **User Authorization Request**: User redirected to MCPlatform OAuth system  
3. **VHost Detection**: MCPlatform detects custom OAuth via Host header → MCP server lookup
4. **Upstream Redirect**: MCPlatform immediately redirects to upstream OAuth authorization server
5. **User OAuth Flow**: User completes OAuth with customer's system
6. **Callback to MCPlatform**: Upstream server redirects back with authorization code
7. **Token Exchange**: MCPlatform exchanges code for access token using `application/x-www-form-urlencoded`
8. **Token Storage**: Store upstream access/refresh tokens with computed expiration
9. **Proxy Token Issuance**: Issue MCPlatform proxy token to user

**Token Lifecycle Management**:
- `expires_in` from upstream is in **seconds** (not milliseconds/timestamp)
- Compute: `expires_at = current_timestamp_ms + (expires_in * 1000)`
- On requests: Check expiration, return 401 if expired (no refresh initially)
- Session management isolated from platform OAuth

### MCP Server Authentication
- Enhanced `withMcpAuth` middleware to detect custom OAuth configuration
- Upstream token validation when custom OAuth is configured
- Seamless fallback to platform OAuth for servers not using custom OAuth

## Requirements

### Functional Requirements
- **OAuth Discovery**: Validate OAuth server URLs and fetch/cache authorization server metadata
- **Credential Management**: Secure storage and retrieval of OAuth client credentials
- **Authentication Proxy**: Route authentication requests to appropriate OAuth servers (platform vs custom)
- **Token Validation**: Validate tokens from upstream OAuth servers using their metadata
- **Session Management**: Track custom OAuth sessions separately from platform OAuth
- **User Tracking**: Maintain user de-anonymization and analytics for custom OAuth users

### Non-Functional Requirements

#### Security & Permissions
- Client secrets must be encrypted at rest (**later: not in-scope for now**. add a note to the implementation plan WHEN we create the implementation plan that this should be accounted for but is not presently in scope)
- Token validation must verify token from the issuer, and ensure it's not expired
- Custom OAuth sessions must be isolated from platform OAuth sessions
- Organization boundaries must be enforced for all OAuth configurations
- auth tokens from upstream oauth servers should **not** be directly issued to MCP server users to prevent abuse by the MCP server; we should issue a "proxy token" of some sort that we issue and validate. 

#### User Experience
- Real-time feedback during OAuth server validation
- Clear error messages for configuration problems
- Seamless authentication experience matching upstream OAuth UX
- No disruption to existing platform OAuth functionality

## Design Considerations

### Layout & UI

**OAuth Configuration Management Interface**:
- **OAuth Config CRUD**: Organization-scoped OAuth configuration management page
- **Configuration List**: Display existing OAuth configurations with edit/delete actions
- **Configuration Form**: Create/edit OAuth configurations with real-time validation
- **Validation Indicators**: Status indicators (spinner, checkmark, X icon) next to OAuth URL field
- **Progressive Disclosure**: Show client ID/secret fields only after successful OAuth server validation
- **Client Secret Security**: Password field with show/hide toggle button

**MCP Server Integration**:
- **OAuth Config Selection**: Dropdown in MCP server creation when "Custom OAuth" is selected
- **Reusability Indication**: Show which MCP servers use each OAuth configuration
- **Help Text**: Clear explanations of OAuth configuration requirements

### Responsive Behavior
- **Long URLs**: OAuth server URLs should wrap or truncate gracefully
- **Status Messages**: Validation feedback should be readable on small screens

### State Management
- **Form State**: Use React Hook Form for OAuth configuration with proper validation
- **Validation State**: Track validation status (idle, validating, valid, invalid, error)
- **URL State**: No special URL state requirements (OAuth config is part of server creation)

## Implementation Considerations

### Technical Architecture

**Database Schema**: 
- `custom_oauth_configs` table for organization-scoped OAuth server configurations
- `upstream_oauth_tokens` table for encrypted upstream token storage with expiration tracking
- FK reference from `mcp_servers` to OAuth configurations for reusability

**Authentication Middleware**: 
- Enhanced `withMcpAuth` to detect custom OAuth via VHost routing
- OAuth proxy flow implementation with upstream redirect logic
- Proxy token issuance and validation system

**Token Management**: 
- Secure storage of upstream access/refresh tokens (encrypted at rest)
- MCPlatform proxy token generation and mapping
- Token lifecycle management with expiration checking
- RFC 6749 compliant token exchange using `application/x-www-form-urlencoded`

**Error Handling**: 
- Fail-closed behavior when upstream OAuth servers unavailable
- Proper HTTP status codes (401 with WWW-Authenticate for expired tokens)
- Graceful degradation with clear error messages

## Success Criteria

### Core Functionality
- Custom OAuth configuration UI works without errors
- OAuth server validation correctly identifies valid/invalid servers
- Authentication flows redirect to customer OAuth servers
- Token exchange issues valid MCPlatform tokens
- MCP tool requests work with custom OAuth tokens

### Technical Implementation
- Database operations properly scoped to organizations
- Custom OAuth sessions isolated from platform OAuth
- Authentication middleware correctly routes different OAuth types
- No regressions in existing platform OAuth functionality

## Scope Boundaries

### Definitely In Scope
- OAuth Authorization Server Metadata (RFC 8414) support
- Client credentials (ID/secret) management
- Token validation for standard OAuth 2.0 flows
- Real-time OAuth server validation with debouncing
- Custom OAuth session tracking and management
- Enhanced authentication middleware

### Definitely Out of Scope
- OpenID Connect identity token processing (mentioned as potential future enhancement)
- Custom scope handling (scopes not preserved from upstream tokens)
- Advanced OAuth features (device flow, client assertions, etc.)
- Migration of existing platform OAuth users to custom OAuth
- Multi-tenant OAuth server configurations per MCP server

### Future Considerations
- OpenID Connect support for identity token validation
- Custom scope mapping between upstream and MCPlatform scopes
- OAuth server health monitoring and alerting
- Advanced authentication analytics and reporting
- Support for non-standard OAuth implementations

## Open Questions & Risks

### Questions Resolved
- **Token Expiration Handling**: ✅ **RESOLVED** - Store upstream tokens with computed expiration timestamps. Return 401 with WWW-Authenticate when expired to prompt re-authorization. Refresh token implementation deferred to future iteration.
- **OAuth Standards Compliance**: ✅ **RESOLVED** - Use `application/x-www-form-urlencoded` for token requests per RFC 6749. All major providers (Google, Microsoft, GitHub) follow this standard.
- **Database Architecture**: ✅ **RESOLVED** - Separate tables for OAuth configurations and upstream token storage, isolated from existing dynamic client registration tables.

### Remaining Open Questions
- **Error Recovery**: What happens if a customer's OAuth server goes offline after configuration?
- **Migration Path**: Should there be a way to migrate existing platform OAuth users to custom OAuth?
- **Token Refresh Implementation**: Future consideration for automatic refresh token handling

### Identified Risks
- **Upstream Dependency**: Customer OAuth servers could become unavailable, blocking user access
- **Token Validation Performance**: Network calls for token validation could impact MCP request latency
- **Security Model**: Need to ensure custom OAuth doesn't introduce security vulnerabilities

## Next Steps
- Database schema design and migration planning
- OAuth Authorization Server Metadata Zod schema creation  
- Authentication middleware enhancement design
- UI/UX design for OAuth configuration forms
- Ready for implementation planning
