---
date: 2025-09-05T10:35:05-05:00
researcher: Kyle Mistele
git_commit: e331e3d22c8c9d3da23e1ae092a91f4edad380e1
branch: master
repository: mcplatform
topic: "Comprehensive OAuth System Analysis for Custom OAuth Feature Implementation"
tags: [research, codebase, oauth, authentication, mcp-servers, dual-auth, custom-oauth]
status: complete
last_updated: 2025-09-05
last_updated_by: Kyle Mistele
last_updated_note: "Corrected OAuth architecture understanding and added detailed implementation requirements"
type: research
---

# Research: Comprehensive OAuth System Analysis for Custom OAuth Feature Implementation

**Date**: 2025-09-05T10:35:05-05:00  
**Researcher**: Kyle Mistele  
**Git Commit**: e331e3d22c8c9d3da23e1ae092a91f4edad380e1  
**Branch**: master  
**Repository**: mcplatform

## Research Question
Analyze the complete OAuth system in MCPlatform to understand how to implement the 08-custom-oauth feature, including all relevant OAuth-related code, endpoints, actions, schemas, and UI components.

## Summary
MCPlatform implements a sophisticated dual authentication architecture using BetterAuth with complete separation between platform customers and their end-users. The system includes VHost-based routing for MCP servers, comprehensive database schemas ready for custom OAuth, established UI patterns for configuration, but the custom OAuth implementation remains incomplete and requires significant development to support customer OAuth providers.

## Detailed Findings

### Database Architecture & Schema Foundation

**Primary Platform Authentication Schema** (`packages/database/src/auth-schema.ts`):
- `user` (lines 3-17): Platform customer accounts with standard OAuth fields
- `session` (lines 19-31): Platform sessions with organization context via `activeOrganizationId`
- `account` (lines 33-49): OAuth provider linkages with complete token management
- `oauthApplication`/`oauthAccessToken`/`oauthConsent` (lines 60-96): Full OAuth server infrastructure

**Secondary MCP OAuth Schema** (`packages/database/src/mcp-auth-schema.ts`):
- Complete parallel schema with `mcp_` prefixes for end-user authentication
- `mcpOAuthApplication` (lines 60-73): **For MCP server dynamic client registration only** (not custom OAuth configs)
- `mcpOAuthUser`/`mcpOAuthSession` (lines 3-31): End-user session management via platform OAuth
- **IMPORTANT**: This schema is for MCPlatform's secondary OAuth tenant with dynamic client registration, NOT for custom OAuth server configurations

**Core Application Schema** (`packages/database/src/schema.ts`):
- `mcpServers` table (lines 108-127): Contains unused `oauthIssuerUrl` field (line 117)
- `authType` enum supports `custom_oauth` but implementation missing
- VHost routing via `slug` field (line 120) enables subdomain-based server resolution

### Authentication Middleware & Core Logic

**Platform Authentication** (`packages/dashboard/src/lib/auth/auth.ts:22-97`):
- Primary BetterAuth instance with GitHub/Google OAuth providers
- Organization multi-tenancy plugin with `requireSession()` helper
- Standard `/api/auth` routes for customer authentication

**Sub-tenant Authentication** (`packages/dashboard/src/lib/auth/mcp/auth.ts:17-52`):
- Secondary BetterAuth instance with separate schema
- Custom `/mcp-oidc/auth` base path for end-user authentication
- Cross-subdomain cookie support for MCP server access

**VHost-Based Routing** (`packages/dashboard/src/lib/mcp/index.ts:117-159`):
- `getMcpServerConfiguration()` extracts subdomain from Host header
- Maps subdomain to `mcp_servers.slug` for dynamic server resolution
- Critical foundation for multi-tenant MCP server hosting

**Authentication Middleware** (`packages/dashboard/src/lib/mcp/with-mcp-auth.ts:3-40`):
- `withMcpAuth()` wrapper validates MCP OAuth sessions
- Returns JSON-RPC 2.0 errors with WWW-Authenticate headers
- Currently only supports platform OAuth, needs custom OAuth extension

### API Endpoints & Route Structure

**Platform OAuth Routes**:
- `/api/auth/[[...all]]/route.ts:4` - Main BetterAuth API handler
- Standard OAuth callback and token endpoints

**MCP OAuth Routes**:
- `/mcp-oidc/auth/[[...all]]/route.ts:6` - Secondary auth handler with response patching
- `/mcp-oidc/authorize/route.ts:9` - OAuth authorization endpoint
- Response patching fixes BetterAuth callback format issues

**OAuth Discovery Endpoints**:
- `/.well-known/oauth-authorization-server/route.ts` - OAuth server metadata
- `/.well-known/oauth-protected-resource/route.ts` - Resource server metadata
- Foundation for RFC 8414 compliance

**MCP Server API**:
- `/api/mcpserver/[...slug]/route.ts:22` - Main MCP endpoint with authentication

### UI Components & Configuration Patterns

**Authentication Type Selection**:
- `add-server-modal.tsx:254` - Includes `custom_oauth` option but no configuration UI
- `edit-server-configuration.tsx:145` - Same selection pattern for existing servers
- Both use identical Select component structure with four auth types

**Real-time Validation Infrastructure** (`add-server-modal.tsx:97-128`):
- 2-second debounced validation pattern with server-side checks
- Visual feedback system with loading states and error styling
- Pattern ready for OAuth server URL validation

**Missing Custom OAuth UI**:
- No OAuth server URL input field with validation
- No client ID/secret configuration forms
- No progressive disclosure after URL validation
- No OAuth metadata discovery feedback

### Current Custom OAuth Implementation Status

**Database Schema**: ❌ Requires New Tables
- `oauthIssuerUrl` field exists in `mcp_servers` table but insufficient
- Existing MCP OAuth tables are for dynamic client registration, not custom OAuth
- Need separate tables for custom OAuth configuration and upstream token storage

**Authentication Types**: ✅ Defined  
- `custom_oauth` enum value present in schemas and UI
- Type definitions in `schemas.isometric.ts:5`

**UI Selection**: ✅ Basic Support
- Dropdown includes custom OAuth option
- Form validation framework established

**Configuration UI**: ❌ Missing
- No OAuth server URL, client ID, or client secret fields
- No validation of OAuth server endpoints
- No real-time OAuth metadata discovery

**Backend Implementation**: ❌ Missing  
- No custom OAuth provider registration logic
- No upstream OAuth server token validation
- No proxy token issuance system
- No custom OAuth session handling in `withMcpAuth`

### Server Actions & Data Flow

**MCP Server Management** (`packages/dashboard/src/lib/orpc/actions/mcp-servers.ts`):
- `createMcpServerAction` accepts `authType` including `custom_oauth`
- No validation or processing of custom OAuth configurations
- Server creation stores auth type but no OAuth-specific data

**Organization Actions** (`packages/dashboard/src/lib/orpc/actions/organization.ts`):
- Standard organization CRUD with authentication checks
- Foundation for organization-scoped OAuth configurations

### User Tracking & Session Management

**User Tracking System** (`packages/dashboard/src/lib/mcp/tracking.ts:57-240`):
- Combines OAuth session, tracking ID, and email identification
- Session management with `Mcp-Session-Id` header
- User reconciliation with conflict handling
- Ready for custom OAuth user identification

**Session Architecture**:
- Platform sessions: Standard BetterAuth with organization context
- MCP sessions: Separate tracking with user linking via email/ID
- Custom OAuth would need additional session isolation

## Code References

### Database Schema
- `packages/database/src/auth-schema.ts:3-96` - Platform authentication tables
- `packages/database/src/mcp-auth-schema.ts:3-96` - MCP OAuth tables  
- `packages/database/src/schema.ts:108-127` - MCP servers with OAuth config
- `packages/database/src/schema.ts:117` - Unused `oauthIssuerUrl` field

### Authentication Core
- `packages/dashboard/src/lib/auth/auth.ts:22-97` - Primary BetterAuth configuration
- `packages/dashboard/src/lib/auth/mcp/auth.ts:17-52` - Secondary MCP auth
- `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:3-40` - Authentication middleware
- `packages/dashboard/src/lib/mcp/index.ts:117-159` - VHost routing logic

### API Routes
- `packages/dashboard/src/app/api/auth/[[...all]]/route.ts:4` - Platform OAuth
- `packages/dashboard/src/app/mcp-oidc/auth/[[...all]]/route.ts:6` - MCP OAuth
- `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:22` - MCP server API

### UI Components
- `packages/dashboard/src/components/add-server-modal.tsx:254` - OAuth type selection
- `packages/dashboard/src/components/edit-server-configuration.tsx:145` - Edit config
- `packages/dashboard/src/components/add-server-modal.tsx:97-128` - Validation pattern

### Server Actions
- `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:90` - Server creation with auth type
- `packages/dashboard/src/lib/schemas.isometric.ts:5` - Auth type enum definition

## Architecture Insights

### Dual Authentication Philosophy
The system maintains strict separation between two user types:
1. **Platform Customers**: Dashboard access, server management, organization admin
2. **End-Users**: MCP server interaction, OAuth identification only, no dashboard access

This separation enables clean multi-tenancy while providing customer analytics on their users.

### VHost-Based Multi-tenancy
Subdomain routing allows unlimited MCP servers per customer:
- `customer.mcplatform.com` → MCP server with slug `customer`
- Single API endpoint dynamically serves all servers
- Database lookup via Host header extraction

### Security-First Token Strategy
Current platform OAuth and planned custom OAuth both use proxy token approach:
- Never expose upstream OAuth tokens directly to MCP clients
- MCPlatform issues its own tokens after upstream validation
- Prevents token abuse and maintains session control

### OAuth Proxy Flow Architecture

**Critical Insight**: MCPlatform acts as an OAuth proxy because upstream OAuth servers don't support dynamic client registration that MCP servers require.

**Complete Authentication Flow**:
1. **MCP Server → MCPlatform**: MCP server uses dynamic client registration with secondary OAuth tenant (existing system)
2. **User Authorization Request**: User redirected to MCPlatform OAuth system initially
3. **VHost Detection**: MCPlatform detects custom OAuth via Host header → MCP server lookup
4. **Upstream Redirect**: MCPlatform immediately redirects to upstream OAuth authorization server
5. **User OAuth Flow**: User completes OAuth with upstream server (customer's system)
6. **Callback to MCPlatform**: Upstream server redirects back with authorization code
7. **Token Exchange**: MCPlatform exchanges code for access token with upstream server using `application/x-www-form-urlencoded`
8. **Token Storage**: MCPlatform stores upstream access token and refresh token (if provided) internally
9. **Proxy Token Issuance**: MCPlatform issues its own proxy token to user

**Token Lifecycle Management**:
- `expires_in` field from upstream server is in **seconds** (not milliseconds or timestamp)
- Compute expiration: `expires_at = current_timestamp_ms + (expires_in * 1000)`
- On request: Check `expires_at` against current timestamp
- If expired: Return 401 with WWW-Authenticate header (no refresh token usage initially)
- If valid: Proceed with upstream token for user identification

### Progressive Configuration Pattern
UI follows established pattern of progressive disclosure:
1. Create/manage OAuth configurations separately from MCP servers
2. Select existing OAuth configuration when creating MCP servers
3. Enable reusability: one OAuth config → multiple MCP servers
4. Validate configuration in real-time with clear feedback

## Historical Context (from thoughts/)

### Authentication Evolution
From `specifications/04-user-management/research/research_2025-08-25_15-58-23_auth-implementation.md`:
- Initial system used single authentication approach
- Dual auth system emerged from need to separate customer and end-user data
- VHost routing added to support unlimited MCP servers per organization

### Design Trade-offs
From various thought documents:
- **Token Isolation**: Chose proxy tokens over direct upstream tokens for security
- **Schema Separation**: Complete table isolation vs. shared tables with tenant flags
- **Better Auth**: Multiple instances vs. single instance with plugins
- **Session Management**: Separate tracking systems vs. unified session store

### OAuth 2.0 Standards Compliance (RFC 6749)
From comprehensive research of OAuth refresh token standards:
- **Refresh Token Requests**: MUST use `Content-Type: application/x-www-form-urlencoded` with UTF-8 encoding
- **Response Format**: OAuth servers respond with `application/json`
- **Required Parameters**: `grant_type=refresh_token`, `refresh_token`, `client_id`, `client_secret`
- **Provider Consistency**: Google, Microsoft, GitHub all follow RFC 6749 specification
- **Token Rotation**: Most providers issue new refresh tokens and expect old ones to be discarded

## Open Questions & Implementation Requirements

### Database Schema Additions Needed

**Custom OAuth Configuration Table**:
```sql
custom_oauth_configs (
    id,
    organization_id,     -- FK to organization
    name,                -- Human-readable identifier
    authorization_url,   -- Direct OAuth authorization endpoint
    metadata_url,        -- .well-known/oauth-authorization-server endpoint
    client_id,           -- Registered with upstream OAuth server
    client_secret,       -- Encrypted client secret for token exchange
    created_at
)
```

**Upstream Token Storage Table**:
```sql
upstream_oauth_tokens (
    id,
    mcp_server_user_id,  -- FK to user who authorized
    oauth_config_id,     -- FK to OAuth configuration used
    proxy_token_id,      -- FK to MCPlatform-issued proxy token
    access_token,        -- Encrypted upstream access token
    refresh_token,       -- Encrypted upstream refresh token (nullable)
    expires_at,          -- Computed: current_timestamp_ms + (expires_in * 1000)
    created_at
)
```

**MCP Server Reference Update**:
```sql
-- Add to existing mcp_servers table:
custom_oauth_config_id -- FK to custom_oauth_configs (nullable)
```

### Authentication Middleware Enhancements
1. **OAuth Provider Detection**: Detect custom vs. platform OAuth per server
2. **Upstream Token Validation**: Validate tokens against customer OAuth servers
3. **Proxy Token Issuance**: Generate MCPlatform tokens after upstream validation
4. **Error Handling**: Graceful degradation when upstream servers unavailable

### UI Implementation Requirements

**OAuth Configuration Management (New)**:
1. **OAuth Config CRUD Interface**: Organization-scoped OAuth configuration management
2. **OAuth Server URL Field**: Debounced validation against `.well-known/oauth-authorization-server` endpoint
3. **Client Credential Fields**: Client ID (text) and client secret (password with show/hide toggle)
4. **Progressive Disclosure**: Show client fields only after successful URL validation
5. **Real-time Feedback**: Success/error/loading indicators for OAuth server validation
6. **RFC 8414 Validation**: Validate OAuth Authorization Server Metadata schema

**MCP Server Integration**:
1. **OAuth Config Selection**: Dropdown to select existing OAuth configurations (not inline setup)
2. **Reusability Support**: Enable one OAuth config to be used by multiple MCP servers
3. **Form Integration**: Extend existing server creation/editing forms with OAuth config reference
4. **Migration Path**: Handle transition from inline OAuth fields to referenced configurations

### Validation & Discovery Logic
1. **RFC 8414 Compliance**: Validate OAuth Authorization Server Metadata
2. **Endpoint Health Checking**: Test OAuth server availability
3. **Metadata Caching**: Cache and refresh OAuth server configurations
4. **Error Recovery**: Handle temporary upstream OAuth server failures

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

The OAuth system analysis reveals a well-architected foundation ready for custom OAuth implementation, requiring focused development on configuration UI, upstream OAuth integration, and proxy token management while preserving the existing dual authentication architecture.