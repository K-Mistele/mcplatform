---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "Sub-Feature: Walkthrough Authoring & Management UI"
tags: [sub-feature-definition, interactive-walkthrough, authoring-ui, management]
status: complete
last_updated: 2025-07-28T15:32:54-05:00
last_updated_by: Claude
type: sub_feature_definition
---

# Sub-Feature: Walkthrough Authoring & Management UI

## Parent Feature
[Interactive Walkthrough Feature](../feature.md)

## Overview
This sub-feature delivers the dashboard UI that allows MCPlatform customers to create, edit, and manage their interactive walkthroughs. It provides a comprehensive authoring environment where content is written, structured, and published. This functionality will be housed in a new, dedicated "Walkthroughs" section within the main dashboard, establishing walkthroughs as independent entities that can be managed centrally and assigned to multiple MCP servers.

## Business Value
- **Content Independence**: Walkthroughs are created once and can be reused across multiple MCP servers
- **Centralized Management**: All walkthrough content managed in one place for operational efficiency
- **Structured Authoring Experience**: Four-field content structure with simple textarea editing and preview capabilities
- **Flexible Assignment**: Dynamic assignment and ordering of walkthroughs per server
- **Version Control**: Basic versioning system with publish/draft states
- **Analytics Integration**: Built-in tracking for walkthrough performance across servers

## User Stories

### Primary Users (MCPlatform Customers)
- As a customer, I want to create walkthroughs independently of my MCP servers so I can manage content efficiently
- As a customer, I want to edit walkthrough content using structured fields so I can create effective, AI-optimized guidance
- As a customer, I want to reorder steps easily so I can refine the learning flow
- As a customer, I want to preview my walkthrough so I can test the user experience before publishing
- As a customer, I want to assign the same walkthrough to multiple MCP servers so I can reuse content across different contexts
- As a customer, I want to control which walkthroughs appear on each server and in what order so I can tailor the experience per server
- As a customer, I want to temporarily disable a walkthrough on specific servers without deleting the assignment
- As a customer, I want to see analytics on walkthrough usage across all my servers so I can understand user behavior

## Detailed UI Specifications

### Navigation Structure

#### New Sidebar Item
Add "Walkthroughs" as a top-level sidebar item in the dashboard:

```
Dashboard
├── Overview
├── Servers
├── Walkthroughs  ← NEW
├── Support Tickets
└── Settings
```

### 1. Main Walkthroughs Management Page (`/dashboard/walkthroughs`)

#### Page Header
- **Title**: "Walkthroughs"
- **Description**: "Create and manage interactive guides for your users"
- **Action Button**: "Create Walkthrough" (primary button, top right)

#### Walkthroughs Data Table
A comprehensive data table with the following columns:
- **Title** (clickable, leads to detail page)
- **Type** (badge with icon: 📚 Course, ⚙️ Installer, 🔧 Troubleshooting, 🔗 Integration, ⚡ Quick Start)
- **Description** (truncated with tooltip for full text)
- **Steps** (count badge)
- **Assigned Servers** (count with hover tooltip showing server names)
- **Created** (relative time using `formatDistanceToNow`)
- **Status** (Published/Draft with colored badges)
- **Actions** (dropdown menu with: Edit, Duplicate, Assign to Servers, Delete)

#### Table Features
- **Search**: Filter by title and description
- **Sorting**: All columns sortable
- **Pagination**: Standard pagination for large lists
- **Bulk Actions**: Select multiple walkthroughs for bulk operations. Actions include:
  - delete
  - add to MCP Server

#### Empty State
If no walkthroughs exist:
- Centered illustration (consistent with existing empty states)
- **Primary Text**: "No walkthroughs yet"
- **Secondary Text**: "Create your first interactive walkthrough to guide users through your products"
- **CTA Button**: "Create Walkthrough"

### 2. Create/Edit Walkthrough Page

#### Page Specifications
**Triggered by**: "Create Walkthrough" button or Edit action from table

**Routes**: 
- Create: `/dashboard/walkthroughs/new`
- Edit: `/dashboard/walkthroughs/[id]/edit`

**Page Structure**:
- **Header**: Page breadcrumb and walkthrough metadata
- **Form Fields**:
  - **Title** (required, text input, max 100 characters)
  - **Description** (optional, textarea, max 500 characters, 3 rows)
  - **Type** (required, dropdown with: Course, Installer, Troubleshooting, Integration, Quick Start)
  - **Server Assignment** (optional multi-select using new MultiSelectWalkthroughs component)
  - **Publish Status** (toggle: Draft/Published)
- **Actions**: 
  - Cancel (secondary button, returns to walkthrough list)
  - Create/Save (primary button, disabled until title and type provided)

**Validation**:
- Title is required and must be unique within organization
- Description is optional but recommended
- Server assignment can be modified later

### 3. Walkthrough Detail/Editor Page (`/dashboard/walkthroughs/[walkthroughId]/edit`)

#### Full-Page Editor Layout
**Route**: `/dashboard/walkthroughs/[walkthroughId]/edit?step=[stepId]`
**Breadcrumb**: Dashboard > Walkthroughs > [Walkthrough Title]

#### Header Section (Fixed)
- **Walkthrough Title** (inline editable with auto-save)
- **Type Badge** (e.g., "📚 Course", "⚙️ Installer") with tooltip showing type description
- **Description** (inline editable textarea with auto-save)  
- **Server Assignments**: Compact badge list showing assigned servers with count
- **Action Buttons**:
  - "Preview Walkthrough" (full simulation preview)
  - "Publish Changes" (if unpublished changes exist)
  - "Assign to Servers" (opens server assignment interface)
  - "Settings" (dropdown with change type, version history, duplicate, delete)

#### Server Assignment Quick Access
Expandable section under header:
- **Multi-select component** for quick server assignment changes
- **Assigned servers list** with individual enable/disable toggles
- **Reorder interface** with drag handles for display order

#### Three-Panel Layout

**Left Panel (300px): Steps Navigator**
- **Header**: "Steps" with step count badge
- **Step List**: Ordered list of all steps
  - Step number/order indicator
  - Step title (truncated)
  - Content field completion indicators (💬 📝 🔧 ⚡)
  - Active step highlighted
- **Drag Handles**: For reordering steps
- **Add Step Button**: At bottom of list, creates new step at end
- **Step Actions**: Hover reveals duplicate/delete icons

**Center Panel (Flexible): Content Editor**
- **Step Header**:
  - Step title (editable input with auto-save)
  - Step number indicator
  - Delete step button (with confirmation)
- **Structured Content Sections**:
  - **Introduction for Agent** (collapsible textarea)
  - **Context for Agent** (collapsible textarea)
  - **Content for User** (always expanded textarea with markdown)
  - **Operations for Agent** (collapsible textarea)
- **Section Features**:
  - Character count indicators
  - Auto-save with visual feedback
  - Type-aware field requirements
  - Contextual help and placeholders

**Right Panel (400px): Preview Panel**
- **Preview Modes**: 
  - Edit (simple textareas for all fields)
  - Preview (rendered Nunjucks template output)
- **Navigation Controls**: Previous/Next step buttons
- **Template Validation**: Show compilation errors and warnings

#### Empty States
- **No Steps**: "This walkthrough doesn't have any steps yet. Click 'Add Step' to get started."
- **No Step Selected**: "Select a step from the navigator to start editing"

### 4. Server Assignment Enhancement

#### Enhanced MCP Server Detail Page
Add new "Walkthroughs" tab to existing server tabs:
```
[Configuration] [Users] [Sessions] [Walkthroughs] [Analytics]
```

#### Walkthroughs Tab Content
**Header Section**:
- **Title**: "Assigned Walkthroughs"
- **Description**: "Interactive guides available on this server"
- **Quick Stats**: Number of assigned walkthroughs, total user engagements

**Assignment Interface**:
- **Multi-Select Component**: For attaching/detaching walkthroughs
  - Placeholder: "Select walkthroughs to assign..."
  - Search functionality
  - Custom badge display showing walkthrough title + step count
  - Animation: Smooth bounce effect for selections

**Assigned Walkthroughs List**:
- **Sortable List**: Drag-and-drop reordering (affects `displayOrder`)
- **Per-Walkthrough Controls**:
  - Enable/Disable toggle
  - Display order indicator
  - Quick actions: View, Edit, Remove assignment
- **Empty State**: "No walkthroughs assigned. Use the selector above to assign walkthroughs to this server."

### 5. Walkthrough Simulation Preview

#### Full Simulation Preview
**Triggered by**: "Preview Walkthrough" button from editor header

**Full-Screen Interface**:
- **Simulated MCP Environment**: Mimics actual MCP tool interface
- **Navigation Controls**:
  - Previous/Next step buttons
  - Step counter: "Step 2 of 5"
  - Progress bar showing completion percentage
- **Content Display**:
  - Rendered template content as seen by AI agent
  - Simulated user experience
- **Controls**:
  - "Exit Preview" button
  - "Edit This Step" shortcut button
  - "Return to Editor" navigation

### 6. Step Management

#### Adding Steps
1. Click "Add Step" in navigator
2. New step appears at end of list with default title "New Step"
3. Auto-focus on title field
4. Empty markdown editor ready for content

#### Reordering Steps
- **Drag and Drop**: Visual feedback during drag operation
- **Live Updates**: Order changes reflected immediately
- **Linked List Updates**: Backend updates `nextStepId` references automatically

#### Deleting Steps
- **Confirmation Dialog**: "Delete this step? This action cannot be undone."
- **Cascade Updates**: Automatically fixes linked list references
- **Validation**: Prevent deletion of last step

## Component Architecture

### New Components to Build

#### MultiSelectWalkthroughs Component
Based on shadcn-multi-select-component pattern:

```typescript
interface MultiSelectWalkthroughsProps {
  availableWalkthroughs: Array<{
    id: string;
    title: string;
    stepCount: number;
    description?: string;
  }>;
  selectedWalkthroughs: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  placeholder?: string;
  maxCount?: number;
  searchable?: boolean;
  animation?: "none" | "bounce" | "fade";
  disabled?: boolean;
}
```

**Features**:
- Popover-based dropdown with search
- Custom badge display (title + step count)
- Keyboard navigation support
- Select all/clear all options
- Responsive design for mobile

#### DraggableWalkthroughList Component
For managing walkthrough order on servers:

```typescript
interface DraggableWalkthroughListProps {
  walkthroughs: Array<{
    id: string;
    title: string;
    stepCount: number;
    displayOrder: number;
    isEnabled: boolean;
  }>;
  onReorder: (newOrder: string[]) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onRemove: (id: string) => void;
}
```

#### StepContentEditor Component
Full-featured structured content editor with:
- Four collapsible sections with shadcn/ui textareas for content fields
- Type-aware field requirements (required/optional based on walkthrough type)
- Real-time preview in adjacent panel
- Auto-save with debouncing and visual feedback
- Field validation and character limits
- Contextual help and placeholders
- Type-specific content suggestions and examples
- Content field completion indicators

#### StepsNavigator Component
Sidebar navigation for steps:
- Draggable step reordering
- Visual feedback for active step
- Step status indicators
- Add/delete step actions
- Responsive collapse on mobile

### Existing Components to Leverage
- `DataTable` for walkthrough lists
- `Card` for overview sections
- `Dialog` for confirmations and settings
- `Tabs` for navigation
- `Button`, `Input`, `Textarea` for forms
- `Badge` for status indicators
- `DropdownMenu` for actions
- `Alert` for confirmations
- `Separator` for visual organization

## oRPC Server Actions

### Walkthrough Management Actions

```typescript
// Create new walkthrough
export const createWalkthrough = base
  .input(z.object({
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
    isPublished: z.boolean().default(false),
    serverIds: z.array(z.string()).optional() // Initial server assignments
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Create walkthrough with proper organization scoping
    // Handle initial server assignments if provided
    revalidatePath('/dashboard/walkthroughs')
  })
  .actionable({})

// Update walkthrough metadata
export const updateWalkthrough = base
  .input(z.object({
    id: z.string(),
    title: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']).optional(),
    isPublished: z.boolean().optional()
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Update walkthrough with organization scoping validation
    revalidatePath('/dashboard/walkthroughs')
    revalidatePath(`/dashboard/walkthroughs/${input.id}`)
  })
  .actionable({})

// Delete walkthrough
export const deleteWalkthrough = base
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Cascade delete steps and assignments
    revalidatePath('/dashboard/walkthroughs')
  })
  .actionable({})
```

### Step Management Actions

```typescript
// Create new step
export const createWalkthroughStep = base
  .input(z.object({
    walkthroughId: z.string(),
    title: z.string().min(1),
    content: z.string(),
    insertAfterStepId: z.string().optional() // For insertion ordering
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Create step and update linked list references
    revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
  })
  .actionable({})

// Update step
export const updateWalkthroughStep = base
  .input(z.object({
    id: z.string(),
    title: z.string().optional(),
    content: z.string().optional()
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Update step with organization scoping validation
    revalidatePath(`/dashboard/walkthroughs/${walkthroughId}`)
  })
  .actionable({})

// Reorder steps
export const reorderWalkthroughSteps = base
  .input(z.object({
    walkthroughId: z.string(),
    stepIds: z.array(z.string()) // New order
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Update linked list structure based on new order
    revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
  })
  .actionable({})

// Delete step
export const deleteWalkthroughStep = base
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Delete step and fix linked list references
    revalidatePath(`/dashboard/walkthroughs/${walkthroughId}`)
  })
  .actionable({})
```

### Server Assignment Actions

```typescript
// Assign walkthrough to servers
export const assignWalkthroughToServers = base
  .input(z.object({
    walkthroughId: z.string(),
    serverIds: z.array(z.string()),
    displayOrder: z.number().optional(),
    isEnabled: z.boolean().default(true)
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Create server-walkthrough assignments
    revalidatePath('/dashboard/walkthroughs')
    revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
    // Revalidate server pages
    input.serverIds.forEach(serverId => {
      revalidatePath(`/dashboard/servers/${serverId}`)
    })
  })
  .actionable({})

// Update server assignment
export const updateWalkthroughAssignment = base
  .input(z.object({
    walkthroughId: z.string(),
    serverId: z.string(),
    displayOrder: z.number().optional(),
    isEnabled: z.boolean().optional()
  }))
  .handler(async ({ input, errors }) => {
    const session = await requireSession()
    // Update assignment properties
    revalidatePath(`/dashboard/servers/${input.serverId}`)
    revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
  })
  .actionable({})
```

## Auto-Save and Validation Patterns

### Auto-Save Implementation
- **Debounced Saves**: 2-second delay after last keystroke
- **Visual Indicators**: "Saving...", "Saved", "Error" states
- **Error Handling**: Retry mechanism with exponential backoff
- **Conflict Resolution**: Simple last-write-wins for MVP
- **Offline Support**: Basic queue for reconnection

### Validation Patterns
- **Client-Side**: Real-time validation with immediate feedback
- **Server-Side**: Comprehensive validation in oRPC actions
- **Content Sanitization**: Sanitize markdown content to prevent XSS
- **Length Limits**: Enforce character limits with visual indicators
- **Unique Constraints**: Check title uniqueness within organization

## Responsive Design Considerations

### Mobile Layout (< 768px)
- **Single Column**: Steps navigator becomes collapsible overlay
- **Touch-Friendly**: Larger touch targets for drag handles
- **Simplified Toolbar**: Essential formatting options only
- **Modal Optimization**: Full-screen modals on small screens

### Tablet Layout (768px - 1024px)
- **Flexible Layout**: Navigator can collapse to provide more editor space
- **Touch Support**: Drag-and-drop optimized for touch
- **Compact Headers**: Reduced header size to maximize content area

### Desktop Layout (> 1024px)
- **Full Feature Set**: All functionality available
- **Multi-Monitor Support**: Proper handling of window sizing
- **Keyboard Shortcuts**: Full keyboard navigation support

## Performance Optimizations

### Data Loading
- **Lazy Loading**: Steps loaded on-demand when selected
- **Virtual Scrolling**: For large step lists
- **Caching**: Client-side caching of walkthrough metadata
- **Prefetching**: Preload next/previous steps

### Editor Performance
- **Code Splitting**: Lazy load markdown editor
- **Debounced Operations**: Auto-save, search, validation
- **Optimistic Updates**: Immediate UI updates with rollback on error
- **Memory Management**: Proper cleanup of editor instances

## Security and Validation

### Authorization
- **Organization Scoping**: All operations properly scoped
- **Permission Checks**: Validate user can access walkthroughs
- **Resource Ownership**: Ensure users only access their organization's content

### Content Security
- **Markdown Sanitization**: Prevent XSS through markdown
- **Input Validation**: Server-side validation of all inputs
- **Rate Limiting**: Prevent abuse of auto-save functionality
- **Content-Type Validation**: Ensure only markdown content

## Testing Strategy

### Unit Tests
- **Component Testing**: All new UI components
- **Hook Testing**: Custom hooks for auto-save, validation
- **Utility Testing**: Markdown processing, validation functions

### Integration Tests
- **Flow Testing**: Complete walkthrough creation flow
- **Server Action Testing**: All oRPC actions
- **Assignment Testing**: Server-walkthrough relationship management

### E2E Tests
- **User Journey Testing**: Complete authoring workflows
- **Cross-Browser Testing**: Ensure editor works across browsers
- **Mobile Testing**: Touch interactions and responsive behavior

## Analytics and Monitoring

### Usage Analytics
- **Creation Metrics**: Track walkthrough creation rates
- **Editing Patterns**: Most used features, time spent editing
- **Assignment Analytics**: Server assignment patterns
- **Performance Metrics**: Editor load times, save success rates

### Error Monitoring
- **Auto-Save Failures**: Track and alert on save errors
- **Editor Crashes**: Monitor editor stability
- **Validation Errors**: Track common validation failures

## Implementation Considerations

### Core Requirements
- New "Walkthroughs" sidebar section
- Walkthrough list page with data table
- Create/Edit walkthrough modal
- Walkthrough detail page with step management
- Structured content editor with four textarea fields
- Simple edit/preview toggle functionality
- All oRPC server actions for CRUD operations
- Auto-save functionality with visual feedback
- Step reordering with drag-and-drop
- Organization scoping and authorization
- Responsive design for mobile authoring

### Enhanced Features
- Server assignment interface with multi-select
- Enhanced MCP server detail page walkthrough tab
- Nunjucks template rendering system
- Content validation and character limits
- Comprehensive error handling and recovery
- Performance optimizations for large walkthroughs

### Advanced Capabilities
- Walkthrough analytics integration
- Content templates for common step types
- Bulk operations for walkthrough management
- Version management and rollback functionality
- Comprehensive testing coverage
- User documentation and onboarding

## Related Documents
- [UI Ideation](../thoughts/ui-ideation.md) - Detailed UI specifications and mockups
- [Technical Specification](../thoughts/technical-specification.md) - Database schema and architecture
- [Interactive Walkthrough Feature](../feature.md) - Parent feature overview
