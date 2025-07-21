# Implementation Plan: Better Session Support

## Overview
Transform the user details page from an event-centric timeline view to a session-centric three-pane interface that provides better organization and navigation of user activity.

## Strategy

### Phase 1: Data Layer (Foundation)
- Create new session-focused data fetching functions
- Ensure proper organization scoping and efficient queries
- Maintain existing React 19 promise patterns

### Phase 2: UI Architecture (Core Layout)
- Implement three-pane resizable layout using shadcn/ui
- Create base components for each pane
- Ensure responsive design across screen sizes

### Phase 3: State Management (Interactivity)
- Implement URL state management with nuqs
- Handle session selection and item selection
- Ensure shareable URLs work correctly

### Phase 4: Content Components (Functionality)
- Build session list component with proper sorting
- Create unified tool calls + support tickets view
- Implement detailed item view with proper formatting

### Phase 5: Testing & Polish (Validation)
- Test with Puppeteer across different scenarios
- Verify responsive behavior
- Ensure all requirements are met

## Technical Architecture

### Data Flow
```
Server Component (page.tsx)
├── getUserSessions(userId) → Promise<Session[]>
├── (selected session via URL) → getSessionToolCalls(sessionId) → Promise<ToolCall[]>
└── (selected session via URL) → getSessionSupportTickets(sessionId) → Promise<SupportTicket[]>

Client Component
├── Left Pane: Sessions List (uses getUserSessions promise)
├── Center Pane: Session Contents (uses tool calls + support tickets promises)
└── Right Pane: Item Details (from center pane selection)
```

### URL Structure
```
/dashboard/users/{userId}?session={sessionId}&item={itemId}&type={tool_call|support_ticket}
```

## Implementation Checklist

### ✅ Completed
- [x] Requirements analysis and current implementation review
- [x] Implementation plan creation
- [x] **1.1** Create `getUserSessions(userId)` function in data.ts
- [x] **1.2** Create `getSessionToolCalls(sessionId, organizationId)` function
- [x] **1.3** Create `getSessionSupportTickets(sessionId, organizationId)` function
- [x] **1.4** Update page.tsx to use new session-based data fetching
- [x] **2.1** Install and configure nuqs for URL state management
- [x] **2.2** Create three-pane layout with ResizablePanelGroup from shadcn/ui
- [x] **2.4** Move components to proper directories (user-detail-client, user-detail-skeleton)
- [x] **5.1** Test three-pane layout with Puppeteer - ✅ **WORKING PERFECTLY**
- [x] **5.2** Test session selection and item selection - ✅ **WORKING PERFECTLY**

### 🔄 In Progress
- [x] Currently working on: **4.2** Implement oRPC endpoints for session-specific data fetching

### ⏳ Pending

#### Phase 2: UI Architecture  
- [ ] **2.1** Install and configure nuqs for URL state management
- [ ] **2.2** Create three-pane layout with ResizablePanelGroup from shadcn/ui
- [ ] **2.3** Implement responsive breakpoints (3-col → 2-col → 1-col)
- [ ] **2.4** Create base components: SessionsList, SessionContents, ItemDetails

#### Phase 3: State Management
- [ ] **3.1** Implement session selection state with URL sync
- [ ] **3.2** Implement item selection state with URL sync  
- [ ] **3.3** Handle initial state from URL parameters on page load
- [ ] **3.4** Add loading states and error boundaries

#### Phase 4: Content Components
- [ ] **4.1** Build SessionsList component with session cards
- [ ] **4.2** Build SessionContents with unified tool calls + support tickets
- [ ] **4.3** Build ItemDetails with proper JSON formatting and metadata
- [ ] **4.4** Add proper sorting and filtering logic

#### Phase 5: Testing & Polish
- [ ] **5.1** Test three-pane layout with Puppeteer
- [ ] **5.2** Test URL state management and sharing
- [ ] **5.3** Test responsive behavior across screen sizes
- [ ] **5.4** Verify all user stories are implemented

## Key Design Decisions

### Data Architecture
- **Session-first approach**: Query sessions first, then load session contents on demand
- **Promise memoization**: Use useMemo to create promises in client components for session contents
- **Organization scoping**: All queries properly scoped to active organization

### UI/UX Patterns
- **Compact cards**: Minimal padding, clear hierarchy, efficient use of space
- **Progressive disclosure**: Empty states → session list → session contents → item details
- **Consistent interactions**: Click to select, visual feedback for selected items

### State Management
- **URL as source of truth**: All selection state reflected in URL for shareability
- **Graceful degradation**: Handle missing/invalid URL parameters gracefully
- **Loading states**: Proper suspense boundaries and loading indicators

## Potential Challenges & Solutions

### Challenge: Complex data relationships
**Solution**: Leverage existing schema relationships and indexes, use LEFT JOINs for optional data

### Challenge: Performance with large datasets
**Solution**: Implement pagination for sessions list, lazy load session contents

### Challenge: Responsive design complexity
**Solution**: Use CSS Grid and Flexbox with clear breakpoints, test thoroughly

### Challenge: State synchronization
**Solution**: Use nuqs for automatic URL sync, implement proper error boundaries

## Success Criteria

1. ✅ **User Story 1**: Three-pane interface with sessions list and placeholders
2. ✅ **User Story 2**: Loading indicators and session contents display
3. ✅ **User Story 3**: Item details in right pane
4. ✅ **User Story 4**: URL state reflection for shareability
5. ✅ **User Story 5**: URL parameters set initial state correctly

## Notes & Decisions Log

### 2025-01-21 - Initial Planning
- Decided to use nuqs for URL state management based on requirements
- Will leverage existing shadcn/ui ResizablePanelGroup for three-pane layout
- Maintaining existing React 19 promise patterns for consistency
- Planning session-first data architecture for better performance

---

**Next Steps**: Begin Phase 1 with data layer implementation, starting with getUserSessions function.