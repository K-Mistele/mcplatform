---
date: 2025-08-25T15:58:23-05:00
researcher: Claude
git_commit: 94ead03981f349eb668563406112a4710b6f385e
branch: master
repository: mcplatform
topic: "Authentication Implementation and User Management Architecture"
tags: [research, codebase, authentication, user-management, organization, better-auth]
status: complete
last_updated: 2025-08-25
last_updated_by: Claude
type: research
---

# Research: Authentication Implementation and User Management Architecture

**Date**: 2025-08-25T15:58:23-05:00
**Researcher**: Claude
**Git Commit**: 94ead03981f349eb668563406112a4710b6f385e
**Branch**: master
**Repository**: mcplatform

## Research Question
Research the codebase to understand how the existing auth implementation is done, where it's located, and what work needs to be done for the user management feature.

## Summary
The MCPlatform implements a sophisticated dual authentication system with Better Auth, separating platform customers from their end-users. The organization management foundation exists but lacks critical UI components for member management, invitations, and role administration. The architecture is well-designed with clear patterns for extension.

## Detailed Findings

### Authentication Architecture

#### Dual Authentication System
The platform implements **two completely separate authentication systems**:

1. **Platform Authentication** (`packages/dashboard/src/lib/auth/auth.ts:22-57`)
   - Primary Better Auth instance for dashboard customers
   - Plugins: `organization()` and `mcp()` 
   - Providers: Email/password, GitHub, Google OAuth
   - Session management with organization context requirement
   - Redirects: No session → `/login`, No org → `/organization/new` or `/organization/select`

2. **Sub-tenant Authentication** (`packages/dashboard/src/lib/auth/mcp/auth.ts`)
   - Secondary Better Auth instance for end-user de-anonymization
   - Base path: `/mcp-oidc/auth`
   - Cross-subdomain cookies enabled for vhost routing
   - Separate schema with `mcp_` prefixed tables
   - These users NEVER get dashboard access (so ignore this sub-tenant for the purposes of this feature)

#### VHost-Based Routing
- MCP servers identified by subdomain extraction (`packages/dashboard/src/lib/mcp/index.ts:117-159`)
- `getMcpServerConfiguration` inspects Host header
- Maps subdomain to MCP server slug in database
- Single API route serves unlimited MCP servers dynamically

### Database Schema

#### Platform Authentication Tables (`packages/database/src/auth-schema.ts`)
- **user**: Platform users with email verification
- **organization**: Tenant organizations with slug, logo, metadata
- **member**: Organization membership with roles (default: 'member')
- **invitation**: Pending invitations with expiration and role
- **session**: Sessions with `activeOrganizationId` for multi-tenancy

#### Sub-tenant Tables (`packages/database/src/mcp-auth-schema.ts`)
- **mcp_oauth_user**: End-users of customer products
- **mcp_oauth_session**: End-user OAuth sessions
- **mcp_server_user**: Analytics tracking with `trackingId`

### Existing Organization Components

#### Already Implemented (`packages/dashboard/src/components/`)
- **Organization Selection**: `select-organization.tsx` - Multi-org switcher
- **Organization Creation**: Complete onboarding flow with name, domain, logo steps
- **User Tables**: `users-table.tsx` - Advanced table for MCP users (not org members)
- **User Details**: `user-detail-client.tsx` - Three-pane interface for user profiles
- **Avatar System**: `user-avatar.tsx` - Reusable with identicon fallback

#### Missing Components
1. **Organization Settings Page** - No centralized settings interface
2. **Member Management UI** - No interface to view/manage organization members
3. **Role Management** - No UI to change member roles
4. **Invitation System** - No UI to invite users to organization
5. **Invitation Management** - No interface for pending invitations
6. **Member Removal** - No UI to remove members

### Server Actions (oRPC)

#### Current Pattern (`packages/dashboard/src/lib/orpc/actions/`)
```typescript
const session = await requireSession() // Authentication
// Verify organization: session.session.activeOrganizationId
// Perform operation
revalidatePath('/affected-path') // Revalidation
```

#### Existing Organization Actions
- `getOrganizationMembers` - Read-only query in router.ts

#### Required New Actions
1. **Invitation Management**:
   - `inviteUserToOrganization`
   - `resendInvitation`
   - `cancelInvitation`
   - `getOrganizationInvitations`

2. **Member Management**:
   - `updateMemberRole`
   - `removeMemberFromOrganization`
   - `transferOrganizationOwnership`

3. **Organization Settings**:
   - `updateOrganizationSettings`
   - `deleteOrganization`

### Routes and Navigation

#### Existing Routes
- `/organization/new` - Organization creation flow
- `/organization/select` - Organization selection
- `/dashboard/users` - MCP users (sub-tenant)
- `/dashboard/users/[identifier]` - User details

#### Required New Routes
- `/dashboard/organization/settings` - Main settings page
- `/dashboard/organization/settings/members` - Member management
- `/dashboard/organization/settings/invitations` - Invitation management
- `/dashboard/organization/settings/profile` - Organization profile

### Better Auth Integration

#### Available Organization APIs
The Better Auth organization plugin provides:
- `auth.api.inviteToOrganization()`
- `auth.api.acceptInvitation()`
- `auth.api.listInvitations()`
- `auth.api.revokeInvitation()`
- `auth.api.updateMemberRole()`
- `auth.api.removeMember()`

These can be leveraged in server actions to implement the missing functionality.

## Code References
- `packages/dashboard/src/lib/auth/auth.ts:22-57` - Main authentication configuration
- `packages/dashboard/src/lib/auth/auth.ts:73-96` - Session helper with org requirement
- `packages/dashboard/src/lib/auth/mcp/auth.ts:15-42` - Sub-tenant auth configuration
- `packages/database/src/auth-schema.ts:98-131` - Organization schema tables
- `packages/dashboard/src/components/select-organization.tsx` - Organization selector
- `packages/dashboard/src/components/users-table.tsx` - Advanced user table component
- `packages/dashboard/src/lib/orpc/actions/support-tickets.ts` - Action pattern reference
- `packages/dashboard/src/lib/mcp/index.ts:117-159` - VHost routing implementation

## Architecture Insights

1. **Clean Separation**: Dual auth system maintains clear boundaries between customers and end-users
2. **Multi-tenancy First**: Every operation is organization-scoped via `activeOrganizationId`
3. **Consistent Patterns**: Server actions, client components, and data loading follow established conventions
4. **Plugin-Based**: Better Auth plugins provide most functionality out-of-the-box
5. **Type Safety**: TypeScript definitions ensure compile-time safety for auth operations
6. **Revalidation**: Path-based cache invalidation after mutations

## Historical Context (from thoughts/)
- `specifications/04-user-management/thoughts/better_auth_organization_with_invite.md` - Complete Better Auth organization plugin documentation
- `specifications/04-user-management/thoughts/better_auth_admin_plugin.md` - Admin plugin with advanced user management
- `specifications/03-interactive-walkthrough/thoughts/oauth-integration-notes.md` - Dual authentication architecture decision
- `specifications/thoughts/mcp-tool-integration-design.md` - MCP tool authentication patterns

## Related Research
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/research/research_2025-07-28_17-35-57_walkthrough-authoring-codebase-patterns.md` - Authentication patterns analysis
- `specifications/05-installation-example/research/research_2025-08-05_11-57-51_mcp-installation.md` - Organization-scoped MCP server installation

## Open Questions
1. Should the admin plugin be integrated for advanced user management features?
2. What level of role granularity is needed beyond owner/admin/member?
3. Should invitation emails be sent directly or provide copyable links?
4. How should the last organization owner/admin removal be handled?
5. Should there be user limits per organization tier?