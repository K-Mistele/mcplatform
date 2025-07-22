---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "Sub-Feature: Server Assignment & Configuration UI"
tags: [sub-feature-definition, interactive-walkthrough, server-assignment, configuration]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
type: sub_feature_definition
---

# Sub-Feature: Server Assignment & Configuration UI

## Parent Feature
[Interactive Walkthrough Feature](../feature.md)

## Overview
This sub-feature focuses on the UI components that allow customers to connect their centrally-managed walkthroughs to their specific MCP servers. It provides the interface for creating and managing the many-to-many relationship between walkthroughs and servers, including controls for ordering and visibility. This functionality will be integrated directly into the existing MCP server detail pages and also accessible from the main walkthrough management interface.

## Business Context
The server assignment UI is critical for the decoupled architecture where walkthroughs are managed independently but can be deployed across multiple MCP servers. This allows customers to:
- **Reuse Content**: Assign the same walkthrough to multiple servers without duplication
- **Context-Specific Deployment**: Control which walkthroughs appear on each server based on their user audience
- **Flexible Management**: Temporarily disable walkthroughs on specific servers without affecting other assignments
- **Optimized User Experience**: Control the order in which walkthroughs are presented to end-users

## Data Model Context
The UI manages the `mcp_server_walkthroughs` junction table, which contains:
- `mcpServerId` and `walkthroughId` for the many-to-many relationship
- `displayOrder` for controlling presentation order
- `isEnabled` for temporary disable/enable without removing assignments
- `assignedAt` for tracking assignment history
- Unique constraint to prevent duplicate assignments

## Core Components

### 1. Server Detail Page Enhancement
**Location**: `/dashboard/servers/[serverId]` - Add new "Walkthroughs" tab

#### Tab Navigation Update
```
[Configuration] [Users] [Sessions] [Walkthroughs] [Analytics]
```

#### Tab Header Section
- **Title**: "Assigned Walkthroughs"
- **Description**: "Interactive guides available on this server"
- **Call-to-Action**: Prominently display assignment interface

### 2. Multi-Select Assignment Component
**Primary Interface**: Based on shadcn-multi-select-component for attaching/detaching walkthroughs

#### Component Specifications
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

#### Multi-Select Features
- **Placeholder Text**: "Select walkthroughs to assign..."
- **Search Functionality**: Filter walkthroughs by title with real-time search
- **Custom Badge Display**: Shows "walkthrough title + step count" format
- **Max Count Display**: Show first 3 selections, then "+X more" format
- **Optional Icons**: Walkthrough type icons for visual differentiation
- **Smooth Animations**: Bounce animation for selection feedback
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Select All/Clear All**: Bulk action options
- **Responsive Design**: Mobile-compatible layout

#### Advanced Multi-Select Props
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

### 3. Assigned Walkthroughs Management Interface
**Below Multi-Select**: Comprehensive management of current assignments

#### Draggable Walkthrough List
- **Drag Handles**: Visual drag indicators for reordering
- **Display Order Control**: Updates `displayOrder` field in junction table
- **Visual Feedback**: Clear drag states and drop zones
- **Reorder Persistence**: Real-time updates to database via oRPC server actions

#### Enable/Disable Toggles
- **Per-Walkthrough Control**: Individual enable/disable switches
- **Visual State Indicators**: Clear enabled/disabled visual states
- **Immediate Feedback**: Optimistic UI updates with server confirmation
- **Batch Operations**: Select multiple walkthroughs for bulk enable/disable

#### Quick Action Menu
For each assigned walkthrough:
- **View**: Navigate to walkthrough detail page
- **Edit**: Direct link to walkthrough editor
- **Remove Assignment**: Remove from server (with confirmation dialog)
- **Preview**: Test walkthrough experience in context

### 4. Configuration Controls

#### Drag-and-Drop Reordering
- **Implementation**: Using @dnd-kit or react-beautiful-dnd
- **Visual Feedback**: Clear drag states, drop zones, and reordering previews
- **Persistence**: Real-time updates via oRPC server actions
- **Error Handling**: Rollback on failure with user notification
- **Accessibility**: Keyboard-based reordering alternative

#### Enable/Disable Toggle System
- **Per-Assignment Control**: Each server assignment can be independently enabled/disabled
- **Visual States**: Clear indication of enabled (active) vs disabled (muted) walkthroughs
- **Bulk Operations**: Select multiple assignments for batch toggle operations
- **Status Persistence**: Updates `isEnabled` field in junction table
- **Real-time Updates**: Immediate UI feedback with server synchronization

### 5. Empty States & User Guidance

#### No Walkthroughs Assigned State
- **Visual**: Empty state illustration or icon
- **Message**: "No walkthroughs assigned"
- **Guidance**: "Use the selector above to assign walkthroughs to this server"
- **Call-to-Action**: Prominent "Assign Walkthroughs" button

#### No Available Walkthroughs State
- **Context**: When organization has no published walkthroughs
- **Message**: "No walkthroughs available"
- **Guidance**: "Create walkthroughs in the Walkthroughs section first"
- **Action**: Link to walkthrough creation flow

### 6. Real-Time Assignment Updates
- **Optimistic Updates**: Immediate UI feedback for assignment changes
- **Server Synchronization**: All changes persisted via oRPC server actions
- **Error Handling**: Graceful rollback on server errors with user notification
- **Cross-Tab Updates**: Changes reflected across multiple browser tabs/windows
- **Conflict Resolution**: Handle concurrent assignment changes by multiple users

### 7. Component Integration Patterns

#### oRPC Server Actions Integration
All assignment operations handled via server actions:
```typescript
// Example server actions for assignment management
export const assignWalkthroughToServer = base
    .input(z.object({
        serverId: z.string(),
        walkthroughId: z.string(),
        displayOrder: z.number().optional()
    }))
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        // Business logic for assignment
        await db.insert(mcpServerWalkthroughs).values({...})
        revalidatePath(`/dashboard/servers/${input.serverId}`)
        return { success: true }
    })
    .actionable({})

export const updateWalkthroughOrder = base
    .input(z.object({
        serverId: z.string(),
        walkthroughOrders: z.array(z.object({
            walkthroughId: z.string(),
            displayOrder: z.number()
        }))
    }))
    .handler(async ({ input, errors }) => {
        // Batch update display orders
        // Revalidate affected paths
    })
    .actionable({})
```

#### State Management Architecture
- **Server-Side State**: All assignment data managed server-side
- **Client-Side Optimistic Updates**: Immediate UI feedback before server confirmation
- **Error Recovery**: Automatic rollback on server action failures
- **URL State Integration**: Using `nuqs` for assignment filter states

### 8. Cross-Interface Consistency

#### Walkthrough Detail Page Integration
**Quick Server Assignment Section**: 
- Expandable section in walkthrough detail pages
- Same multi-select component for consistent UX
- Live preview of which servers have this walkthrough assigned

#### Bidirectional Assignment Flow
- **From Server Page**: Assign any available walkthrough to current server
- **From Walkthrough Page**: Assign current walkthrough to any available server
- **Consistent UI**: Same components and patterns in both contexts

### 9. Performance Optimizations

#### Component-Level Optimizations
- **Lazy Loading**: Walkthrough content loaded on-demand
- **Virtual Scrolling**: For organizations with many walkthroughs
- **Debounced Search**: Efficient filtering without excessive API calls
- **Memoized Components**: Prevent unnecessary re-renders during drag operations

#### Data Fetching Strategy
- **Server Components**: Pass data promises from server components
- **Client Components**: Use React 19 `use()` hook to unwrap promises
- **Caching**: Strategic caching of walkthrough lists for multi-select components

### 10. Accessibility & Usability

#### Keyboard Navigation
- **Multi-Select**: Full keyboard support for selection operations
- **Drag-and-Drop**: Keyboard alternative for reordering
- **Toggle Controls**: Space/Enter activation for enable/disable toggles

#### Screen Reader Support
- **Aria Labels**: Comprehensive labeling for all interactive elements
- **Live Regions**: Announcements for assignment changes
- **Focus Management**: Proper focus handling during dynamic updates

#### Mobile Responsiveness
- **Touch-Friendly**: Larger touch targets for mobile interaction
- **Responsive Layout**: Stacked layout on smaller screens
- **Gesture Support**: Touch-based drag and drop for reordering

## Technical Implementation Details

### Database Operations
All assignment operations interact with the `mcp_server_walkthroughs` junction table:
- **CREATE**: Add new walkthrough assignments
- **UPDATE**: Modify display order and enable/disable status
- **DELETE**: Remove walkthrough assignments
- **READ**: Query assignments for display and management

### Security & Authorization
- **Organization Scoping**: All operations properly scoped to user's organization
- **Server Ownership**: Users can only assign walkthroughs to servers they own
- **Permission Validation**: Server-side validation of all assignment operations

### Error Handling & Edge Cases
- **Concurrent Updates**: Handle multiple users modifying assignments simultaneously
- **Network Failures**: Graceful degradation and retry mechanisms
- **Data Consistency**: Ensure junction table integrity during bulk operations
- **Validation**: Client and server-side validation of assignment constraints

## Success Metrics
- **Assignment Completion Rate**: % of walkthroughs that get assigned to at least one server
- **Multi-Server Usage**: Average number of servers per walkthrough assignment
- **Configuration Changes**: Frequency of reordering and enable/disable operations
- **User Task Completion**: Time to complete walkthrough assignment tasks

## Related Documents
- [UI Ideation](../thoughts/ui-ideation.md) - Detailed UI specifications and component designs
- [Technical Specification](../thoughts/technical-specification.md) - Database schema and data architecture
- [Parent Feature](../feature.md) - Overall interactive walkthrough system context
