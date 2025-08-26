---
date: 2025-08-25T21:00:21-05:00
researcher: Claude
git_commit: 94ead03981f349eb668563406112a4710b6f385e
branch: master
repository: mcplatform
topic: "User Management Invitation Flow Fix Implementation"
tags: [implementation, user-management, invitations, authentication, better-auth]
status: complete
last_updated: 2025-08-25
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: User Management Invitation Flow Fix

## Task(s)
**COMPLETED**: Fixed the broken user invitation flow where invited users were redirected to organization selection instead of automatically joining the organization they were invited to.

**Root Problem Identified**: The login/register forms were hardcoding redirect URLs to `/dashboard` instead of respecting redirect query parameters, causing the invitation acceptance process to be bypassed entirely.

## Recent Changes

### Authentication Forms Updated
1. **LoginForm** (`packages/dashboard/src/components/login-form.tsx`):
   - Added `useSearchParams` to read `redirect` query parameter
   - Changed hardcoded `callbackURL: '/dashboard'` to use dynamic `redirectUrl`
   - Applied to both email/password and social login methods
   - Lines 15-16, 46, 66

2. **RegisterForm** (`packages/dashboard/src/components/register-form.tsx`):
   - Added `useSearchParams` to read `redirect` query parameter  
   - Changed hardcoded `callbackURL: '/dashboard'` and `router.push('/dashboard')` to use dynamic `redirectUrl`
   - Applied to both registration and social login methods
   - Lines 16-17, 33, 41, 46

3. **Page Updates** for Suspense:
   - Added `<Suspense>` boundaries to `/app/login/page.tsx` and `/app/signup/page.tsx`
   - Required because forms now use `useSearchParams` client-side hook
   - Lines 17-19 in both files

### Invitation Acceptance Enhanced
4. **acceptInvitationAction** (`packages/dashboard/src/lib/orpc/actions/organization.ts`):
   - Added automatic `auth.api.setActiveOrganization()` call after successful invitation acceptance
   - Sets the invited organization as the user's active organization context
   - Wrapped in try/catch to not fail invitation acceptance if setting active org fails
   - Lines 599-610

## Learnings

### Critical Flow Analysis
The invitation flow was completely broken due to authentication redirect behavior:

1. **Original Broken Flow**: User clicks invite → redirected to login with `?redirect=/accept-invitation/[id]` → login form ignores redirect parameter → user sent to `/dashboard` → `requireSession()` sees no `activeOrganizationId` → user redirected to `/organization/select` → **invitation never accepted**

2. **Fixed Flow**: User clicks invite → redirected to login with redirect parameter → login form respects redirect → user returns to invitation page → `acceptInvitationAction` called → user added to organization AND organization set as active → seamless dashboard access

### Better Auth Organization Plugin Behavior
- Better Auth's organization plugin requires explicit `setActiveOrganization()` calls to set session context
- The `activeOrganizationId` field in sessions is not automatically set when users are added to organizations
- Research revealed known issues with setting active organization post-invitation in the Better Auth community

### Key File Locations
- Invitation acceptance logic: `packages/dashboard/src/app/accept-invitation/[invitationId]/page.tsx`
- Organization selection flow: `packages/dashboard/src/app/organization/select/page.tsx`
- Session management: `packages/dashboard/src/lib/auth/auth.ts:86-94` (`requireSession` function)
- Organization actions: `packages/dashboard/src/lib/orpc/actions/organization.ts`

## Artifacts

### Updated Implementation Files
- `packages/dashboard/src/components/login-form.tsx`
- `packages/dashboard/src/components/register-form.tsx`
- `packages/dashboard/src/app/login/page.tsx`
- `packages/dashboard/src/app/signup/page.tsx`
- `packages/dashboard/src/lib/orpc/actions/organization.ts`

### Key Reference Files
- `packages/dashboard/src/app/accept-invitation/[invitationId]/page.tsx` - Invitation acceptance page
- `packages/dashboard/src/lib/auth/auth.ts` - Session management and organization requirements
- `packages/dashboard/src/app/organization/select/page.tsx` - Organization selection fallback

## Action Items & Next Steps

### Immediate Testing Required
1. **Test the complete invitation flow** using Puppeteer:
   - Create an organization and send an invitation
   - Log out and access the invitation link
   - Test both registration and login paths
   - Verify user lands directly in dashboard without organization selection

2. **Edge Case Testing**:
   - Test with expired invitations
   - Test with already-used invitations
   - Test with mismatched email addresses
   - Test social login redirect behavior

### Potential Enhancements
1. **Error Handling**: Consider more robust error handling if `setActiveOrganization` fails consistently
2. **UX Improvements**: The success page could show organization context more clearly
3. **Monitoring**: Add logging for invitation acceptance success/failure rates

## Other Notes

### Better Auth Integration
- The dual authentication system (platform auth vs MCP OAuth) is complex but well-architected
- VHost-based routing for MCP servers uses organization context from session
- Better Auth's `organization` plugin provides the multi-tenancy foundation but requires careful session management

### Codebase Patterns
- Server actions use oRPC with `.actionable({})` wrapper pattern
- All organization-scoped operations check `session.session.activeOrganizationId`
- Client components use `authClient.useSession()` and `authClient.useActiveOrganization()` hooks
- Consistent error handling with typed errors from `base` router

### Development Environment
- Dev server runs on port 3000 (never restart it)
- Uses Bun as package manager
- Database migrations require explicit permission
- Puppeteer testing configured with specific user data directory

The invitation flow should now work seamlessly end-to-end. Users accepting invitations will be automatically placed into the context of the organization they were invited to, eliminating the confusing organization selection step.