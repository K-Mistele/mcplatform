---
date: 2025-07-29T22:04:45-05:00
researcher: Kyle Mistele
git_commit: 848ed957fa3fbfc9efaa5013828416b9442e195a
branch: master
repository: mcplatform
topic: "Server Assignment UI Implementation Strategy"
tags: [implementation, strategy, walkthrough-assignment, mcp-servers]
status: in_progress
last_updated: 2025-07-30
last_updated_by: Claude
type: implementation_strategy
---

# Server Assignment UI Implementation Plan

## Overview

Implementation of the walkthrough assignment UI that allows customers to connect their centrally-managed walkthroughs to MCP servers. This feature provides a many-to-many relationship management interface with ordering and visibility controls, integrated into existing server detail pages and walkthrough management interfaces.

## Current State Analysis

The walkthrough authoring UI is complete, but assignment functionality is missing. Research revealed:
- No existing oRPC actions for managing the `mcpServerWalkthroughs` junction table
- The junction table schema exists but lacks `displayOrder` and `isEnabled` fields from requirements
- Server detail pages use card-based layouts, not tabs
- Multi-select component was recently added but not yet used
- Established patterns exist for drag-and-drop, organization scoping, and empty states

### Key Discoveries:
- Card-based grid layout at `/packages/dashboard/src/app/dashboard/mcp-servers/[serverId]/page.tsx:69`
- Junction table operations only in tests at `tests/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/tool-registration.test.ts`
- Multi-select component ready at `/packages/dashboard/src/components/ui/multi-select.tsx:109`
- @dnd-kit patterns established in `StepsNavigator` component
- Empty state patterns consistent across dashboard

## What We're NOT Doing

- Converting server detail pages to tab-based layout
- Building a custom multi-select component (using existing one)
- Implementing bulk operations across multiple servers
- Creating walkthrough content or step management features
- Adding analytics or reporting capabilities
- Implementing assignment templates or conditional logic

## Implementation Approach

Backend-first strategy to ensure testability at each phase. We'll update the database schema, create comprehensive oRPC actions with tests, then build the UI components that consume these actions. This allows incremental development with full test coverage before any UI work begins.

## Phase 1: Database Schema Updates

### Overview
Add missing fields to the `mcpServerWalkthroughs` junction table to support display ordering and enable/disable functionality.

### Changes Required:

#### 1. Database Schema Update
**File**: `packages/database/src/schema.ts`
**Changes**: Add displayOrder and isEnabled fields to mcpServerWalkthroughs table

**Implementation Requirements:**
- Add `displayOrder` field as integer with default value 0
- Add `isEnabled` field as boolean with default value true
- Create compound unique constraint on (mcpServerId, walkthroughId) to prevent duplicates
- Add index on displayOrder for efficient ordering queries
- Update type exports to include new fields

#### 2. Database Migration
**File**: New migration file in `packages/database/migrations/`
**Changes**: Generate and apply migration for schema changes

**Implementation Requirements:**
- Use Drizzle Kit to generate migration
- Set existing records' displayOrder based on creation order
- Set all existing records' isEnabled to true
- Test migration with existing data

### Success Criteria:

**Automated verification**
- [ ] `bun run db:generate` creates valid migration
- [ ] Migration applies successfully with `bun run db:migrate`
- [ ] Schema types updated in generated files

**Manual Verification**
- [ ] Existing junction records receive appropriate default values
- [ ] New fields appear in database schema
- [ ] No data loss during migration

## Phase 2: Backend oRPC Actions

### Overview
Create comprehensive oRPC actions for managing walkthrough-to-server assignments with proper organization scoping and validation.

### Changes Required:

#### 1. Assignment Management Actions
**File**: `packages/dashboard/src/lib/orpc/actions.ts`
**Changes**: Add new server actions for assignment operations

**Implementation Requirements:**
- `assignWalkthroughsToServerAction`: Bulk assign walkthroughs to a server
  - Input: serverId, array of walkthroughIds with optional displayOrder
  - Clear existing assignments and create new ones
  - Validate server and walkthrough ownership
  - Maintain display order sequence
- `updateWalkthroughAssignmentAction`: Update single assignment properties
  - Input: serverId, walkthroughId, optional displayOrder/isEnabled
  - Validate assignment exists and user has access
  - Update specified fields only
- `removeWalkthroughAssignmentAction`: Remove single assignment
  - Input: serverId, walkthroughId
  - Validate ownership before deletion
  - Reorder remaining assignments
- `reorderServerWalkthroughsAction`: Bulk reorder assignments
  - Input: serverId, array of walkthroughIds in new order
  - Update all displayOrder values in single transaction
  - Validate all walkthroughs belong to server
- `getServerWalkthroughsAction`: Read assignments for a server
  - Input: serverId
  - Return walkthroughs with assignment properties
  - Order by displayOrder ascending

#### 2. Error Handling
**File**: `packages/dashboard/src/lib/orpc/router.ts`
**Changes**: Add new error types if needed

**Implementation Requirements:**
- Use existing RESOURCE_NOT_FOUND for missing entities
- Use UNAUTHORIZED for cross-organization access
- Add DUPLICATE_ASSIGNMENT if needed
- Consistent error messages

### Success Criteria:

**Automated verification**
- [x] All actions have comprehensive test coverage
- [x] Organization scoping properly enforced
- [x] No linter errors

**Manual Verification**
- [x] Actions handle edge cases gracefully
- [x] Proper transaction handling for bulk operations
- [x] Performance acceptable with many assignments

## Phase 3: Backend Tests ✅

### Overview
Comprehensive test suite for all assignment operations following established patterns.

### Changes Required:

#### 1. oRPC Action Tests ✅
**File**: `packages/dashboard/tests/03-interactive-walkthrough/03-server-assignment-ui/orpc-actions.test.ts`
**Changes**: Create test suite for assignment actions

**Implementation Requirements:**
- Mock session with organization scoping
- Test success cases for all actions
- Test error cases (missing resources, cross-org access)
- Test bulk operations and edge cases
- Verify revalidatePath calls
- Resource cleanup in afterEach

#### 2. Integration Tests
**File**: `packages/dashboard/tests/03-interactive-walkthrough/03-server-assignment-ui/integration.test.ts`
**Changes**: Test complete assignment workflows

**Implementation Requirements:**
- Test assignment lifecycle (create, update, reorder, delete)
- Test cascade deletes when parent deleted
- Test concurrent operations
- Verify data integrity maintained
- Test with maximum realistic data volumes

### Success Criteria:

**Automated verification**
- [x] All tests pass with `bun test`
- [x] 100% coverage of new oRPC actions
- [x] No test flakiness

**Manual Verification**
- [x] Tests cover all user stories from requirements
- [x] Edge cases properly tested
- [x] Performance benchmarks acceptable

## Phase 4: UI Components 🔄

### Overview
Build the assignment interface components using the existing multi-select and established UI patterns.

### Changes Required:

#### 1. Walkthrough Assignment Card
**File**: `packages/dashboard/src/components/walkthrough-assignment-card.tsx`
**Changes**: Create main assignment interface card

**Implementation Requirements:**
- Card component with icon header following existing patterns
- Multi-select component for walkthrough selection
- List of assigned walkthroughs with drag-and-drop reordering
- Enable/disable switch for each walkthrough
- Empty state with UsersIcon when no assignments
- Delete confirmation dialog
- Loading states during operations
- Error handling with toast notifications

#### 2. Draggable Walkthrough List
**File**: `packages/dashboard/src/components/draggable-walkthrough-list.tsx`
**Changes**: Reorderable list component

**Implementation Requirements:**
- Use @dnd-kit following StepsNavigator patterns
- Display walkthrough title, type badge, step count
- Drag handles with hover states
- Enable/disable toggle switches
- Delete buttons with confirmation
- Optimistic updates during reordering
- Touch-friendly for mobile

#### 3. Server Detail Page Integration
**File**: `packages/dashboard/src/app/dashboard/mcp-servers/[serverId]/page.tsx`
**Changes**: Add assignment card to grid

#### 4. Multi-Select Component Tests ✅
**File**: `packages/dashboard/tests/ui-components/multi-select.test.ts`
**Changes**: Comprehensive test suite for multi-select component

**Implementation Completed:**
- 11 test suites covering all component functionality
- 40+ individual test cases
- Tests for basic functionality, selection behavior, badges, search
- Tests for keyboard navigation, animations, variants, edge cases
- Full coverage of props, configuration, and icon support

**Implementation Requirements:**
- Fetch walkthrough data in server component
- Pass promise to client component
- Add card to existing grid layout
- Maintain responsive grid behavior
- Follow established data fetching patterns

### Success Criteria:

**Automated verification**
- [x] No TypeScript errors
- [x] No linter errors
- [x] Components properly typed

**Manual Verification**
- [x] Assignment interface works smoothly
- [ ] Drag-and-drop functions on desktop and mobile
- [ ] Empty states display correctly
- [ ] Loading and error states handled

## Phase 5: Integration & Polish

### Overview
Complete the bidirectional assignment flow and ensure consistent UX across all touchpoints.

### Changes Required:

#### 1. Walkthrough Detail Integration
**File**: `packages/dashboard/src/app/dashboard/walkthroughs/[walkthroughId]/edit/page.tsx`
**Changes**: Add server assignment section

**Implementation Requirements:**
- Add dedicated "Server Assignments" section
- Reuse multi-select component for consistency
- Show assigned servers with enable/disable status
- Quick navigation to server detail pages
- Same empty state patterns

#### 2. UI Polish & Testing
**File**: Multiple component files
**Changes**: Final polish and edge case handling

**Implementation Requirements:**
- Consistent loading states
- Proper error boundaries
- Accessibility testing
- Mobile responsiveness verification
- Performance optimization for large lists

### Success Criteria:

**Automated verification**
- [ ] E2E tests pass
- [ ] No console errors or warnings

**Manual Verification**
- [ ] Feature works end-to-end as specified
- [ ] Consistent UX across all interfaces
- [ ] Performance acceptable with many walkthroughs
- [ ] Mobile experience smooth

## Performance Considerations
- Virtual scrolling for lists with >50 walkthroughs
- Debounced drag operations to prevent excessive updates
- Optimistic UI updates for immediate feedback
- Efficient queries using proper indexes

## Migration Notes
- Existing junction records will receive displayOrder based on creation timestamp
- All existing assignments will be enabled by default
- No breaking changes to existing functionality

## References 
* Original ticket: `specifications/03-interactive-walkthrough/03-server-assignment-ui/feature.md`
* Related implementation: `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/feature.md`
* Multi-select component: `/packages/dashboard/src/components/ui/multi-select.tsx:109`
* Server detail page: `/packages/dashboard/src/app/dashboard/mcp-servers/[serverId]/page.tsx:69`
* Drag-and-drop example: `/packages/dashboard/src/components/steps-navigator.tsx:183`