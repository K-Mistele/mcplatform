---
date: 2025-08-25T17:21:47-05:00
researcher: Claude
git_commit: 94ead03981f349eb668563406112a4710b6f385e
branch: master
repository: mcplatform
topic: "Organization User Management Implementation Strategy"
tags: [implementation, strategy, user-management, organization, better-auth, dashboard]
status: complete
last_updated: 2025-08-25
last_updated_by: Claude
type: implementation_strategy
---

# Organization User Management Implementation Plan

## Overview

Implementation of comprehensive organization user management capabilities including member invitation via magic links, role management (owner/admin/member), user listing with search/filter/pagination, and secure user deletion with session revocation. This leverages the existing Better Auth organization plugin infrastructure.

## Current State Analysis

The platform has Better Auth configured with the organization plugin, database schemas for members and invitations, and working organization selection/creation flows. However, there's no UI for managing organization members, server actions for member operations aren't exposed, and there is no way to view/list/manage users for the organization - only MCP server users at `/dashboard/users`.

### Key Discoveries:
- Better Auth organization plugin already configured at `packages/dashboard/src/lib/auth/auth.ts:22-57`
- Organization tables exist in schema at `packages/database/src/auth-schema.ts:98-131`
- Current "Users" nav item shows MCP users, not org members at `/dashboard/users`
- Table component patterns established at `packages/dashboard/src/components/users-table.tsx`
- Server action patterns defined at `packages/dashboard/src/lib/orpc/actions/`

## What We're NOT Doing

- NOT modifying the existing MCP user management at `/dashboard/users`
- NOT implementing custom roles beyond owner/admin/member
- NOT adding audit trails or activity logs
- NOT implementing bulk operations or CSV import/export
- NOT adding user suspension (only hard deletion)
- NOT implementing team-based grouping
- NOT customizing invitation expiry from 48 hours default

## Implementation Approach

We'll add a new "Team" navigation item in the sidebar below the existing items, create comprehensive member management UI using established patterns, expose Better Auth's organization APIs through oRPC server actions, and implement both copyable link and email-based invitation flows.

## Phase 1: Navigation Setup & Base Infrastructure

### Overview
Establish the navigation structure and base routes for organization member management without breaking existing MCP user functionality.

### Changes Required:

#### 1. Sidebar Navigation Update
**File**: `packages/dashboard/src/components/app-sidebar.tsx`
**Changes**: Add new navigation item after Support Tickets

**Implementation Requirements:**
- Add "Team" navigation item with IconUsersGroup icon
- Position after Support Tickets in navMain array
- URL path: `/dashboard/team`
- Description: "Manage your organization members and invitations"
- Maintain existing "Users" item for MCP users unchanged

#### 2. Create Team Routes Structure
**Files**: 
- `packages/dashboard/src/app/dashboard/team/layout.tsx`
- `packages/dashboard/src/app/dashboard/team/page.tsx`
- `packages/dashboard/src/app/dashboard/team/loading.tsx`

**Implementation Requirements:**
- Layout with consistent dashboard styling
- Server component pattern with async data fetching
- Loading states using Suspense boundaries
- Error boundary for graceful error handling
- Redirect to members list as default view

#### 3. Organization Member Server Actions
**File**: `packages/dashboard/src/lib/orpc/actions/organization.ts`

**Implementation Requirements:**
- Create new actions file for organization operations
- Implement `getOrganizationMembersAction` - fetch members with pagination
- Implement `getOrganizationInvitationsAction` - fetch pending invitations
- Follow existing oRPC patterns with requireSession and organization scoping
- Use proper TypeScript types from Better Auth
- Include proper error handling with typed errors

### Success Criteria:

**Automated verification**
- [ ] `bun lint` passes with no errors
- [ ] TypeScript compilation succeeds

**Manual Verification**
- [ ] New "Team" navigation item appears in sidebar
- [ ] Clicking navigates to `/dashboard/team` without errors
- [ ] Page loads with proper authentication checks
- [ ] Redirects to login if not authenticated
- [ ] Shows organization context requirement if missing

## Phase 2: Member Display & Role Management

### Overview
Implement the core member listing table with search, filter, pagination, and role editing capabilities.

### Changes Required:

#### 1. Organization Members Table Component
**File**: `packages/dashboard/src/components/organization-members-table.tsx`

**Implementation Requirements:**
- Client component with 'use client' directive
- TanStack Table with shadcn/ui components
- Columns: Avatar, Name, Email, Role (badge), Status, Joined Date, Actions
- Search by name/email using column filters
- Role filter dropdown (owner/admin/member)
- Pagination with page size selector
- Sort by name, email, or joined date
- Use existing `user-avatar.tsx` component for avatars
- Actions dropdown with Edit Role and Remove options

#### 2. Member Management Page
**File**: `packages/dashboard/src/app/dashboard/team/members/page.tsx`

**Implementation Requirements:**
- Async server component fetching member data
- Pass promise to client component using React 19 pattern
- Include member count in page header
- Add "Invite Member" button linking to invitations
- Wrap table in Suspense with skeleton loader
- Handle empty state with invitation prompt

#### 3. Role Update Server Action
**File**: `packages/dashboard/src/lib/orpc/actions/organization.ts`

**Implementation Requirements:**
- Add `updateMemberRoleAction` using Better Auth API
- Validate user has permission (owner/admin only)
- Prevent demotion of last owner
- Check organization context matches
- Call `auth.api.updateMemberRole()` 
- Revalidate `/dashboard/team/members` path
- Return updated member data

#### 4. Role Edit Dialog Component
**File**: `packages/dashboard/src/components/edit-member-role-dialog.tsx`

**Implementation Requirements:**
- Dialog with form for role selection
- Radio group for owner/admin/member selection
- Show current role as default
- Explain each role's permissions
- Confirmation for owner role changes
- Success toast on completion
- Error handling with user feedback

### Success Criteria:

**Automated verification**
- [ ] `bun lint` passes with no errors
- [ ] TypeScript compilation succeeds

**Manual Verification**
- [ ] Members table displays all organization members correctly
- [ ] Search filters work for name and email
- [ ] Role filter shows/hides members appropriately
- [ ] Pagination controls work correctly
- [ ] Role changes persist and update immediately
- [ ] Cannot demote the last owner/admin
- [ ] Error messages display for unauthorized actions

## Phase 3: Invitation System

### Overview
Implement the invitation sending, listing, and management functionality with both email and copyable link support.

### Changes Required:

#### 1. Invitation Server Actions
**File**: `packages/dashboard/src/lib/orpc/actions/organization.ts`

**Implementation Requirements:**
- Add `inviteUserToOrganizationAction` with email and role inputs
- Add `resendInvitationAction` for expired invitations
- Add `cancelInvitationAction` for pending invitations
- Implement email sending via Better Auth's sendInvitationEmail
- Generate copyable invitation links
- Handle duplicate invitation cases
- Validate email format and role selection

#### 2. Invitations Management Page
**File**: `packages/dashboard/src/app/dashboard/team/invitations/page.tsx`

**Implementation Requirements:**
- Server component fetching pending invitations
- Display invitation table with email, role, inviter, expiry, actions
- Show expired vs active status with badges
- Resend and cancel action buttons
- Empty state with invite prompt
- Link to invitation form

#### 3. Invite Member Dialog
**File**: `packages/dashboard/src/components/invite-member-dialog.tsx`

**Implementation Requirements:**
- Form with email input and role selector
- Option to send email or copy link
- Multiple email support (comma-separated)
- Show invitation link after creation
- Copy to clipboard functionality
- Success feedback with next steps
- Duplicate email detection and messaging

#### 4. Email Template Configuration
**File**: `packages/dashboard/src/lib/auth/auth.ts`

**Implementation Requirements:**
- Configure sendInvitationEmail function
- Create invitation email template
- Include organization name and inviter info
- Generate secure invitation URLs
- Fallback to copyable links if email fails
- Log email sending for debugging

#### 5. Invitation Acceptance Flow
**File**: `packages/dashboard/src/app/accept-invitation/[invitationId]/page.tsx`

**Implementation Requirements:**
- Public route for invitation acceptance
- Validate invitation ID and expiry
- Show organization and inviter information
- Require login/signup before acceptance
- Call Better Auth acceptInvitation API
- Redirect to dashboard after acceptance
- Handle expired/invalid invitations gracefully

### Success Criteria:

**Automated verification**
- [ ] `bun lint` passes with no errors
- [ ] TypeScript compilation succeeds

**Manual Verification**
- [ ] Can send invitations with email or copy link
- [ ] Invitations appear in pending list
- [ ] Expired invitations show correct status
- [ ] Resend creates new expiry time
- [ ] Cancel removes invitation immediately
- [ ] Acceptance flow works for new and existing users
- [ ] New members appear in members list after acceptance

## Phase 4: Member Deletion & Session Management

### Overview
Implement secure member removal with immediate session revocation and proper permission checks.

### Changes Required:

#### 1. Delete Member Server Action
**File**: `packages/dashboard/src/lib/orpc/actions/organization.ts`

**Implementation Requirements:**
- Add `removeMemberFromOrganizationAction`
- Verify user has admin/owner role
- Prevent removal of last owner
- Call Better Auth removeMember API
- Revoke all active sessions for removed user
- Handle self-removal case appropriately
- Log deletion for debugging

#### 2. Delete Confirmation Dialog
**File**: `packages/dashboard/src/components/delete-member-dialog.tsx`

**Implementation Requirements:**
- Warning dialog with member information
- Explain consequences (immediate access loss)
- Require typing member email to confirm
- Show different message for self-deletion
- Loading state during deletion
- Success/error toast feedback
- Auto-close on completion

#### 3. Session Revocation Logic
**File**: `packages/dashboard/src/lib/orpc/actions/organization.ts`

**Implementation Requirements:**
- Query all sessions for removed user
- Delete sessions from database
- Clear any cached session data
- Ensure immediate effect
- Handle database transaction properly

#### 4. Leave Organization Feature
**File**: `packages/dashboard/src/components/leave-organization-button.tsx`

**Implementation Requirements:**
- Button in user's own member row
- Confirmation dialog for leaving
- Warning about data access loss
- Call Better Auth leave API
- Redirect to organization selection
- Prevent last owner from leaving

### Success Criteria:

**Automated verification**
- [ ] `bun lint` passes with no errors
- [ ] TypeScript compilation succeeds

**Manual Verification**
- [ ] Can remove members with proper permissions
- [ ] Cannot remove last owner/admin
- [ ] Removed users lose access immediately
- [ ] Sessions are revoked successfully
- [ ] Self-removal redirects appropriately
- [ ] Error messages for unauthorized attempts
- [ ] Confirmation dialogs prevent accidents

## Performance Considerations
- Implement virtual scrolling if organizations have >100 members
- Cache member lists with SWR or React Query for instant navigation
- Debounce search inputs to reduce database queries
- Use database indexes on email and organizationId columns
- Implement pagination server-side to limit data transfer

## Migration Notes
- No database migrations needed (schemas already exist)
- Existing organizations will start with current members visible
- No data migration required for the invitation system
- Sessions remain valid until explicitly revoked

## References 
* Original requirements: `specifications/04-user-management/feature.md`
* Authentication research: `specifications/04-user-management/research/research_2025-08-25_15-58-23_auth-implementation.md`
* Better Auth docs: `specifications/04-user-management/thoughts/better_auth_organization_with_invite.md`
* Existing table pattern: `packages/dashboard/src/components/users-table.tsx`
* Server action patterns: `packages/dashboard/src/lib/orpc/actions/support-tickets.ts`
* Organization plugin config: `packages/dashboard/src/lib/auth/auth.ts:22-57`