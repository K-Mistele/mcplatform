---
date: 2025-09-05T11:54:27-05:00
researcher: Kyle Mistele
git_commit: 622a5ca7a2d9054913b1d03f177636aca3a3c9ed
branch: master
repository: mcplatform
topic: "Custom OAuth Support for MCP Servers Implementation Strategy"
tags: [implementation, strategy, custom-oauth, authentication, oauth, mcp-servers]
status: in_progress
last_updated: 2025-09-09
last_updated_by: Claude
type: implementation_strategy
---

# Custom OAuth Support for MCP Servers Implementation Plan

## Overview

Implementing custom OAuth support for MCP servers to enable customers to integrate their own OAuth authorization servers instead of using MCPlatform's built-in OAuth system. This maintains MCPlatform's user tracking and analytics capabilities while providing customers with familiar authentication flows for their end-users.

## Current State Analysis

MCPlatform provides a robust foundation for custom OAuth implementation:

### Key Discoveries:
- **VHost-based Routing**: `packages/dashboard/src/lib/mcp/index.ts:117-159` provides subdomain-based server resolution that enables OAuth proxy detection
- **Dual Authentication Architecture**: Complete separation between platform customer authentication and end-user authentication via separate BetterAuth instances
- **OAuth Infrastructure**: RFC 8414-compliant discovery endpoints at `/.well-known/oauth-authorization-server/route.ts` ready for customization
- **Form Validation Patterns**: Established 2-second debounced validation with real-time feedback in `packages/dashboard/src/components/add-server-modal.tsx:97-128`
- **Organization-scoped CRUD**: Comprehensive patterns for configuration management following existing team/member management patterns

### Current Constraints:
- **No Encryption**: Sensitive data stored in plain text; encryption layer needed for client secrets and tokens (_out of scope for now_)
- **Incomplete Custom OAuth**: `custom_oauth` option exists in UI but has no backend implementation
- **Missing Database Schema**: Custom OAuth configurations require new database tables separate from existing MCP auth schema

## What We're NOT Doing

- OpenID Connect identity token processing (future enhancement)
- Custom scope handling or mapping between upstream and MCPlatform scopes
- Refresh token automatic renewal (initial implementation returns 401 when expired)
- Migration of existing platform OAuth users to custom OAuth
- Multi-tenant OAuth server configurations per MCP server (organization-scoped only)
- Client secret encryption at rest (added note in implementation for future consideration, _out of scope for now_)

## Implementation Approach

**Three-phase approach**: Foundation → Integration → Management

1. **Phase 1** establishes core infrastructure (database, encryption, OAuth discovery)
2. **Phase 2** implements OAuth proxy flow and authentication middleware
3. **Phase 3** builds management UI and integrates with server creation workflow

Each phase includes both automated validation (linting, type checking) and manual verification via UI testing.

## Phase 1: Core Infrastructure & Foundation

### Overview
Establish database schema and OAuth server discovery validation to support all custom OAuth functionality.

### Changes Required:

#### 1. Database Schema & Migration
**File**: `packages/database/src/schema.ts`
**Changes**: Add custom OAuth configuration tables

**Implementation Requirements:**
- Create `custom_oauth_configs` table following the schema from research analysis:
  ```sql
  custom_oauth_configs (
      id,                      -- Primary key with coac_ prefix
      organization_id,         -- FK to organization (NOT NULL, CASCADE DELETE)
      name,                    -- Human-readable identifier
      authorization_url,       -- Direct OAuth authorization endpoint  
      metadata_url,           -- .well-known/oauth-authorization-server endpoint
      client_id,              -- Registered with upstream OAuth server
      client_secret,          -- Encrypted client secret for token exchange
      created_at              -- Timestamp
  )
  ```
- Create `upstream_oauth_tokens` table for encrypted upstream token storage:
  ```sql
  upstream_oauth_tokens (
      id,                     -- Primary key with uoat_ prefix
      mcp_server_user_id,     -- FK to user who authorized
      oauth_config_id,        -- FK to OAuth configuration used
      proxy_token_id,         -- FK to MCPlatform-issued proxy token
      access_token,           -- Encrypted upstream access token
      refresh_token,          -- Encrypted upstream refresh token (nullable)
      expires_at,             -- Computed: current_timestamp_ms + (expires_in * 1000)
      created_at              -- Timestamp
  )
  ```
- Add `custom_oauth_config_id` foreign key to existing `mcp_servers` table (nullable, SET NULL on delete)
- Include proper indexing on organization_id, oauth_config_id, expires_at, and mcp_server_user_id for performance
- Use nanoid-based IDs following existing patterns (`coac_` prefix for configs, `uoat_` prefix for tokens)


#### 2. OAuth Server Discovery & Validation
**File**: `packages/dashboard/src/lib/orpc/actions/oauth-configs.ts`
**Changes**: Create OAuth server validation server action

**Implementation Requirements:**
- Create RFC 8414-compliant Zod schema for OAuth Authorization Server Metadata validation
- Implement `validateOAuthServerAction` with automatic `.well-known/oauth-authorization-server` path handling
- Include comprehensive validation against required OAuth endpoints (authorization_endpoint, token_endpoint, jwks_uri)
- Handle network failures gracefully with clear error messages for users
- Follow existing oRPC error patterns with typed error responses (INVALID_OAUTH_METADATA, OAUTH_SERVER_UNREACHABLE)

#### 3. Database Migration Script
**do not create this manually** - database migrations are created by drizzle ORM when the user runs the command to generate a migration. Once you are ready to do this, **ASK THE USER** to run the database migration generation command.

### Success Criteria:

**Automated verification**
- [x] no linter errors when running `bun lint`
- [x] database migration runs successfully with `bun run db:migrate`

**Manual Verification**
- [ ] OAuth server URL validation works with real OAuth servers
- [x] Database schema supports organization-scoped OAuth configurations
- [x] Migration completes without affecting existing MCP server functionality

### Phase 1 Status: COMPLETE ✅

**Completed Items:**
1. Database schema with all required tables (customOAuthConfigs, upstreamOAuthTokens, mcpClientRegistrations, mcpAuthorizationCodes, mcpProxyTokens)
2. Fixed circular dependency issue between upstreamOAuthTokens and mcpProxyTokens
3. Added customOAuthConfigId foreign key to mcpServers table
4. Created OAuth server validation action with RFC 8414 compliance
5. Added all CRUD operations for OAuth configurations
6. Database migrations generated and run successfully

## Phase 2: OAuth Proxy Server Implementation

### Overview
Implement a complete OAuth proxy server that sits between MCP clients and upstream OAuth servers. This proxy handles the full OAuth flow / exchange while maintaining security boundaries - MCP clients never receive upstream access tokens, only MCPlatform proxy tokens.

### OAuth Proxy Architecture

MCPlatform acts as a full OAuth authorization server from the MCP client's perspective, but proxies all authentication to the customer's upstream OAuth server behind the scenes.

**Reference Materials (VERY IMPORTANT READ BOTH OF THESE FILES):**
- Complete sequence diagram: `oauth-proxy-sequence-diagram.md`
- Visual flow diagram: `oauth-proxy-sequence-diagram.png`

_ONLY when the MCP server is configured to use custom oauth instead of platform oauth_

**Registration Phase:**
1. MCP client performs dynamic client registration at our `/oauth/register` endpoint
2. We store their redirect_uri and issue them proxy client credentials
3. We return our proxy client_id/secret (NOT the upstream server's credentials)

**Authorization Flow:**
1. MCP client makes request to `/mcp` without auth token and receives a `401` with WWW-Authenticate header pointing to `/.well-known/oauth-authorization-server`
2. MCP client fetches `/.well-known/oauth-authorization-server` using the MCP server's VHost. Based on the VHost, the endpoint looks up the MCP server configuration and OAuth configuration. **This is already implemented for platform OAuth**, we just need to add the section / logic to the existing route file for the custom oauth
3. For MCP servers configured to use **custom OAuth**, we need to return metadata pointing to our proxy endpoints (authorization, token, registration, userinfo endpoints) that **do not exist yet**
4. MCP client redirects user to our `/oauth/authorize` endpoint with their proxy client_id
5. We do VHost lookup → find MCP server → get custom OAuth config
6. We validate proxy client_id against registered clients
7. We redirect user to upstream OAuth server's authorization_endpoint with:
   - Our stored client_id (from custom_oauth_configs table)
   - Our own callback URL (not the MCP client's redirect_uri)
   - OAuth state parameter for security
8. User authorizes against upstream server
9. Upstream server callbacks to us with authorization code
10. We exchange that code for upstream access token using our stored client_secret
11. We store the upstream tokens in `upstream_oauth_tokens` table
12. We generate our own authorization code and redirect to the MCP client's registered redirect_uri

**Token Exchange:**
1. MCP client exchanges our authorization code at our `/oauth/token` endpoint
2. We validate and issue them a proxy access token (referencing the stored upstream tokens)

**Resource Access:**
1. MCP client makes authenticated requests to `/mcp` endpoints with proxy access token
2. Our authentication middleware validates proxy token and looks up associated upstream tokens
3. For user context, we call upstream OAuth server's userinfo endpoint with upstream token
4. MCP request is processed with user context and response returned to client

### Changes Required:

#### 1. OAuth Discovery Metadata (Proxy Server Endpoints)
**File**: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts`
**Changes**: Serve complete OAuth proxy server metadata

**Implementation Requirements:**
- VHost-based detection of custom OAuth configurations
- When custom OAuth is detected, serve metadata pointing entirely to our proxy endpoints:
  - `issuer`: Our platform issuer URL
  - `authorization_endpoint`: Our `/oauth/authorize` endpoint
  - `token_endpoint`: Our `/oauth/token` endpoint  
  - `userinfo_endpoint`: Our `/oauth/userinfo` endpoint
  - `jwks_uri`: Our platform JWKs endpoint
  - `registration_endpoint`: Our `/oauth/register` endpoint for dynamic client registration
  - `scopes_supported`: Match what we're issuing in proxy tokens
- Fallback to platform OAuth metadata when custom OAuth is not configured
- Proper CORS headers and RFC 8414 compliance

#### 2. Dynamic Client Registration Endpoint
**File**: `packages/dashboard/src/app/oauth/register/route.ts`
**Changes**: Create new dynamic client registration endpoint

**Implementation Requirements:**
- VHost-based lookup of MCP server and custom OAuth configuration
- Store MCP client's redirect_uri and client metadata in new `mcp_client_registrations` table
- Generate and return proxy client_id/client_secret (not upstream credentials)
- RFC 7591 compliance for dynamic client registration
- Validate redirect_uri and other client metadata per spec
- Organization-scoped client registrations tied to MCP server

#### 3. OAuth Authorization Endpoint (Proxy)
**File**: `packages/dashboard/src/app/oauth/authorize/route.ts`
**Changes**: Create OAuth authorization proxy endpoint

**Implementation Requirements:**
- VHost-based lookup of MCP server and custom OAuth configuration
- Validate incoming proxy client_id against registered clients
- Generate OAuth state parameter for security
- Redirect user to upstream OAuth server's authorization_endpoint with:
  - Our stored client_id from `custom_oauth_configs`
  - Our callback URL (not MCP client's redirect_uri)
  - Preserved state parameter for security
- Handle OAuth error responses and invalid client scenarios

#### 4. OAuth Callback Handler (Upstream → Platform)
**File**: `packages/dashboard/src/app/oauth/callback/route.ts`
**Changes**: Handle callbacks from upstream OAuth servers

**Implementation Requirements:**
- Receive authorization code from upstream OAuth server
- State parameter validation for security
- Exchange code for upstream access/refresh tokens using stored client_secret
- Store upstream tokens in `upstream_oauth_tokens` table with computed expiration
- Generate our own authorization code for the MCP client
- Redirect to MCP client's registered redirect_uri with our authorization code
- Error handling for upstream OAuth failures

#### 5. OAuth Token Endpoint (Proxy)
**File**: `packages/dashboard/src/app/oauth/token/route.ts`
**Changes**: Create OAuth token exchange proxy endpoint

**Implementation Requirements:**
- Validate incoming authorization code that we issued to MCP client
- Exchange our authorization code for MCPlatform proxy access token
- Link proxy token to stored upstream tokens in database
- Return proxy access token to MCP client (never upstream tokens)
- Support refresh token flow for proxy tokens
- RFC 6749 compliance for token exchange

#### 6. OAuth UserInfo Endpoint (Proxy)
**File**: `packages/dashboard/src/app/oauth/userinfo/route.ts`
**Changes**: Create userinfo proxy endpoint

**Implementation Requirements:**
- Validate incoming proxy access token
- Look up associated upstream tokens from `upstream_oauth_tokens` table
- Call upstream OAuth server's userinfo endpoint with upstream token
- Return user information to MCP client
- Handle upstream token expiration and refresh
- Proper error responses when upstream tokens are invalid

#### 7. Enhanced Authentication Middleware
**File**: `packages/dashboard/src/lib/mcp/with-mcp-auth.ts`
**Changes**: Support proxy token validation

**Implementation Requirements:**
- Detect proxy tokens vs platform OAuth tokens
- Validate proxy tokens against our token store
- Look up upstream tokens when needed for resource access
- Handle token expiration scenarios (both proxy and upstream)
- Maintain session isolation between different OAuth flows
- Preserve existing platform OAuth functionality

#### 8. Database Schema Extensions
**File**: `packages/database/src/schema.ts`
**Changes**: Add tables for client registrations and proxy tokens

**Implementation Requirements:**
- `mcp_client_registrations` table for dynamic client registration:
  ```sql
  mcp_client_registrations (
      id,                     -- Primary key with mcr_ prefix
      mcp_server_id,          -- FK to mcp_servers
      client_id,              -- Proxy client ID we issued
      client_secret,          -- Encrypted proxy client secret
      redirect_uris,          -- JSON array of registered redirect URIs
      client_metadata,        -- JSON for additional client metadata
      created_at              -- Timestamp
  )
  ```
- `mcp_authorization_codes` table for temporary authorization codes we issue:
  ```sql
  mcp_authorization_codes (
      id,                     -- Primary key with mac_ prefix
      mcp_client_registration_id, -- FK to client registration
      upstream_token_id,      -- FK to upstream_oauth_tokens
      code,                   -- Authorization code we issued
      expires_at,             -- Code expiration (short-lived, ~10 minutes)
      used,                   -- Boolean, prevents replay
      created_at              -- Timestamp
  )
  ```
- `mcp_proxy_tokens` table for our issued proxy tokens:
  ```sql
  mcp_proxy_tokens (
      id,                     -- Primary key with mpt_ prefix
      mcp_client_registration_id, -- FK to client registration
      upstream_token_id,      -- FK to upstream_oauth_tokens
      access_token,           -- Our proxy access token
      refresh_token,          -- Our proxy refresh token (nullable)
      expires_at,             -- Token expiration
      created_at              -- Timestamp
  )
  ```

### Success Criteria:

**Automated verification**
- [x] no linter errors (fixed minor warnings)
- [x] OAuth callback route handles authorization codes correctly
- [x] Authentication middleware correctly validates custom OAuth tokens

**Manual Verification**
- [ ] End-to-end OAuth flow works from MCP client to custom OAuth provider and back
- [ ] Upstream tokens are properly stored and retrieved with correct expiration handling
- [x] VHost routing correctly identifies custom OAuth configurations
- [x] No regression in existing platform OAuth functionality for MCP servers

### Phase 2 Status: COMPLETE ✅

**Completed Items:**
1. OAuth discovery metadata endpoint with VHost-based custom OAuth detection
2. Dynamic client registration endpoint (RFC 7591 compliant)
3. OAuth authorization proxy endpoint with state management
4. OAuth callback handler with upstream token exchange
5. OAuth token endpoint supporting authorization_code and refresh_token grants
6. OAuth userinfo proxy endpoint with graceful degradation
7. Enhanced authentication middleware supporting proxy tokens
8. Database schema extensions with all required tables
9. JWKS endpoint for RFC compliance

**Additional Enhancements:**
- Authorization sessions table for secure state tracking
- Multiple content-type support (form-encoded and JSON)
- Comprehensive OAuth error handling
- CORS support on all endpoints
- Token prefixing for easy identification (`mcp_at_`, `mcp_rt_`, `mcp_code_`)

**Known TODOs (non-blocking):**
- Token encryption (marked with TODO comments for future implementation)
- Upstream token refresh in userinfo endpoint (marked with TODO)

## Phase 3: Management UI & Server Integration

### Overview
Build organization-scoped OAuth configuration management interface and integrate custom OAuth selection into MCP server creation workflow.

### Changes Required:

#### 1. OAuth Configuration Management Page
**File**: `packages/dashboard/src/app/dashboard/oauth-configs/page.tsx`
**Changes**: Create new management page following existing patterns

**Implementation Requirements:**
- Async server component that fetches organization-scoped OAuth configurations
- Organization scoping using `session.session.activeOrganizationId` following existing team management patterns
- Pass data promises to client components wrapped in Suspense with proper loading skeletons
- Include empty state UI with clear call-to-action when no OAuth configs exist
- Support breadcrumb navigation and proper page metadata for dashboard integration

#### 2. OAuth Configuration CRUD Client
**File**: `packages/dashboard/src/components/oauth-configs-client.tsx`
**Changes**: Create client component for configuration management

**Implementation Requirements:**
- List view with search/filter functionality following existing member management patterns
- Support for creating, editing, and deleting OAuth configurations with proper confirmation dialogs
- Show usage indicators (which MCP servers use each configuration) to prevent deletion of configs in use
- Real-time validation feedback during OAuth server URL entry with 2-second debounce
- Progressive disclosure UI showing client ID/secret fields only after successful OAuth server validation
- Client secret field with show/hide toggle using password input type

#### 3. Server Actions for OAuth Configuration CRUD
**File**: `packages/dashboard/src/lib/orpc/actions/oauth-configs.ts`
**Changes**: Create comprehensive server actions

**Implementation Requirements:**
- `createOAuthConfigAction` with real-time OAuth server validation and encrypted client secret storage
- `updateOAuthConfigAction` with permission checking and validation of OAuth server changes
- `deleteOAuthConfigAction` with cascade protection (prevent deletion of configs in use by MCP servers)
- All actions must validate organization membership and scope operations to active organization
- Include proper `revalidatePath()` calls for affected dashboard routes
- Use existing oRPC error patterns with typed error definitions

#### 4. MCP Server Creation Integration
**File**: `packages/dashboard/src/components/add-server-modal.tsx`
**Changes**: Extend server creation modal for custom OAuth

**Implementation Requirements:**
- Add OAuth configuration dropdown when `authType === 'custom_oauth'` is selected
- Load organization-scoped OAuth configurations for selection dropdown
- Use progressive disclosure to show OAuth config selection only after auth type is selected
- Include "Create New Config" option that opens OAuth config creation dialog inline
- Validate that selected OAuth configuration exists and belongs to organization before server creation
- Update server creation action to store OAuth config reference in database

#### 5. Server Configuration Editing
**File**: `packages/dashboard/src/components/edit-server-configuration.tsx`
**Changes**: Support OAuth config changes in existing servers

**Implementation Requirements:**
- Allow changing OAuth configuration for existing servers using custom OAuth
- Handle migration between different OAuth configurations with proper user warnings
- Show current OAuth configuration details and usage status
- Validate new OAuth configuration selection and handle cases where config is deleted
- Include proper revalidation of server configuration after OAuth config changes

### Success Criteria:

**Automated verification**
- [ ] no linter errors with `bun lint`
- [ ] no TypeScript errors with `bun run typecheck`
- [ ] all CRUD server actions work correctly and maintain organization scoping
- [ ] OAuth configuration validation passes with real OAuth servers

**Manual Verification**
- [ ] OAuth configuration CRUD UI works smoothly with proper loading states and error handling
- [ ] Server creation flow correctly integrates custom OAuth configuration selection
- [ ] Real-time OAuth server validation provides clear user feedback during configuration
- [ ] OAuth configurations can be reused across multiple MCP servers as intended
- [ ] Existing MCP servers continue to work without regression when custom OAuth configs are added

## Performance Considerations

- **OAuth Metadata Caching**: Cache OAuth server discovery results to minimize network calls during validation
- **Database Indexing**: Proper indexes on organization_id and expires_at for OAuth token lookups
- **Token Validation**: Implement efficient token validation strategies with fallback mechanisms
- **Configuration Loading**: Cache OAuth configuration data in VHost detection to avoid repeated database queries


## References 

* Original ticket: `specifications/08-custom-oauth/feature.md`
* OAuth system analysis: `specifications/08-custom-oauth/research/research_2025-09-05_10-35-05_comprehensive-oauth-system-analysis.md`
* Comprehensive implementation research: `specifications/08-custom-oauth/research/research_2025-09-05_11-45-30_comprehensive-custom-oauth-implementation.md`
* Current VHost routing: `packages/dashboard/src/lib/mcp/index.ts:117-159`
* Validation patterns: `packages/dashboard/src/components/add-server-modal.tsx:97-128`
* Organization-scoped CRUD: `packages/dashboard/src/components/organization-members-client.tsx:36-203`

**IMPORTANT REFERENCE FILES READ THESE IF YOU HAVE NOT ALREADY TO CREATE MENTAL ALIGNMENT**
* Complete sequence diagram: `oauth-proxy-sequence-diagram.md`
* Visual flow diagram: `oauth-proxy-sequence-diagram.png`