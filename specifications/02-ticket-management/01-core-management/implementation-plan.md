---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "Core Support Ticket Management Implementation Strategy"
tags: [implementation, strategy, support-tickets, phase-1, core-management]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
type: implementation_strategy
---

# Implementation Plan: Core Support Ticket Management (Phase 1)

## Overview
Transform the support ticket system from a read-only interface to a fully interactive management platform with activity tracking, status management, rich text comments, and assignment capabilities.

## Strategy

### Phase 1: Database Schema (Foundation)
- Add new tables for activity tracking and enhanced ticket management
- Extend existing support_requests table with new fields
- Ensure proper foreign key relationships and indexing

### Phase 2: Backend Infrastructure (API Layer)
- Create oRPC actions for ticket management operations
- Implement activity tracking system
- Build assignment and status management functionality

### Phase 3: Rich Text Editor Integration (Core UX)
- Integrate shadcn-editor for markdown/rich text support
- Create reusable comment components
- Implement preview and editing modes

### Phase 4: Frontend Components (Interactive UI)
- Build activity stream component
- Create status management interface
- Implement ticket field editing capabilities
- Add assignment widget

### Phase 5: Testing & Polish (Validation)
- Test with Puppeteer across different scenarios
- Verify all CRUD operations work correctly
- Ensure proper error handling and loading states

## Technical Architecture

### Database Schema Changes
**Note: All schema changes will be made by updating Drizzle ORM TypeScript schemas, then requesting migration generation and execution.**

New tables and fields needed:
- `support_ticket_activities` table with activity tracking
- Add `assignee_id` and `priority` columns to existing `support_requests` table
- Proper foreign key relationships and indexes
- Activity type enum for PostgreSQL

### oRPC Actions Structure
```typescript
// Status management
updateSupportTicketStatus(ticketId, newStatus, comment?)
addSupportTicketComment(ticketId, content, contentType?)
updateSupportTicketFields(ticketId, { title?, conciseSummary?, priority? })
assignSupportTicket(ticketId, assigneeId?)

// Activity queries  
getSupportTicketActivities(ticketId) -> Activity[]
```

### Component Hierarchy
```
SupportTicketDetailsPage (Server Component)
    SupportTicketHeader (status, assignment, basic info)
    SupportTicketContent (editable title, description)
    SupportTicketActivityStream (Client Component)
        ActivityItem (individual activity entries)
        SupportTicketCommentForm (shadcn-editor)    
    SupportTicketActions (quick action toolbar)
```

## Implementation Checklist

### Prerequisites
- [x] Research current implementation and requirements analysis
- [x] shadcn-editor installed and available in project

### � Phase 1: Database Schema (Foundation)

#### Database Schema Updates
- [x] **1.1** Update `packages/database/src/schema.ts` to add `support_ticket_activities` table
- [x] **1.2** Update `packages/database/src/schema.ts` to add `assignee_id` and `priority` columns to `support_requests`
- [x] **1.3** Add proper indexes and foreign key relationships in schema definitions
- [x] **1.4** Add activity type enum to schema file
- [x] **1.5** Request migration generation: **Ask user to run `cd packages/database && bun run db:generate`**
- [x] **1.6** Request migration execution: **Ask user to run `cd packages/database && bun run db:migrate`**
- [x] **1.7** Create data migration script for seeding initial activities (if needed)

### ✅ Phase 2: Backend Infrastructure (API Layer)

#### oRPC Actions Development
- [x] **2.1** Create `updateSupportTicketStatus` action with optional comment
- [x] **2.2** Create `addSupportTicketComment` action with rich text support
- [x] **2.3** Create `updateSupportTicketFields` action for title/description editing
- [x] **2.4** Create `assignSupportTicket` action for assignment management
- [x] **2.5** Create `getSupportTicketActivities` query with user join

#### Activity Tracking System
- [x] **2.6** Implement activity creation helper function
- [x] **2.7** Add activity tracking to all ticket mutations
- [x] **2.8** Create system activity entries for ticket creation/status changes
- [x] **2.9** Add proper error handling and validation for all actions

### ✅ Phase 3: Rich Text Editor Integration (Core UX)

#### shadcn-editor Setup
- [x] **3.1** Create reusable `RichTextEditor` component wrapper
- [x] **3.2** Configure editor plugins (toolbar, markdown, code blocks)
- [x] **3.3** Create `RichTextRenderer` component for displaying content (MarkdownRenderer)
- [x] **3.4** Implement markdown mode toggle and preview functionality
- [x] **3.5** Add character limit and validation for comments

#### Comment System
- [x] **3.6** Build `SupportTicketCommentForm` with shadcn-editor (CommentForm)
- [x] **3.7** Implement comment submission with optimistic updates
- [ ] **3.8** Add comment draft auto-save functionality
- [ ] **3.9** Create keyboard shortcuts for common actions (Cmd+Enter to submit)

### ✅ Phase 4: Frontend Components (Interactive UI)

#### Enhanced Ticket Details Page
- [x] **4.1** Update ticket details page layout to accommodate activity stream
- [x] **4.2** Add Suspense boundaries for activity stream data
- [x] **4.3** Implement error boundaries for graceful error handling

#### Status Management Interface
- [x] **4.4** Create `SupportTicketStatusEditor` dropdown component (StatusManager)
- [x] **4.5** Add status change confirmation for critical transitions
- [x] **4.6** Implement combined status change + comment modal
- [x] **4.7** Add visual feedback for status changes (colors, icons)

#### Activity Stream Component
- [x] **4.8** Build `SupportTicketActivityStream` with timeline layout (ActivityStream)
- [x] **4.9** Create `ActivityItem` component for different activity types
- [ ] **4.10** Implement activity pagination for performance
- [ ] **4.11** Add activity filtering (comments only, status changes, etc.)

#### Field Editing Components
- [x] **4.12** Create `EditableTitle` component with inline editing
- [x] **4.13** Create `EditableDescription` component with rich text editing
- [x] **4.14** Add auto-save functionality for field edits
- [x] **4.15** Implement proper validation and error display

#### Assignment Widget
- [x] **4.16** Build `SupportTicketAssignmentWidget` with user dropdown (AssignmentWidget)
- [x] **4.17** Fetch organization members for assignment options
- [x] **4.18** Add assignment activity tracking
- [x] **4.19** Show assignee avatar and name in ticket header

### � Phase 5: Testing & Polish (Validation)

#### Puppeteer Testing
- [ ] **5.1** Test status changes and verify activity stream updates
- [ ] **5.2** Test rich text comment creation and rendering
- [ ] **5.3** Test ticket field editing and auto-save
- [ ] **5.4** Test assignment workflow and notifications
- [ ] **5.5** Test error scenarios and recovery

#### Performance & UX
- [ ] **5.6** Optimize activity stream queries and rendering
- [ ] **5.7** Add loading skeletons for better perceived performance
- [ ] **5.8** Test with large activity histories
- [ ] **5.9** Verify mobile responsiveness
- [ ] **5.10** Implement proper focus management and accessibility

#### Security & Validation
- [ ] **5.11** Verify organization isolation for all operations
- [ ] **5.12** Test permission boundaries (who can edit/assign/comment)
- [ ] **5.13** Validate rich text content sanitization
- [ ] **5.14** Test rate limiting and abuse prevention

## Key Design Decisions

### Database Schema Workflow
- **Decision**: Use Drizzle ORM TypeScript schemas, never write raw SQL
- **Process**: Update schema files → request `bun run db:generate` → request `bun run db:migrate`
- **Rationale**: Maintains type safety, prevents schema drift, follows project conventions

### Rich Text Content Storage
- **Decision**: Store shadcn-editor content as JSON in `content` field
- **Rationale**: Preserves full formatting, allows for rich rendering and editing
- **Alternative**: Could store as HTML/markdown, but loses editor state

### Activity Stream Architecture
- **Decision**: Single `support_ticket_activities` table for all activity types
- **Rationale**: Simplifies queries, easier to maintain chronological order
- **Alternative**: Separate tables per activity type (more complex joins)

### Status Management UX
- **Decision**: Inline dropdown with optional comment modal
- **Rationale**: Efficient for quick status changes, allows for context when needed
- **Alternative**: Always require comment (more friction but better tracking)

### Assignment System
- **Decision**: Optional assignee with organization-scoped user selection
- **Rationale**: Flexible for different team structures, respects org boundaries
- **Alternative**: Required assignment (may not fit all workflows)

## Success Criteria

### Functional Requirements
1.  **Activity Stream**: All ticket activities display chronologically with rich formatting
2.  **Status Management**: Users can change ticket status with optional comments
3.  **Rich Comments**: Full markdown/rich text commenting with shadcn-editor
4.  **Field Editing**: Inline editing for title, description, and priority
5.  **Assignment**: Assign tickets to organization members with activity tracking

### Performance Requirements
- Activity stream loads in <2 seconds for tickets with 100+ activities
- Comment submission provides immediate optimistic feedback
- Field editing auto-saves within 3 seconds of last edit
- Page remains responsive during all operations

### Security Requirements
- All operations respect organization boundaries
- Rich text content is properly sanitized
- Activity history is immutable (no editing/deletion)
- User permissions are enforced consistently

## Notes & Decisions Log

### 2025-01-21 - Initial Planning
- Decided to use shadcn-editor for rich text functionality
- Will maintain existing React 19 promise patterns for consistency
- Activity stream will be paginated from the start to handle scale
- Status changes will support both quick dropdown and detailed modal workflows

---

**Status**: All core phases completed! Support ticket management system is fully functional with activity tracking, rich text comments, field editing, and assignment capabilities.

**Additional Features Implemented**:
- Comment editing and deletion with proper authorization
- Edit comment dialog with Lexical markdown editor 
- Three-dot dropdown menus for comment actions
- Comment containerization to fix UI overflow issues
- Proper server/client component boundary handling
- Enhanced activity stream with user information display