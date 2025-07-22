---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "UI Ideation for Interactive Walkthroughs"
tags: [thoughts, ui, ideation, interactive-walkthrough, design]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
type: thoughts
---

# UI Ideation for Interactive Walkthroughs

Based on my exploration of the existing MCPlatform dashboard, this document outlines the proposed UI for the interactive walkthrough feature. The design follows the established patterns and components already in use, with walkthroughs managed independently from MCP servers.

## Design Principles Observed

From examining the current UI, I've identified these key patterns:
- **Card-based layouts** for overview sections
- **Data tables** with search/filter capabilities for lists
- **Tab navigation** for organizing related content
- **Modal dialogs** for creation and quick edits
- **Detail pages** with breadcrumb navigation
- **Consistent use of shadcn/ui components**
- **Clean, minimal design** with good use of whitespace

## Architecture Overview

The UI follows a **separation of concerns approach**:

1. **Dedicated Walkthrough Management**: Top-level "Walkthroughs" sidebar section for creating and editing all walkthroughs
2. **Server Assignment Interface**: Lightweight assignment controls within MCP server detail pages
3. **Many-to-Many Relationship**: Each walkthrough can be assigned to multiple servers with individual configuration

## Proposed UI Structure

### 1. Main Walkthroughs Management Page

**Location**: `/dashboard/walkthroughs` (new top-level sidebar item)

#### Sidebar Navigation Addition
```
Dashboard
├── Overview
├── Servers
├── Walkthroughs  ← NEW
├── Support
└── Settings
```

#### Page Header
- **Title**: "Walkthroughs"
- **Description**: "Create and manage interactive guides for your users"
- **Action Button**: "Create Walkthrough" (primary button, top right)

#### Walkthroughs List
A data table with columns:
- **Title** (clickable, leads to detail page)
- **Description** (truncated)
- **Steps** (count)
- **Version** 
- **Assigned Servers** (count with hover tooltip showing server names)
- **Created** (relative time)
- **Status** (Published/Draft with colored badges)
- **Actions** (dropdown with Edit, Duplicate, Assign to Servers, Delete)

#### Empty State
If no walkthroughs exist:
- Centered illustration
- Text: "No walkthroughs yet"
- Subtext: "Create your first interactive walkthrough to guide users through your products"
- "Create Walkthrough" button

### 2. Server Detail Page Enhancement

**Location**: `/dashboard/servers/[serverId]`

Add a new **"Walkthroughs"** tab to the existing server tabs:

```
[Configuration] [Users] [Sessions] [Walkthroughs] [Analytics]
```

#### Walkthroughs Tab Content

**Header Section**:
- **Title**: "Assigned Walkthroughs"
- **Description**: "Interactive guides available on this server"

**Assignment Interface**:
Uses a **multi-select component** (based on shadcn-multi-select-component) for attaching/detaching walkthroughs:

```typescript
interface WalkthroughAssignmentProps {
  availableWalkthroughs: Array<{
    id: string;
    title: string;
    description?: string;
    stepCount: number;
  }>;
  assignedWalkthroughs: string[]; // walkthrough IDs
  onAssignmentChange: (walkthroughIds: string[]) => void;
}
```

**Multi-Select Features**:
- **Placeholder**: "Select walkthroughs to assign..."
- **Search**: Filter walkthroughs by title
- **Custom Badge Display**: Shows walkthrough title + step count
- **Max Count**: Show first 3, then "+2 more" format
- **Icons**: Optional walkthrough type icons
- **Animation**: Smooth bounce animation for selections

**Assigned Walkthroughs List**:
Below the multi-select, show a sortable list of assigned walkthroughs with:
- **Drag handles** for reordering (affects `displayOrder`)
- **Enable/Disable toggle** per walkthrough
- **Quick actions**: View, Edit, Remove assignment

#### Empty State
If no walkthroughs are assigned:
- Text: "No walkthroughs assigned"
- Subtext: "Use the selector above to assign walkthroughs to this server"

### 3. Create/Edit Walkthrough Modal

**Triggered by**: "Create Walkthrough" button or Edit action

Modal dialog with:
- **Title**: "Create Walkthrough" / "Edit Walkthrough"
- **Fields**:
  - Title (required)
  - Description (textarea, optional)
  - Server Assignment (optional - uses the same multi-select component)
- **Actions**: Cancel, Create/Save

### 4. Walkthrough Detail Page

**Location**: `/dashboard/walkthroughs/[walkthroughId]` (moved from server context)

#### Page Structure

**Breadcrumb**: Dashboard > Walkthroughs > [Walkthrough Title]

**Header Section**:
- Walkthrough title (editable inline)
- Description (editable inline)
- Version badge
- **Server Assignments**: Small badge list showing assigned servers with count
- Action buttons: "Preview", "Publish Changes" (if draft), "Assign to Servers", "Settings"

**Server Assignment Quick Access**:
Expandable section under header with:
- **Multi-select component** for quick server assignment changes
- **Assigned servers list** with individual enable/disable toggles

**Two-Column Layout**:

**Left Column (1/3 width)**: Steps Navigator
- List of all steps in order
- Drag handle for reordering
- Current step highlighted
- Add step button at bottom
- Each step shows:
  - Step number/order indicator
  - Title
  - Status indicator (if published/draft)

**Right Column (2/3 width)**: Step Editor
- Step title (editable)
- Markdown editor with:
  - Toolbar (bold, italic, code, link, etc.)
  - Split view option (markdown | preview)
  - Full-screen mode
- Save indicator (auto-save with "Saved" status)
- Delete step button (with confirmation)

### 5. Step Management

#### Adding a Step
- Click "Add Step" in the navigator
- New step appears at the end
- Auto-focuses the title field
- Default title: "New Step"

#### Reordering Steps
- Drag and drop in the navigator
- Visual feedback during drag
- Updates the linked list structure in the background

#### Deleting a Step
- Confirmation dialog: "Delete this step? This action cannot be undone."
- Updates linked list references

### 6. Preview Mode

**Triggered by**: "Preview" button

Opens a modal or new tab showing:
- Simulated MCP tool interface
- Current step content rendered
- Navigation: "Previous" | "Next" buttons
- Step counter: "Step 2 of 5"
- Close/Exit preview button

### 7. Analytics Integration

#### Server Analytics Enhancement
Add a new section in each server's Analytics tab:

**Walkthrough Analytics Card**:
- Total assigned walkthroughs
- Active users (in last 7 days)
- Completion rate
- Most popular walkthrough on this server

#### Global Walkthrough Analytics
New analytics section in the main Walkthroughs page (`/dashboard/walkthroughs/analytics`):

**Overview Cards**:
- Total walkthroughs created
- Total assignments across all servers
- Global completion rate
- Active users across all walkthroughs

**Detailed Analytics Table**:
Per-walkthrough metrics with columns:
- **Walkthrough Title** (clickable for drill-down)
- **Assigned Servers** (count)
- **Total Started** (across all servers)
- **Total Completed** (across all servers)
- **Average Progress**
- **Completion Rate**
- **Server Performance** (expandable showing per-server stats)

#### Cross-Server Analytics
Click through to see how a walkthrough performs across different servers:
- Server comparison table
- Performance variations
- User engagement by server context

### 8. Mobile Responsiveness

Following the existing responsive patterns:
- Stacked layout on mobile
- Collapsible step navigator
- Full-width editor
- Touch-friendly controls

## Component Reuse & New Components

### Existing Components
Leverage existing components:
- `DataTable` for walkthrough lists
- `Card` for overview sections
- `Dialog` for create/edit modals
- `Tabs` for navigation
- `Button`, `Input`, `Textarea` for forms
- `Badge` for status indicators
- `DropdownMenu` for actions
- `Alert` for confirmations

### New Components

#### Multi-Select Walkthrough Assignment Component
Based on [shadcn-multi-select-component](https://github.com/sersavan/shadcn-multi-select-component):

```typescript
<MultiSelectWalkthroughs
  availableWalkthroughs={walkthroughs}
  selectedWalkthroughs={assigned}
  onSelectionChange={handleAssignmentChange}
  placeholder="Select walkthroughs to assign..."
  maxCount={3}
  searchable
  animation="bounce"
/>
```

**Key Features**:
- **Popover-based dropdown** with search functionality
- **Custom badge display** showing walkthrough title + step count
- **Keyboard navigation** support
- **Select all/clear all** options
- **Animation effects** for visual feedback
- **Responsive design** for mobile compatibility

**Props Interface**:
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

#### Draggable Walkthrough List Component
For managing walkthrough order on servers:

```typescript
<DraggableWalkthroughList
  walkthroughs={assignedWalkthroughs}
  onReorder={handleReorder}
  onToggleEnabled={handleToggle}
  onRemove={handleRemove}
/>
```

## Future Enhancements

These are not part of the initial implementation but could be added later:
- Walkthrough templates/examples
- A/B testing different walkthrough versions
- Branching paths (conditional steps)
- Rich media support (images, videos)
- Collaborative editing
- Walkthrough analytics dashboard

## Technical Considerations

### State Management
- Use the existing `nuqs` pattern for URL state (selected step, assignment filters)
- Implement auto-save with debouncing for the markdown editor
- Use optimistic updates for walkthrough reordering and assignment changes
- Cache walkthrough lists for better performance in multi-select components

### Data Fetching Patterns
- Server components pass promises to client components following MCPlatform patterns
- oRPC server actions for all mutations (create, update, assign, reorder)
- Real-time updates for assignment changes across different dashboard sections

### Component Implementation
- **Multi-select component** built using shadcn/ui primitives (Popover, Command, Badge)
- **Markdown editor** using CodeMirror or Monaco with syntax highlighting
- **Drag-and-drop** using react-beautiful-dnd or @dnd-kit
- **Auto-save** with visual indicators and error handling

### Performance Optimizations
- **Lazy loading** for walkthrough content in lists
- **Virtual scrolling** for large walkthrough lists
- **Debounced search** in multi-select components
- **Optimistic updates** for immediate UI feedback

### Security & Validation
- **Organization scoping** enforced at component level
- **Input sanitization** for markdown content
- **Permission checks** before assignment operations
- **Rate limiting** for auto-save operations