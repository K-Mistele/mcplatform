# Sub-Feature: Walkthrough Authoring & Management UI

## Parent Feature
[Interactive Walkthrough Feature](../feature.md)

## Overview
This sub-feature delivers the dashboard UI that allows MCPlatform customers to create, edit, and manage their interactive walkthroughs. It provides a comprehensive authoring environment where content is written, structured, and published. This functionality will be housed in a new, dedicated "Walkthroughs" section within the main dashboard, establishing walkthroughs as independent entities that can be managed centrally and assigned to multiple MCP servers.

## Business Value
- **Content Independence**: Walkthroughs are created once and can be reused across multiple MCP servers
- **Centralized Management**: All walkthrough content managed in one place for operational efficiency
- **Rich Authoring Experience**: Full-featured markdown editor with preview capabilities
- **Flexible Assignment**: Dynamic assignment and ordering of walkthroughs per server
- **Version Control**: Basic versioning system with publish/draft states
- **Analytics Integration**: Built-in tracking for walkthrough performance across servers

## User Stories

### Primary Users (MCPlatform Customers)
- As a customer, I want to create walkthroughs independently of my MCP servers so I can manage content efficiently
- As a customer, I want to edit walkthrough content using a markdown editor so I can create rich, formatted guidance
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
├── Support
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
- **Description** (truncated with tooltip for full text)
- **Steps** (count badge)
- **Version** (integer with "v" prefix)
- **Assigned Servers** (count with hover tooltip showing server names)
- **Created** (relative time using `formatDistanceToNow`)
- **Status** (Published/Draft with colored badges)
- **Actions** (dropdown menu with: Edit, Duplicate, Assign to Servers, Delete)

#### Table Features
- **Search**: Filter by title and description
- **Sorting**: All columns sortable
- **Pagination**: Standard pagination for large lists
- **Bulk Actions**: Select multiple walkthroughs for bulk operations

#### Empty State
If no walkthroughs exist:
- Centered illustration (consistent with existing empty states)
- **Primary Text**: "No walkthroughs yet"
- **Secondary Text**: "Create your first interactive walkthrough to guide users through your products"
- **CTA Button**: "Create Walkthrough"

### 2. Create/Edit Walkthrough Modal

#### Modal Specifications
**Triggered by**: "Create Walkthrough" button or Edit action from table

**Modal Structure**:
- **Title**: "Create Walkthrough" / "Edit Walkthrough"
- **Size**: Medium modal (600px width)
- **Form Fields**:
  - **Title** (required, text input, max 100 characters)
  - **Description** (optional, textarea, max 500 characters, 3 rows)
  - **Server Assignment** (optional multi-select using new MultiSelectWalkthroughs component)
  - **Publish Status** (toggle: Draft/Published)
- **Actions**: 
  - Cancel (secondary button)
  - Create/Save (primary button, disabled until title provided)

**Validation**:
- Title is required and must be unique within organization
- Description is optional but recommended
- Server assignment can be modified later

### 3. Walkthrough Detail Page (`/dashboard/walkthroughs/[walkthroughId]`)

#### Page Layout
**Breadcrumb**: Dashboard > Walkthroughs > [Walkthrough Title]

#### Header Section
- **Walkthrough Title** (inline editable with auto-save)
- **Description** (inline editable textarea with auto-save)
- **Version Badge** (e.g., "v2")
- **Server Assignments**: Compact badge list showing assigned servers with count
- **Action Buttons**:
  - "Preview" (opens preview modal)
  - "Publish Changes" (if unpublished changes exist)
  - "Assign to Servers" (opens server assignment modal)
  - "Settings" (dropdown with version history, duplicate, delete)

#### Server Assignment Quick Access
Expandable section under header:
- **Multi-select component** for quick server assignment changes
- **Assigned servers list** with individual enable/disable toggles
- **Reorder interface** with drag handles for display order

#### Two-Column Layout

**Left Column (1/3 width): Steps Navigator**
- **Header**: "Steps" with step count badge
- **Step List**: Ordered list of all steps
  - Step number/order indicator
  - Step title (truncated)
  - Status indicator (published/draft)
  - Active step highlighted
- **Drag Handles**: For reordering steps
- **Add Step Button**: At bottom of list, creates new step at end
- **Step Actions**: Hover reveals duplicate/delete icons

**Right Column (2/3 width): Step Editor**
- **Step Header**:
  - Step title (editable input with auto-save)
  - Step number indicator
  - Delete step button (with confirmation)
- **Markdown Editor**:
  - Toolbar with formatting options (bold, italic, code, link, lists, headers)
  - **View Modes**: 
    - Write (markdown editing)
    - Preview (rendered markdown)
    - Split (side-by-side)
  - **Full-screen Mode**: Expand editor to full window
  - **Auto-save**: With visual indicator ("Saving..." / "Saved" / "Error")
- **Editor Features**:
  - Syntax highlighting for markdown
  - Line numbers
  - Keyboard shortcuts (Ctrl+B for bold, etc.)
  - Tab support for indentation

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

### 5. Preview Mode

#### Preview Modal Specifications
**Triggered by**: "Preview" button from walkthrough detail page

**Modal Features**:
- **Full-Screen Modal**: Simulates MCP tool interface
- **Navigation Controls**:
  - Previous/Next step buttons
  - Step counter: "Step 2 of 5"
  - Progress bar showing completion percentage
- **Content Display**:
  - Rendered markdown content
  - Simulated MCP tool UI chrome
- **Controls**:
  - "Exit Preview" button
  - "Edit This Step" shortcut button

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

#### MarkdownEditor Component
Advanced markdown editor with:
- CodeMirror or Monaco integration
- Syntax highlighting
- Preview modes (split, tabs)
- Auto-save with debouncing
- Keyboard shortcuts
- Full-screen mode
- Error handling and recovery

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
- `Dialog` for create/edit modals
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

## Definition of Done

### Phase 1: Core Authoring (Ready for Development)
- [ ] New "Walkthroughs" sidebar section implemented
- [ ] Walkthrough list page with data table
- [ ] Create/Edit walkthrough modal
- [ ] Basic walkthrough detail page with step management
- [ ] Markdown editor with preview
- [ ] All oRPC server actions for CRUD operations
- [ ] Auto-save functionality with visual feedback
- [ ] Step reordering with drag-and-drop
- [ ] Organization scoping and authorization
- [ ] Basic responsive design

### Phase 2: Enhanced Features
- [ ] Server assignment interface with multi-select
- [ ] Enhanced MCP server detail page walkthrough tab
- [ ] Preview mode functionality
- [ ] Advanced markdown editor features
- [ ] Comprehensive error handling and recovery
- [ ] Mobile optimization
- [ ] Performance optimizations

### Phase 3: Analytics and Polish
- [ ] Walkthrough analytics integration
- [ ] Advanced editor features (full-screen, shortcuts)
- [ ] Bulk operations for walkthrough management
- [ ] Version management UI
- [ ] Comprehensive testing coverage
- [ ] Documentation for customers

## Related Documents
- [UI Ideation](../thoughts/ui-ideation.md) - Detailed UI specifications and mockups
- [Technical Specification](../thoughts/technical-specification.md) - Database schema and architecture
- [Interactive Walkthrough Feature](../feature.md) - Parent feature overview
