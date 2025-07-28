---
date: 2025-07-28T15:48:41-05:00
researcher: Claude
git_commit: 4baac7b0155383f61a96c78379178be789dc2a44
branch: master
repository: mcplatform
topic: "Requirements for Walkthrough Authoring & Management UI"
tags: [requirements, specification, walkthrough-authoring, ui, content-management]
status: complete
last_updated: 2025-07-28T11:15:00-06:00
last_updated_by: Kyle
type: requirements
---

# Requirements for Walkthrough Authoring & Management UI

## Goal
Create a comprehensive dashboard interface that allows MCPlatform customers to create, edit, and manage interactive walkthroughs through a dedicated full-page editing environment. This system enables customers to author structured content using a four-field approach (introduction for agent, context for agent, content for user, operations for agent) with real-time preview capabilities and sophisticated step management.

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
The database schema is already implemented in `packages/database/src/schema.ts` with:
- `walkthroughs` table for walkthrough metadata
- `walkthroughSteps` table with JSONB `contentFields` using versioned structure
- `walkthroughStepContentField` Zod schema defining the four-field content structure
- Support for walkthrough types: course, installer, troubleshooting, integration, quickstart
- Linked-list structure for step ordering via `nextStepId` and `displayOrder`

### Composition Pattern
Standard MCPlatform pattern with async server components for data fetching, client components for interactivity, and promises passed between them using React 19 `use()` hook with proper Suspense and ErrorBoundary wrapping.

### Data Model
The structured content model uses versioned JSONB with four distinct fields:
- `introductionForAgent`: Optional context about step objectives
- `contextForAgent`: Optional background information and search terms
- `contentForUser`: Required markdown content presented to users
- `operationsForAgent`: Optional specific actions for AI agents to perform

These fields will be used to render nunjucks XML+markdown templates through MCP tool calls at a later date. 
## User Stories

### Walkthrough Management & Creation
1. **Given** I am a MCPlatform customer, **when** I navigate to the dashboard, **then** I should see a "Walkthroughs" sidebar item **so that** I can access walkthrough management in a dedicated section separate from MCP servers.

2. **Given** I want to create a new walkthrough, **when** I click "Create Walkthrough", **then** I should be able to enter title, description, and select from five walkthrough types (📚 Course, ⚙️ Installer, 🔧 Troubleshooting, 🔗 Integration, ⚡ Quick Start) with descriptions and field requirements **so that** I can establish the basic structure and appropriate AI template behavior for my content.

3. **Given** I have multiple walkthroughs, **when** I access the walkthroughs page, **then** I should see a comprehensive data table with search, filter, and sorting capabilities **so that** I can efficiently manage and organize my content.

### Content Authoring & Editing  
4. **Given** I need to edit walkthrough content, **when** I select a walkthrough to edit, **then** I should access a full-page three-panel editor (navigator, content editor, preview) **so that** I have dedicated space for complex content creation without modal limitations.

5. **Given** I am authoring step content, **when** I edit a step, **then** I should work with four distinct structured fields (introduction for agent, context for agent, content for user, operations for agent) with type-aware validation based on my selected walkthrough type **so that** I can create AI-optimized instructional content with clear separation of concerns.

6. **Given** I am creating content, **when** I make changes in the editor, **then** I should see real-time preview showing both structured field view and final Nunjucks template output **so that** I can validate my content before publishing.

### Step Management & Organization
7. **Given** I need to manage walkthrough steps, **when** I use the steps navigator, **then** I should be able to add, edit, delete, and reorder steps with visual indicators for content completion **so that** I can build comprehensive walkthroughs and optimize learning flow.

8. **Given** I want to test my walkthrough, **when** I use the preview functionality, **then** I should see a full simulation that mimics the actual MCP tool experience with template compilation validation **so that** I can identify and fix issues before users encounter them.

### Publishing & State Management
9. **Given** I am working on walkthrough content, **when** I make changes, **then** I should have a save button that is always visible with text showing time since last save and maintain draft/published status control **so that** I can control when my content is saved and can manage publication workflow effectively.

## Requirements

### Functional Requirements

#### Navigation and Access
- Add "Walkthroughs" as a top-level sidebar item in the dashboard navigation
- Implement main walkthroughs management page at `/dashboard/walkthroughs`
- Provide clear breadcrumb navigation from main dashboard to walkthrough editing

#### Walkthrough Management Interface
- Display comprehensive data table with columns: Title (clickable), Type (with icons), Description (truncated with tooltip), Steps count, Created date, Status, Actions dropdown
- Implement search functionality filtering by title and description
- Support sorting on all table columns
- Provide bulk operations for multiple walkthrough selection and deletion
- Show appropriate empty state when no walkthroughs exist with call-to-action

#### Walkthrough Creation and Metadata
- Provide walkthrough creation form with fields: Title (required, max 100 chars), Description (optional, max 500 chars), Type selection (dropdown with 5 options), Status toggle (Draft/Published)
- Implement type selection with visual indicators and descriptions for each walkthrough type:
  - **📚 Course**: Educational content with progressive learning (Content for User required, all others optional)
  - **⚙️ Installer**: Step-by-step installation and setup (Content for User + Operations for Agent required)  
  - **🔧 Troubleshooting**: Problem diagnosis and resolution (Content for User + Context for Agent required)
  - **🔗 Integration**: Connecting with external tools and services (Content for User + Context for Agent + Operations for Agent required)
  - **⚡ Quick Start**: Fast-track setup and basic usage (Content for User required, all others optional)
- Validate title uniqueness within organization scope
- Route creation through `/dashboard/walkthroughs/new`

#### Full-Page Editor Interface
- Implement three-panel layout with resizable panels: Steps Navigator (300px), Content Editor (flexible), Preview Panel (400px)
- Provide fixed header section with walkthrough metadata (title, type badge, description, status, action buttons)
- Enable inline editing of walkthrough title and description with manual save functionality
- Include action buttons for preview walkthrough, publish/unpublish, and settings dropdown

#### Steps Navigator Panel
- Display ordered list of all steps with drag handles for reordering
- Show step completion indicators for each content field (visual icons for populated fields)
- Provide step-level actions (edit, duplicate, delete) on hover
- Implement "Add Step" functionality creating new steps at end of list
- Support step search/filtering for large walkthroughs

#### Structured Content Editor Panel
- Implement four distinct content sections as collapsible textarea fields:
  - Introduction for Agent (optional, collapsible)
  - Context for Agent (optional, collapsible) 
  - Content for User (required, always expanded, markdown support)
  - Operations for Agent (optional, collapsible, textarea for action lists)
- Show field requirement indicators based on walkthrough type
- Include contextual help and placeholder text for each section
- Support markdown editing with basic formatting for user content section

#### Preview Panel Functionality
- Implement tab-based preview modes: Edit (field view) and Preview (template output)
- Provide real-time preview updates as content is edited
- Include navigation controls (previous/next step) within preview
- Show template compilation errors and validation warnings
- Support preview of different walkthrough types with appropriate templates
- Use Nunjucks as the template engine for rendering preview output

#### Manual Save and State Management
- Provide always-visible save button with manual save functionality
- Show toast notifications for save success/error states
- Provide visual save state indicators (saved, error, unsaved changes)
- Support URL state management with query parameters for current step
- Handle offline scenarios with basic retry mechanisms
- Maintain editing state during navigation within the editor

#### Step Management Operations
- Support adding new steps with default titles and empty content
- Enable step duplication with content copying
- Implement step deletion with confirmation dialogs and cascade handling
- Manage linked-list structure updates automatically during step operations (steps are stored using a linked-list structure with nextStepId references)
- Prevent deletion of last remaining step

#### Validation and Error Handling
- Validate required fields based on walkthrough type (contentForUser always required)
- Sanitize markdown content to prevent security issues
- Provide clear error messages for failed operations
- Handle network errors gracefully with retry options

### Non-Functional Requirements


#### Security & Permissions
- All walkthrough operations must be scoped to the user's organization
- Validate user permissions for walkthrough creation, editing, and deletion
- Sanitize all markdown content to prevent XSS attacks

#### User Experience
- Provide consistent visual feedback for all user actions
- Ensure keyboard accessibility with proper tab navigation
- Support keyboard shortcut: Cmd/Ctrl+S for save


## Design Considerations

### Layout & UI
- Use full-page editor layout rather than modal-based editing for complex content creation
- Implement three-panel design with resizable panels and collapse functionality
- Provide visual hierarchy with clear section headers and content organization
- Use shadcn/ui components consistently with existing dashboard patterns
- Include walkthrough type-specific visual indicators (icons and color coding)


### State Management
- Maintain current workflow & step selection in URL parameters for direct linking and refresh persistence
- Store panel collapse preferences in local storage
- Use standard server-side state management without optimistic updates
- Templates should be defined in TypeScript for type safety and maintainability

## Success Criteria

### Core Functionality
- Customers can create, edit, and manage walkthroughs through dedicated dashboard interface
- Full-page editor provides efficient authoring environment for complex content
- Structured content creation works reliably with all four field types
- Real-time preview accurately reflects final template output
- Step management operations (add, edit, delete, reorder) function without data loss

### Technical Implementation
- All database operations properly scoped to organization boundaries
- Manual save functionality provides user control over content changes
- Template rendering system produces valid output for AI agent consumption

### Priority Levels

#### High Priority (Core MVP)
- Basic three-panel editor layout with navigator, editor, and preview
- Walkthrough and step CRUD operations
- Structured content editing with four-field system
- Manual save functionality with visual feedback
- Draft/published status management
- Basic preview capabilities with template rendering and feedback on errors

#### Medium Priority (Enhanced Experience)
- Type-specific templates defined in TypeScript
- Search and filtering capabilities for walkthrough management
- Comprehensive validation and error handling


#### Low Priority (Advanced Features)
- Drag-and-drop step reordering with visual feedback

#### Won't Do (Future Enhancements)
- Mobile and tablet responsive design (single panel collapse, touch support, swipe navigation)
- Auto-save functionality and optimistic updates (potential for bugs)
- Rate limiting for save operations (authentication handles abuse prevention)
- Performance requirements and optimizations
- Advanced keyboard shortcuts and accessibility features
- Collaborative editing indicators and conflict resolution
- Analytics integration for content usage tracking
- Advanced template validation and debugging tools