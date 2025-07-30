---
date: 2025-07-29T20:55:24-05:00
researcher: Kyle Mistele
git_commit: 5bc7c239881ace5c7b067f5684cd0b5694df2a3d
branch: master
repository: mcplatform
topic: "Sub-Feature: Server Assignment & Configuration UI"
tags: [sub-feature-definition, interactive-walkthrough, server-assignment, configuration]
status: complete
last_updated: 2025-07-29
last_updated_by: Claude
type: sub_feature_definition
---

# Sub-Feature: Server Assignment & Configuration UI

## Parent Feature
[Interactive Walkthrough Feature](../feature.md)

## Overview
This sub-feature focuses on the UI components that allow customers to connect their centrally-managed walkthroughs to their specific MCP servers. It provides the interface for creating and managing the many-to-many relationship between walkthroughs and servers, including controls for ordering and visibility. This functionality will be integrated directly into the existing MCP server detail pages and also accessible from the main walkthrough management interface.

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
Walkthroughs and step management are already built via the authoring UI sub-feature. This feature focuses purely on the assignment relationship between existing walkthroughs and MCP servers.

### Composition Pattern
Follows the standard async server component pattern with promises passed to client components; oRPC server actions for mutations; React 19 `use()` hook for data unwrapping in client components.

### Data Model
The UI manages the `mcp_server_walkthroughs` junction table with fields for `mcpServerId`, `walkthroughId`, `displayOrder`, `isEnabled`, and `assignedAt`.

## Business Value

### For MCPlatform Customers
- **Content Reusability**: Create walkthroughs once and deploy across multiple servers efficiently
- **Flexible Deployment**: Control which guidance appears where based on server context and audience
- **Operational Efficiency**: Manage walkthrough assignments centrally without duplicating content
- **User Experience Control**: Fine-tune the order and availability of guidance per server

### For End-Users
- **Contextual Guidance**: Receive relevant walkthroughs tailored to their specific server/product context
- **Organized Experience**: Walkthroughs presented in logical order as determined by the customer
- **Consistent Quality**: Same high-quality walkthrough content deployed consistently across servers

## User Stories

### Primary Users (MCPlatform Customers)
1. **Server Manager**: **Given** I'm viewing my MCP server details, **when** I want to add interactive guidance, **then** I can assign walkthroughs using a multi-select interface and see them listed with reorder/toggle controls

2. **Content Manager**: **Given** I have multiple walkthroughs created, **when** I want to deploy them strategically, **then** I can assign the same walkthrough to multiple servers and control the display order per server

3. **Server Administrator**: **Given** I have walkthroughs assigned to my server, **when** I need to temporarily disable guidance without removing it, **then** I can toggle individual walkthroughs on/off and drag to reorder them

4. **Organization Owner**: **Given** I'm managing multiple servers, **when** I want consistent user experiences, **then** I can see which walkthroughs are assigned where and make bulk assignment changes

## Core Functionality

### Server Detail Page Enhancement
- **New Walkthroughs Tab**: Add "Walkthroughs" tab to existing server detail page tab navigation
- **Assignment Interface**: Prominent multi-select component for attaching/detaching walkthroughs
- **Management Controls**: Drag-and-drop reordering and enable/disable toggles for assigned walkthroughs

### Multi-Select Assignment Component
- **Shared Component**: Uses the same `MultiSelectWalkthroughs` component established in the authoring UI feature
- **Search and Filter**: Real-time search functionality with walkthrough title filtering
- **Visual Feedback**: Custom badge display showing walkthrough title and step count
- **Accessibility**: Full keyboard navigation and screen reader support

### Assigned Walkthroughs Management
- **Drag-and-Drop Reordering**: Visual drag handles for reordering walkthroughs with display order persistence
- **Enable/Disable Toggles**: Individual switches to temporarily disable walkthroughs without removing assignments
- **Quick Actions**: View walkthrough details, remove assignments with confirmation dialogs
- **Visual State Management**: Clear enabled/disabled visual states with optimistic UI updates

### Cross-Interface Consistency
- **Bidirectional Assignment**: Same assignment interface accessible from both server detail pages and walkthrough detail pages
- **Consistent UX**: Same interaction patterns and visual design across both contexts
- **Shared Components**: Single implementation maintained for reuse across interfaces

## Requirements

### Functional Requirements
- **Assignment Management**: Create, read, update, and delete walkthrough-to-server assignments
- **Display Order Control**: Drag-and-drop reordering that updates the `displayOrder` field in real-time
- **Enable/Disable Functionality**: Toggle walkthrough visibility per server without removing assignments
- **Search and Filter**: Real-time search within multi-select for organizations with many walkthroughs
- **Empty State Handling**: Appropriate messaging for no assignments and no available walkthroughs

### Non-Functional Requirements

#### Security & Permissions
- **Organization Scoping**: All operations restricted to user's organization
- **Server Ownership Validation**: Users can only assign walkthroughs to servers they own
- **Walkthrough Access Control**: Users can only assign walkthroughs they have access to

#### User Experience
- **Optimistic Updates**: Immediate UI feedback before server confirmation
- **Error Recovery**: Automatic rollback on server action failures with clear user messaging
- **Responsive Design**: Interface works effectively on mobile and desktop devices

#### Mobile Support
- **Touch-Friendly Interactions**: Larger touch targets for mobile drag-and-drop operations
- **Responsive Layout**: Stacked layout on smaller screens
- **Gesture Support**: Touch-based interactions for reordering

## Design Considerations

### Layout & UI
- **Tab Integration**: New "Walkthroughs" card in existing server detail page tab navigation
- **Assignment Section**: Multi-select component prominently displayed with clear call-to-action
- **Management List**: Assigned walkthroughs displayed below with drag handles and toggles
- **Empty States**: Consistent with existing dashboard empty state patterns

### Responsive Behavior
- **Desktop Layout**: Full three-column layout with multi-select, assigned list, and quick actions
- **Tablet Layout**: Condensed layout with collapsible sections
- **Mobile Layout**: Single-column stacked layout with touch-optimized controls

### State Management
- **Server-Side State**: All assignment data managed server-side with proper organization scoping
- **Error Handling**: user notification on server action failures

## Implementation Considerations

### Technical Architecture
- **Junction Table Operations**: All assignment operations interact with `mcp_server_walkthroughs` table
- **oRPC Server Actions**: Assignment operations handled via server actions with proper validation
- **Component Reuse**: Leverage existing `MultiSelectWalkthroughs` component from authoring UI

### Dependencies
- **Walkthrough Authoring UI**: Depends on completed walkthrough and step management functionality
- **Existing Server Detail Page**: Integrates with current server detail page tab structure
- **Multi-Select Component**: Requires shared component implementation

## Success Criteria

### Core Functionality
- **Assignment Interface Works**: Users can successfully assign/remove walkthroughs to/from servers
- **Reordering Functions**: Drag-and-drop reordering updates display order correctly
- **Toggle Controls Operate**: Enable/disable toggles work without removing assignments
- **Empty States Guide Users**: Clear guidance when no walkthroughs are assigned or available

### User Experience
- **Consistent Patterns**: Same multi-select component behavior across server and walkthrough pages
- **Responsive Design**: Interface works effectively on mobile and desktop
- **Error Recovery**: Failed operations provide clear feedback and recovery options

### Technical Implementation
- **Organization Scoping**: All operations properly restricted to user's organization
- **Data Integrity**: Junction table operations maintain referential integrity
- **Performance**: Interface remains responsive with large numbers of walkthroughs

## Scope Boundaries

### Definitely In Scope
- **Multi-select assignment interface** for attaching/detaching walkthroughs to servers
- **Drag-and-drop reordering** of assigned walkthroughs with display order persistence
- **Enable/disable toggles** for temporarily disabling walkthroughs per server
- **Empty state handling** for no assignments and no available walkthroughs
- **Bidirectional assignment flow** from both server and walkthrough detail pages

### Definitely Out of Scope
- **Walkthrough creation/editing** (handled by authoring UI sub-feature)
- **Step management** (handled by existing walkthrough authoring)
- **Content editing** (handled by existing walkthrough editor)
- **Analytics/reporting** (separate feature area)
- **Bulk walkthrough operations** across multiple servers

### Future Considerations
- **Assignment templates** for quickly assigning common walkthrough sets
- **Assignment analytics** showing usage patterns across servers
- **Conditional assignments** based on server properties or user segments

## Open Questions & Risks

### Questions Needing Resolution
- **Drag Library Choice**: Confirm @dnd-kit vs react-beautiful-dnd for drag-and-drop implementation
- **Mobile UX**: Validate touch-based reordering experience on mobile devices
- **Performance Limits**: Determine virtual scrolling requirements for large walkthrough lists

### Identified Risks
- **Component Coordination**: Risk of inconsistent behavior between shared multi-select components
- **Data Consistency**: Risk of junction table integrity issues during concurrent operations
- **User Confusion**: Risk of unclear assignment state when walkthroughs are disabled vs removed

## Next Steps
- **Component Implementation**: Build shared `MultiSelectWalkthroughs` component if not already complete
- **Server Detail Page Integration**: Add new "Walkthroughs" tab to existing server detail pages
- **Server Actions**: Implement oRPC actions for assignment operations with proper validation
- Ready for implementation planning

## Related Documents
- [Walkthrough Authoring UI](../02-walkthrough-authoring-ui/feature.md) - Complementary authoring interface
- [Parent Feature](../feature.md) - Overall interactive walkthrough system context
- [UI Ideation](../thoughts/ui-ideation.md) - Detailed UI specifications and component designs