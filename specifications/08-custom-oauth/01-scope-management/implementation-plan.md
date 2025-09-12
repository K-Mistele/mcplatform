---
date: 2025-09-12T10:17:46-05:00
researcher: Kyle Mistele
git_commit: cc9ce5f2f3ba4351bbccaa4c775a7b099c9f750d
branch: 08-custom-oauth
repository: mcplatform
topic: "OAuth Scope Management Implementation Strategy"
tags: [implementation, strategy, oauth, scopes, custom-oauth, configuration]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: implementation_strategy
---

# OAuth Scope Management Implementation Plan

## Overview

Implementing configurable OAuth scope support for custom OAuth providers in MCPlatform. This enhancement allows customers to specify which scopes should be requested when redirecting users to their OAuth authorization servers, supporting provider-specific scope formats and requirements while maintaining the existing OAuth proxy architecture.

## Current State Analysis

The system currently uses a hardcoded default scope of `'openid profile email'` throughout the OAuth proxy flow. This limitation prevents customers from requesting provider-specific scopes needed for their applications.

### Key Discoveries:
- **Hardcoded Default**: `packages/dashboard/src/app/oauth/authorize/route.ts:185` uses fixed `'openid profile email'` scope
- **Missing Database Field**: `customOAuthConfigs` table lacks scope configuration storage
- **Passthrough Architecture**: Scopes are forwarded to upstream providers without validation or processing
- **Progressive Disclosure UI**: OAuth configuration dialog already follows patterns for conditional field display
- **Consistent Storage Pattern**: Platform uses text fields for OAuth scope storage across all tables

## What We're NOT Doing

- Scope validation against OAuth provider capabilities
- Scope mapping or transformation between providers
- Scope-based access control or permission checking
- Dynamic scope negotiation during authorization flow
- Scope syntax validation (allowing maximum provider flexibility)
- Migration of existing OAuth configurations (will use default scope)

## Implementation Approach

Single-phase implementation touching database schema, UI components, server actions, and OAuth proxy flow. All changes are interdependent and should be deployed together.

## Phase 1: Complete Scope Configuration Implementation

### Overview
Add scope configuration field to OAuth configurations with UI management and OAuth flow integration.

### Changes Required:

#### 1. Database Schema Update
**File**: `packages/database/src/schema.ts`
**Changes**: Add scopes field to customOAuthConfigs table

**Implementation Requirements:**
- Add field after `clientSecret` at line 122: `scopes: text('scopes').default('openid profile email').notNull()`
- Use plural naming `scopes` consistent with other OAuth tables
- Default value maintains backward compatibility
- NotNull constraint ensures data integrity
- No index needed as field won't be queried directly

#### 2. OAuth Configuration UI - Add Dialog
**File**: `packages/dashboard/src/components/add-oauth-config-dialog.tsx`
**Changes**: Add scope input field with progressive disclosure

**Implementation Requirements:**
- Add scope state to form state around line 36: `const [scopes, setScopes] = useState('openid profile email')`
- Add input field after client secret field (around line 246) within the progressive disclosure section
- Include helper text explaining space-delimited format and provider variations
- Field should only appear after successful OAuth server validation
- Include example placeholder showing common scope patterns
- Pass scopes value to createConfig action in handleSubmit

#### 3. OAuth Configuration UI - Edit Dialog
**File**: `packages/dashboard/src/components/edit-oauth-config-dialog.tsx`
**Changes**: Add scope editing capability

**Implementation Requirements:**
- Initialize scope state from config data around line 48: `const [scopes, setScopes] = useState(config.scopes || 'openid profile email')`
- Add scope input field after client secret field (around line 235)
- Include scopes in change detection logic (around line 138-142)
- Only include scopes in update object if changed from original value
- Maintain same helper text and formatting guidance as add dialog

#### 4. Server Actions - Schema Updates
**File**: `packages/dashboard/src/lib/orpc/actions/oauth-configs.ts`
**Changes**: Update validation schemas and database operations

**Implementation Requirements:**
- Add to `createOAuthConfigSchema` (line 24): `scopes: z.string().min(1).default('openid profile email')`
- Add to `updateOAuthConfigSchema` (line 32): `scopes: z.string().min(1).optional()`
- Include scopes in create action database insert (around line 156)
- Include scopes in update action if provided (around line 186)
- Add scopes to OAuth config fetch queries (lines 104, 116, 207)

#### 5. OAuth Configuration Type Definition
**File**: `packages/dashboard/src/components/oauth-configs-client.tsx`
**Changes**: Update TypeScript interface

**Implementation Requirements:**
- Add `scopes: string` to OAuthConfig type definition (around line 19)
- Ensure type matches database schema and server action returns

#### 6. OAuth Authorization Flow Integration
**File**: `packages/dashboard/src/app/oauth/authorize/route.ts`
**Changes**: Use configured scopes instead of hardcoded default

**Implementation Requirements:**
- After fetching oauthConfig (around line 104), extract configured scopes
- Replace hardcoded default at line 185 with: `scope: scope || oauthConfig?.scopes || 'openid profile email'`
- Maintain fallback chain: client request → config scopes → system default
- Continue passing scope to upstream provider unchanged (lines 198-199)

#### 7. OAuth Discovery Metadata
**File**: `packages/dashboard/src/app/.well-known/oauth-authorization-server/route.ts`
**Changes**: Include configured scopes in metadata

**Implementation Requirements:**
- When custom OAuth is detected, fetch OAuth config including scopes
- Add `scopes_supported` field to metadata response splitting configured scopes by space
- Format as array for RFC 8414 compliance
- Example: `scopes_supported: oauthConfig.scopes.split(' ')`

#### 8. Database Migration
**File**: Generated by Drizzle after schema update
**Changes**: ALTER TABLE migration

**Implementation Requirements:**
- After updating schema.ts, ask user to run: `cd packages/database && bun run db:generate`
- Migration will add column with default value for existing rows
- Then run: `cd packages/database && bun run db:migrate`
- No data migration needed due to default value

### Success Criteria:

**Manual Verification**
- [ ] Scope field appears in OAuth config dialog after validation
- [ ] Configured scopes are saved to database correctly
- [ ] OAuth authorization flow uses configured scopes instead of hardcoded default
- [ ] Existing OAuth configs continue working with default scope
- [ ] Edit dialog allows updating scope configuration
- [ ] Provider-specific scope formats work correctly (space, comma-delimited)

## Performance Considerations

- Scope field is a simple text column with minimal storage overhead
- No additional database queries needed during OAuth flow
- No impact on existing OAuth proxy performance
- Scope parsing only occurs during authorization redirect

## Migration Notes

- Existing OAuth configurations will automatically use default scope value
- No breaking changes to existing OAuth flows
- Customers can update scope configuration at any time
- No data migration required due to default value in schema

## Testing Approach

### Unit Testing
- Test scope parameter handling in authorization flow
- Verify scope storage and retrieval in database operations
- Validate form state management with scope field

### Integration Testing
- Test OAuth flow with various scope configurations
- Verify scope passthrough to upstream providers
- Test edit flow updating scope configuration



## References

* Original ticket: `specifications/08-custom-oauth/feature.md`
* Parent implementation plan: `specifications/08-custom-oauth/implementation-plan.md`
* Research document: `specifications/08-custom-oauth/research/research_2025-09-12_10-08-22_oauth-scope-configuration.md`
* Handoff document: `specifications/08-custom-oauth/handoffs/handoff_2025-09-12_10-13-22_oauth-scope-configuration.md`
* OAuth proxy sequence: `specifications/08-custom-oauth/oauth-proxy-sequence-diagram.md`
* Current OAuth flow: `packages/dashboard/src/app/oauth/authorize/route.ts`
* OAuth config UI: `packages/dashboard/src/components/add-oauth-config-dialog.tsx`