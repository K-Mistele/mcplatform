---
date: "2025-09-12T14:46:32-05:00"
researcher: "Assistant"
git_commit: "9bb696cd123ea4409414db01503518dbd682f1a3"
branch: "08-custom-oauth"
repository: "mcplatform"
topic: "OAuth User Creation and Provisioning Implementation Strategy"
tags: [implementation, strategy, oauth, user-provisioning, mcp-server-user, custom-oauth]
status: complete
last_updated: "2025-09-12"
last_updated_by: "Assistant"
type: implementation_strategy
---

# OAuth User Creation and Provisioning Implementation Plan

## Overview

Implementing synchronous user creation during the OAuth callback flow to resolve foreign key constraint violations and enable proper de-anonymization of end-users through upstream OAuth providers. This completes the custom OAuth proxy implementation by properly creating mcpServerUser records with organization-scoped deduplication.

## Current State Analysis

The OAuth callback flow currently fails with foreign key constraint violations because it generates placeholder user IDs without creating corresponding database records.

### Key Discoveries:
- **Broken Flow**: OAuth callback at `packages/dashboard/src/app/oauth/callback/route.ts:175` generates `mcp_user_${nanoid()}` placeholder IDs that don't exist in the database
- **Foreign Key Violation**: `upstreamOAuthTokens` table requires valid `mcpServerUserId` reference at `packages/database/src/schema.ts:493`
- **Existing Infrastructure**: Userinfo endpoint already implemented at `packages/dashboard/src/app/oauth/userinfo/route.ts:118` with metadata discovery
- **User Creation Pattern**: Established pattern in `packages/dashboard/src/lib/mcp/tracking.ts:138-156` using upsert with conflict resolution
- **Null Email Support**: Database and application fully support users with null emails for providers that don't return email addresses
- **Organization Scoping**: Users deduplicated through mcpServerSession → mcpServers → organization relationship chain

## What We're NOT Doing

- Implementing async user enrichment (synchronous creation only)
- Supporting username/preferred_username as email alternatives
- Handling refresh token automatic renewal for userinfo fetching
- Creating direct organizationId foreign keys on mcpServerUser
- Modifying Better Auth configuration or tables
- Implementing email verification workflows

## Implementation Approach

Single-phase synchronous implementation that adds user creation logic directly into the OAuth callback flow, leveraging existing patterns and infrastructure.

## Phase 1: OAuth User Creation Implementation

### Overview
Add synchronous user creation with userinfo fetching to the OAuth callback handler, resolving foreign key constraints and enabling proper user de-anonymization.

### Changes Required:

#### 1. Database Schema Enhancement
**File**: `packages/database/src/schema.ts`
**Changes**: Add columns to mcpServerUser for OAuth profile data

**Implementation Requirements:**
- Add `upstreamSub` column (text, indexed) to store upstream OAuth provider's user ID
- Add `profileData` column (jsonb) to store complete userinfo response for future reference
- Keep existing `email` column nullable to support providers without email
- Add index on `upstreamSub` for efficient lookups by upstream user ID
- Maintain backward compatibility with existing records
- Schema should look like:
  - `upstreamSub: text('upstream_sub')` with index
  - `profileData: jsonb('profile_data')`
  - No changes to existing columns to maintain compatibility

#### 2. Database Index Creation
**File**: `packages/database/src/schema.ts`
**Changes**: Add performance indexes to mcpServerUser table

**Implementation Requirements:**
- Add index on `upstreamSub` column for efficient lookups by upstream OAuth provider user ID
- Maintain existing indexes on `email` and `trackingId` columns
- Index definition should follow existing pattern:
  ```typescript
  (t) => [
      index('mcp_server_user_distinct_id_idx').on(t.trackingId),
      index('mcp_server_user_email_idx').on(t.email),
      index('mcp_server_user_upstream_sub_idx').on(t.upstreamSub)  // New index
  ]
  ```
- Ensure index names follow the existing convention: `mcp_server_user_[column]_idx`
- Indexes will be created automatically when migration is generated and run

#### 3. Userinfo Fetching Helper Enhancement
**File**: `packages/dashboard/src/app/oauth/callback/route.ts`
**Changes**: Import and use existing userinfo discovery helper

**Implementation Requirements:**
- Import `getUserinfoUrlFromMetadata` helper from userinfo route
- Add helper function to fetch userinfo with proper error handling
- Support both successful responses and graceful degradation
- Extract email, sub, and full profile from userinfo response
- Handle missing or invalid userinfo endpoints
- Use existing pattern from `packages/dashboard/src/app/oauth/userinfo/route.ts:134-139`

#### 4. Organization-Scoped User Deduplication
**File**: `packages/dashboard/src/app/oauth/callback/route.ts`
**Changes**: Add user lookup logic with organization scoping

**Implementation Requirements:**
- After successful token exchange (line 167), fetch OAuth configuration's organizationId
- Check for existing user with same email within organization scope using JOIN pattern:
  - mcpServerUser → mcpServerSession → mcpServers → organization
- If email is null, check by upstreamSub within organization scope
- Use existing organization-scoped query pattern from `packages/dashboard/src/app/dashboard/users/page.tsx:15-37`
- Return existing user ID if found to enable cross-server deduplication

#### 5. User Creation Logic
**File**: `packages/dashboard/src/app/oauth/callback/route.ts`
**Changes**: Replace placeholder user ID generation with actual user creation

**Implementation Requirements:**
- Replace line 175's placeholder ID generation with proper user creation
- Create mcpServerUser record with:
  - `email` from userinfo (nullable)
  - `upstreamSub` from userinfo sub claim
  - `profileData` with complete userinfo response
  - Auto-generated ID via schema default (`mcpu_${nanoid(12)}`)
- Use upsert pattern from `packages/dashboard/src/lib/mcp/tracking.ts:138-156`
- Handle conflicts on email within organization scope
- Store created/found user ID for token storage
- Ensure transaction consistency between user creation and token storage

#### 6. Token Storage Update
**File**: `packages/dashboard/src/app/oauth/callback/route.ts`
**Changes**: Use real user ID in upstreamOAuthTokens

**Implementation Requirements:**
- Update line 183 to use the created/found mcpServerUser ID
- Maintain existing token encryption TODOs for future implementation
- Ensure foreign key constraint is satisfied
- Keep existing expiration calculation logic
- Verify referential integrity with cascade deletes

#### 7. Userinfo Endpoint Enhancement
**File**: `packages/dashboard/src/app/oauth/userinfo/route.ts`
**Changes**: Remove placeholder user ID update logic

**Implementation Requirements:**
- Remove lines 161-167 that update placeholder IDs (no longer needed)
- Ensure userinfo endpoint returns consistent user data
- Keep existing error handling and fallback responses
- Maintain backward compatibility for existing tokens

### Success Criteria:

**Manual Verification**
- [ ] OAuth callback completes without foreign key constraint violations
- [ ] Users are properly created with email and upstream sub
- [ ] Organization-scoped deduplication prevents duplicate users with same email
- [ ] Users without email from OAuth provider are still created successfully
- [ ] Userinfo data is stored and retrievable from profileData jsonb column
- [ ] Existing OAuth flows continue to work without regression
- [ ] Token storage maintains referential integrity
- [ ] User analytics show accurate de-anonymized users

## Performance Considerations

- **Database Indexing**: Add indexes on `upstreamSub` and maintain existing indexes on `email` and `trackingId`
- **Query Optimization**: Organization-scoped queries use existing indexed relationships through mcpServers
- **Transaction Handling**: User creation and token storage should be atomic to prevent partial states

## Migration Notes

- Existing mcpServerUser records remain unchanged (backward compatible)
- New columns (`upstreamSub`, `profileData`) will be null for existing records
- No data migration needed - OAuth users will be enriched on next authentication

## References

* Original ticket: `specifications/08-custom-oauth/03-user-creation/feature.md`
* Research document: `specifications/08-custom-oauth/03-user-creation/research_2025-09-12_11-53-22_oauth-user-creation-better-auth.md`
* OAuth implementation plan: `specifications/08-custom-oauth/implementation-plan.md`
* OAuth callback handler: `packages/dashboard/src/app/oauth/callback/route.ts:173-191`
* User creation pattern: `packages/dashboard/src/lib/mcp/tracking.ts:138-156`
* Userinfo endpoint: `packages/dashboard/src/app/oauth/userinfo/route.ts:118-174`
* Organization-scoped queries: `packages/dashboard/src/app/dashboard/users/page.tsx:15-37`