# Phase 1 Requirements: Core Support Ticket Management

## Goal
Enhance the support ticket management interface with basic editing capabilities, status management, and an activity stream for tracking ticket progress and communication.

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
The **support tickets list view** is implemented at `/dashboard/support-tickets` in `src/app/dashboard/support-tickets/page.tsx` and the **ticket details view** at `/dashboard/support-tickets/[ticketId]` in `src/app/dashboard/support-tickets/[ticketId]/page.tsx`.

### Composition Pattern
Unless otherwise specified, all data should be fetched at the top level of the page in the async server component, and passed down the component tree as promises where they can be `use()`'ed with `<Suspense>` and `<ErrorBoundary>`.

### Data Model
Information about the current data model can be found in `specification/02-ticket-management/research.md` or accessed directly from the database package at `packages/database/src/schema.ts`.

### Rich Text Editor
This phase will integrate **shadcn-editor** for all markdown/rich text editing functionality, providing a consistent, professional editing experience across all text inputs.

## User Stories

### Core Ticket Management
1. **Status Management**: When viewing a support ticket, I want to be able to change its status using a dropdown selector, so I can track ticket progress through the workflow.

2. **Activity Comments**: When viewing a support ticket, I want to add rich text/markdown-formatted comments to document my investigation, communication with users, or resolution steps.

3. **Combined Actions**: When changing a ticket's status, I want to optionally add a comment explaining the change (e.g., "Resolved - Fixed OAuth configuration issue"), so the activity history provides context for status changes.

4. **Activity Stream**: When viewing a support ticket, I want to see a chronological list of all activities (status changes, comments, system events) below the ticket details, so I can understand the full history of the ticket.

5. **Ticket Editing**: When viewing a support ticket, I want to edit the title and description fields to improve clarity or add additional context discovered during investigation.

6. **Assignment System**: I want to assign tickets to myself or other members of my organization, so ownership and responsibility are clear.

### User Experience
7. **Rich Text Editing**: When writing comments or editing ticket content, I want a rich text editor that supports markdown, formatting, and other features like code blocks and mentions.

8. **Auto-save**: When editing ticket fields or writing comments, I want my changes to be automatically saved as drafts to prevent data loss.

9. **Optimistic Updates**: When I perform actions like changing status or adding comments, I want to see the changes immediately while they're being saved in the background.

10. **Activity Filtering**: When viewing tickets with many activities, I want to filter the activity stream to show only specific types (comments, status changes, etc.) to focus on relevant information.

## Functional Requirements

### Activity Tracking System
- All ticket interactions must be logged in a comprehensive activity stream
- Activities include: comments, status changes, field updates, assignments, system events
- Each activity must be attributed to a specific user with timestamp
- Activity history must be immutable (no editing or deletion)

### Status Management
- Support all existing ticket statuses: needs_email, pending, in_progress, resolved, closed
- Status changes must create activity entries
- Option to add explanatory comments when changing status
- Visual indicators for status with appropriate colors and icons

### Rich Text Commenting
- Full markdown support with live preview
- Rich text editing using shadcn-editor
- Support for code blocks, formatting, and other editor features
- Character limits and validation for comment content

### Field Editing
- Inline editing for ticket title and description
- Auto-save functionality to preserve changes
- Validation and error handling for field updates
- Rich text support for description editing

### Assignment System
- Assign tickets to any member of the organization
- Visual display of assignee information (name, avatar)
- Assignment changes tracked in activity stream
- Unassign capability (set assignee to null)

### Priority Management
- Support priority levels: low, medium, high, critical
- Visual indicators for different priority levels
- Priority changes tracked in activity stream

## Non-Functional Requirements

### Performance
- Activity stream must load efficiently for tickets with 100+ activities
- Comment submission should provide immediate visual feedback
- Auto-save must occur within 3 seconds of last edit
- Page must remain responsive during all operations

### Security & Permissions
- All operations must respect organization boundaries
- Only organization members can interact with tickets
- Rich text content must be properly sanitized
- Activity attribution must be secure and immutable

### Accessibility
- Full keyboard navigation support
- Screen reader compatibility
- High contrast support
- Proper focus management

### Mobile Support
- Responsive design that works on mobile devices
- Touch-friendly interaction targets
- Readable text and appropriate sizing on small screens

## Design Considerations

### Activity Stream Layout
- Timeline design with clear visual hierarchy
- Icons for different activity types (comment, status change, assignment)
- Chronological ordering with newest activities first
- Compact design to efficiently use space
- Pagination for performance with large activity histories

### Rich Text Integration
- Consistent editor experience across all text inputs
- Markdown mode toggle for power users
- Preview capability before submitting
- Toolbar with common formatting options

### Status Management UX
- Color-coded status badges that are immediately recognizable
- Smooth transitions between view and edit modes
- Confirmation dialogs for critical status changes
- Quick status change buttons for common workflows

### Responsive Behavior
- Activity stream adapts to different screen sizes
- Rich text editor remains functional on mobile
- Collapsible sections for better mobile navigation

## Success Criteria

### User Adoption
- 100% of tickets have activity tracking enabled
- Support team actively uses status management features
- Comment adoption rate >80% of active tickets
- Assignment system used for ticket ownership

### Performance Metrics
- Average time to first response decreases by 25%
- Page load time remains <3 seconds with activity stream
- Comment submission feels instantaneous (<1 second perceived response time)

### Quality Metrics
- Activity history provides complete audit trail
- Zero data loss with auto-save functionality
- Rich text formatting preserved correctly
- All user interactions properly tracked and attributed

### Technical Metrics
- All database operations properly scoped to organizations
- Rich text content properly sanitized
- Error handling gracefully manages edge cases
- Mobile experience rated as fully functional