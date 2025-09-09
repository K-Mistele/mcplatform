---
date: 2025-09-05T11:54:27-05:00
researcher: Kyle Mistele
git_commit: e331e3d22c8c9d3da23e1ae092a91f4edad380e1
branch: master
repository: mcplatform
topic: "Custom OAuth Support for MCP Servers Implementation Strategy"
tags: [implementation, strategy, custom-oauth, authentication, oauth, mcp-servers]
status: complete
last_updated: 2025-09-05
last_updated_by: Kyle Mistele
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
- **No Encryption**: Sensitive data stored in plain text; encryption layer needed for client secrets and tokens
- **Incomplete Custom OAuth**: `custom_oauth` option exists in UI but has no backend implementation
- **Missing Database Schema**: Custom OAuth configurations require new database tables separate from existing MCP auth schema

## What We're NOT Doing

- OpenID Connect identity token processing (future enhancement)
- Custom scope handling or mapping between upstream and MCPlatform scopes
- Refresh token automatic renewal (initial implementation returns 401 when expired)
- Migration of existing platform OAuth users to custom OAuth
- Multi-tenant OAuth server configurations per MCP server (organization-scoped only)
- Client secret encryption at rest (added note in implementation for future consideration)

## Implementation Approach

**Three-phase approach**: Foundation → Integration → Management

1. **Phase 1** establishes core infrastructure (database, encryption, OAuth discovery)
2. **Phase 2** implements OAuth proxy flow and authentication middleware
3. **Phase 3** builds management UI and integrates with server creation workflow

Each phase includes both automated validation (linting, type checking) and manual verification via UI testing.

## Phase 1: Core Infrastructure & Foundation

### Overview
Establish database schema, encryption utilities, and OAuth server discovery validation to support all custom OAuth functionality.

### Changes Required:

#### 1. Database Schema & Migration
**File**: `packages/database/src/schema.ts`
**Changes**: Add custom OAuth configuration tables

**Implementation Requirements:**
- Create `custom_oauth_configs` table with organization scoping, unique name constraints per organization
- Create `upstream_oauth_tokens` table for encrypted upstream token storage with expiration tracking
- Add `custom_oauth_config_id` foreign key to existing `mcp_servers` table for reusability
- Include proper indexing on organization_id, expires_at, and lookup fields for performance
- Use nanoid-based IDs following existing patterns (`coac_` prefix for configs, `uoat_` prefix for tokens)
- Store OAuth metadata as JSONB for flexibility and future extensibility

#### 2. Encryption Utilities
**File**: `packages/common/encryption.ts`
**Changes**: Create new encryption utility module

**Implementation Requirements:**
- Implement AES-256-GCM encryption with authentication following crypto best practices
- Use format `iv:authTag:encrypted` for database storage to prevent tampering
- Include environment variable `ENCRYPTION_KEY` management following existing pattern
- Add utility functions `encryptSensitiveData()` and `decryptSensitiveData()`
- Include proper error handling for malformed encrypted data and missing keys
- Note: Client secret encryption implementation serves as foundation but encryption at rest is not fully in scope for initial release

#### 3. OAuth Server Discovery & Validation
**File**: `packages/dashboard/src/lib/orpc/actions/oauth-configs.ts`
**Changes**: Create OAuth server validation server action

**Implementation Requirements:**
- Create RFC 8414-compliant Zod schema for OAuth Authorization Server Metadata validation
- Implement `validateOAuthServerAction` with automatic `.well-known/oauth-authorization-server` path handling
- Include comprehensive validation against required OAuth endpoints (authorization_endpoint, token_endpoint, jwks_uri)
- Cache OAuth metadata discovery results to avoid repeated network calls during validation
- Handle network failures gracefully with clear error messages for users
- Follow existing oRPC error patterns with typed error responses (INVALID_OAUTH_METADATA, OAUTH_SERVER_UNREACHABLE)

#### 4. Database Migration Script
**File**: `packages/database/drizzle/migrations/[timestamp]_add_custom_oauth_tables.sql`
**Changes**: Create database migration

**Implementation Requirements:**
- Add new tables with proper constraints and indexes
- Add foreign key column to mcp_servers table with SET NULL on delete
- Preserve existing data and maintain backwards compatibility
- Include proper rollback strategy for safe deployment
- Follow existing migration patterns in drizzle directory structure

### Success Criteria:

**Automated verification**
- [ ] no linter errors when running `bun lint`
- [ ] no TypeScript errors when running `bun run typecheck`
- [ ] database migration runs successfully with `bun run db:migrate`
- [ ] all new utility functions pass unit tests

**Manual Verification**
- [ ] OAuth server URL validation works with real OAuth servers (Google, GitHub, Microsoft)
- [ ] Encryption/decryption round trip preserves data integrity 
- [ ] Database schema supports organization-scoped OAuth configurations
- [ ] Migration completes without affecting existing MCP server functionality

## Phase 2: OAuth Proxy Flow & Authentication

### Overview
Implement OAuth proxy flow with VHost detection, upstream token exchange, and enhanced authentication middleware for custom OAuth servers.

### Changes Required:

#### 1. OAuth Proxy Flow Implementation
**File**: `packages/dashboard/src/app/mcp-oidc/custom-auth/[slug]/callback/route.ts`
**Changes**: Create new OAuth callback route for custom OAuth

**Implementation Requirements:**
- Implement OAuth authorization code exchange using `application/x-www-form-urlencoded` per RFC 6749
- Extract subdomain from callback URL to resolve MCP server configuration and associated OAuth config
- Store upstream access/refresh tokens with computed expiration timestamps (expires_in in seconds → expires_at in milliseconds)
- Create MCPlatform proxy token for user after successful upstream authentication
- Handle OAuth state parameter validation and error responses from upstream servers
- Integrate with existing user tracking system in `packages/dashboard/src/lib/mcp/tracking.ts`

#### 2. Enhanced Authentication Middleware
**File**: `packages/dashboard/src/lib/mcp/with-mcp-auth.ts`
**Changes**: Extend existing middleware to support custom OAuth

**Implementation Requirements:**
- Detect custom OAuth configuration via server auth type and config ID
- Validate tokens against upstream OAuth providers using discovery metadata
- Implement fallback validation strategies (token introspection, userinfo endpoint, JWKs validation)
- Return proper 401 responses with WWW-Authenticate headers when tokens are expired
- Maintain session isolation between platform OAuth and custom OAuth users
- Preserve existing platform OAuth functionality without regression

#### 3. VHost Detection Enhancement
**File**: `packages/dashboard/src/lib/mcp/index.ts`
**Changes**: Extend `getMcpServerConfiguration` to load OAuth config

**Implementation Requirements:**
- Load associated custom OAuth configuration when `authType === 'custom_oauth'`
- Cache OAuth configuration data to avoid database lookups on every request
- Handle cases where OAuth configuration is deleted but MCP server still references it
- Provide clear error handling when custom OAuth config is missing or invalid
- Maintain backwards compatibility with existing VHost routing logic

#### 4. OAuth Discovery Enhancement
**File**: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts`
**Changes**: Support custom OAuth metadata serving

**Implementation Requirements:**
- Detect custom OAuth servers via VHost and serve their OAuth metadata instead of platform metadata
- Proxy essential OAuth endpoints and metadata from customer OAuth servers
- Handle cases where upstream OAuth servers are temporarily unavailable
- Maintain proper CORS headers and content types for OAuth discovery compliance
- Include fallback to platform OAuth when custom OAuth is not configured

### Success Criteria:

**Automated verification**
- [ ] no linter errors
- [ ] no TypeScript compilation errors
- [ ] OAuth callback route handles authorization codes correctly
- [ ] Authentication middleware correctly validates custom OAuth tokens

**Manual Verification**
- [ ] End-to-end OAuth flow works from MCP client to custom OAuth provider and back
- [ ] Upstream tokens are properly stored and retrieved with correct expiration handling
- [ ] VHost routing correctly identifies custom OAuth configurations
- [ ] No regression in existing platform OAuth functionality for MCP servers

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

## Migration Notes

- **Existing oauthIssuerUrl Field**: Phase 1 creates new tables without touching existing field; future migration can populate from existing data if needed
- **Backwards Compatibility**: All existing MCP servers continue working with platform OAuth unchanged
- **Gradual Adoption**: Customers can migrate servers to custom OAuth one at a time without disruption

## References 

* Original ticket: `specifications/08-custom-oauth/feature.md`
* OAuth system analysis: `specifications/08-custom-oauth/research/research_2025-09-05_10-35-05_comprehensive-oauth-system-analysis.md`
* Comprehensive implementation research: `specifications/08-custom-oauth/research/research_2025-09-05_11-45-30_comprehensive-custom-oauth-implementation.md`
* Current VHost routing: `packages/dashboard/src/lib/mcp/index.ts:117-159`
* Validation patterns: `packages/dashboard/src/components/add-server-modal.tsx:97-128`
* Organization-scoped CRUD: `packages/dashboard/src/components/organization-members-client.tsx:36-203`