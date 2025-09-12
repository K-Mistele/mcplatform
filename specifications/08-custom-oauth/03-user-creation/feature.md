---
date: "2025-09-12T14:21:45-05:00"
researcher: "Assistant"
git_commit: "9bb696cd123ea4409414db01503518dbd682f1a3"
branch: "08-custom-oauth"
repository: "mcplatform"
topic: "OAuth User Creation and Provisioning Feature Specification"
tags: [feature, requirements, specification, oauth, user-provisioning, mcp-server-user, custom-oauth]
status: complete
last_updated: "2025-09-12"
last_updated_by: "Assistant"
type: feature
---

# OAuth User Creation and Provisioning Feature

## Overview
This feature completes the OAuth user provisioning flow in the custom OAuth proxy system by properly creating `mcpServerUser` records during the OAuth callback process. It resolves the current foreign key constraint violations and enables proper tracking and identification of end-users authenticating through upstream OAuth providers.

## Business Value

### For MCPlatform Customers
- Enables complete de-anonymization of end-users through OAuth authentication
- Provides accurate user analytics and tracking capabilities
- Allows customers to understand their user base through OAuth-linked identities
- Fixes critical system failures that prevent OAuth flow completion

### For End-Users
- Seamless authentication experience with their preferred OAuth provider
- Proper session management and token storage
- Consistent identity across multiple authentication sessions
- No authentication failures due to database constraint violations

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
The OAuth callback handler at `src/app/oauth/callback/route.ts:173-191` currently generates placeholder user IDs (`mcp_user_${nanoid()}`) but never creates corresponding database records. This causes foreign key constraint violations when attempting to store upstream OAuth tokens.

### Composition Pattern
The system uses a custom OAuth proxy implementation separate from Better Auth. The proxy handles customer-specific OAuth providers and maintains strict separation between platform users (customers) and MCP server users (end-users).

### Data Model
- `mcpServerUser` table: Core user tracking with analytics fields (packages/database/src/schema.ts:157-168)
- `upstreamOAuthTokens` table: Stores OAuth tokens with foreign key to `mcpServerUser` (packages/database/src/schema.ts:486-508)
- ID format: `mcpu_${nanoid(12)}` for user IDs per schema defaults

## User Stories
(in given/when/then format)

### End-Users
1. **End-User**: **Given** an end-user authenticates with an upstream OAuth provider, **when** the OAuth callback is processed, **then** a `mcpServerUser` record should be created with their email and proper ID format - User provisioning must complete without database errors

2. **End-User**: **Given** an end-user has previously authenticated with the same email, **when** they authenticate again, **then** the existing `mcpServerUser` record should be found and reused - Prevents duplicate user records

3. **End-User**: **Given** an OAuth provider returns user profile information, **when** creating the user record, **then** the email and upstream user ID should be captured and stored - Enables user identification and tracking

4. **End-User**: **Given** an OAuth provider doesn't provide an email address, **when** creating the user record, **then** the user should still be created with available information - Handles providers with limited userinfo

### MCPlatform Customers
5. **Customer**: **Given** a customer views their MCP server analytics, **when** end-users authenticate via OAuth, **then** user records should be properly created and trackable - Provides accurate user metrics

6. **Customer**: **Given** a customer configures multiple OAuth providers, **when** the same user authenticates through different providers, **then** user deduplication should occur based on email - Prevents inflated user counts

## Core Functionality

### User Profile Fetching
- Retrieve userinfo from upstream OAuth provider after token exchange
- Support both standard userinfo endpoints and custom discovery
- Extract email, sub (user ID), and other profile attributes
- Handle missing or incomplete profile data gracefully

### User Record Creation
- Create `mcpServerUser` records with proper ID format (`mcpu_${nanoid(12)}`)
- Store email address when available from OAuth provider
- Link upstream user ID (sub) for future reference
- Support creation of users without email for providers that don't provide it

### User Deduplication
- Check for existing users by email before creating new records
- Reuse existing `mcpServerUser` records when email matches
- Maintain user identity continuity across sessions
- Handle edge cases where email is not available

### Token Storage Integration
- Store upstream OAuth tokens with valid `mcpServerUserId` foreign key
- Link refresh tokens and access tokens to correct user records
- Maintain referential integrity in the database
- Enable future token refresh and user session management

## Requirements

### Functional Requirements
- OAuth callback handler must fetch userinfo from upstream provider after successful token exchange
- System must create `mcpServerUser` records with correct ID format (`mcpu_${nanoid(12)}`)
- User creation must check for existing users by email to prevent duplicates
- Token storage must reference valid `mcpServerUser` IDs to satisfy foreign key constraints
- User records must be created even when minimal profile information is available
- Userinfo endpoint discovery must support URLs advertised through `/.well-known/oauth-authorization-server`

### Non-Functional Requirements

#### Performance
- User creation and lookup operations must complete within the OAuth callback timeout window
- Database queries for user deduplication must be indexed and efficient

#### Security & Permissions
- User records must be scoped to the appropriate MCP server and organization
- OAuth tokens must only be accessible to the organization that owns the MCP server
- End-users must never gain access to platform dashboard features
- Upstream user IDs and emails must be stored securely

#### User Experience
- OAuth flow must complete without visible errors to end-users
- Authentication should succeed even with minimal profile information
- Consistent user identity must be maintained across sessions

## Design Considerations

### Layout & UI
- No direct UI changes required for this backend feature
- Error messages should be user-friendly if user creation fails
- OAuth flow should complete seamlessly from user perspective

### Responsive Behavior
- OAuth callback must handle various redirect scenarios


## Implementation Considerations

### Technical Architecture
- Integration point: `packages/dashboard/src/app/oauth/callback/route.ts` after line 167
- Follow existing user creation pattern from `packages/dashboard/src/lib/mcp/tracking.ts:138-220`
- Use proper database transactions for atomicity
- Implement proper error handling and logging

### Dependencies
- Requires successful OAuth token exchange (already implemented)
- Depends on upstream OAuth provider userinfo endpoints
- Database schema for `mcpServerUser` and `upstreamOAuthTokens`
- OIDC discovery for dynamic userinfo endpoint detection

## Success Criteria

### Core Functionality
- OAuth callbacks complete without foreign key constraint violations
- User records are properly created in `mcpServerUser` table
- Tokens are successfully stored with valid user references
- User deduplication prevents duplicate records for same email

### Technical Implementation
- All database operations maintain referential integrity
- User IDs follow correct format (`mcpu_${nanoid(12)}`)
- Error handling prevents partial state corruption
- System handles various OAuth provider configurations

### Engagement Metrics
- Successful OAuth authentication completion rate
- User record creation success rate
- Token storage success rate
- Deduplication effectiveness (no duplicate users with same email)

### Business Impact
- Complete user de-anonymization through OAuth
- Accurate user analytics and tracking
- Improved customer visibility into user base
- Reduced authentication errors and support tickets

## Scope Boundaries

### Definitely In Scope
- Fetching userinfo from upstream OAuth providers
- Creating `mcpServerUser` records during OAuth callback
- User deduplication by email
- Proper foreign key relationships for token storage
- Handling providers without email in userinfo
- Error handling for failed userinfo requests
- validate implementation of `packages/dashboard/src/app/oauth/userinfo/route.ts` in this context

### Definitely Out of Scope
- Modifying Better Auth configuration or tables
- Changing platform user authentication
- Adding new OAuth provider types
- Implementing user profile UI
- Email verification workflows
- Periodic profile data refresh

### Future Considerations
- Cross-MCP-server user deduplication within organizations
- Periodic refresh of user profile data from upstream
- User profile merging across multiple OAuth providers
- Email verification and validation workflows
- Advanced user analytics based on OAuth profiles

## Open Questions & Risks

### Questions Needing Resolution
- Should users be deduplicated across different MCP servers in the same organization? **Answer: Yes, if they have the same identity with the upstream authorization server**
- How should the system handle OAuth providers without standard userinfo endpoints? **Answer: we should check that they do when the dashboard users is configuring the custom oauth configuration in the UI. We already have a server action for validating that the OAuth authorization server metadata is present. We should make sure to also check if it has the user info key for the user info API route. And if it does not, we should warn the end user that it is not compatible.**
- What user profile fields beyond email should be stored? **Answer: store all of it in a `jsonb` column, and also copy the email to the email field**
- Should upstream user IDs (sub) be indexed for faster lookups? **Answer: yes**

### Identified Risks
- Some OAuth providers may not provide email addresses (ignore for now)
- Userinfo endpoint discovery may fail for non-standard providers (we will validate this at configuration time)
- Rate limiting on upstream userinfo endpoints could cause failures
- Database migrations may be needed for existing systems

## Next Steps
- Implement userinfo fetching in OAuth callback handler
- Add user creation logic following existing patterns
- Test with various OAuth provider configurations
- Verify foreign key constraints are satisfied
- Ready for implementation planning