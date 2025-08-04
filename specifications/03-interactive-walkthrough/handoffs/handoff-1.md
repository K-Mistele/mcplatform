---
date: 2025-08-04T14:30:00-07:00
researcher: Kyle
git_commit: 5e9c8c3
branch: master
repository: mcplatform
topic: "MCP Walkthrough - Automatic Step Advancement & Analytics"
tags: [walkthroughs, mcp-tools, automatic-advancement, analytics, progress-tracking]
status: focused
last_updated: 2025-08-04
last_updated_by: Claude  
type: implementation_handoff
---

# Handoff: Automatic Step Advancement & Enhanced Analytics

## Focus Areas

This handoff focuses specifically on:
- **Requirement #2**: Automatic Step Advancement
- **Requirement #4**: Enhanced Progress Analytics

These requirements fall under:
- `specifications/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/`
- `specifications/03-interactive-walkthrough/05-walkthrough-analytics/`

## Requirement #2: Automatic Step Advancement

### Current State
- **Status**: ❌ Not implemented
- **Current Behavior**: `get_next_step` requires `current_step_id` parameter from client
- **Problem**: Client must manually track which step the user is on

### Required Implementation

#### Backend Changes
1. **Database Schema Update**:
   - Add `current_step_id` field to `walkthrough_progress` table
   - This tracks user's current position in each walkthrough

2. **`start_walkthrough` Tool Enhancement**:
   - When starting a walkthrough, set `current_step_id` to the first step
   - Update existing progress record or create new one
   - Return the first step details to the client

3. **`get_next_step` Tool Modification**:
   - Remove `current_step_id` parameter requirement
   - Query user's current step from `walkthrough_progress` table
   - Automatically advance to next step in database
   - Return the next step details
   - Handle edge cases: last step, invalid progress state

### Implementation Details

```typescript
// Current implementation (requires current_step_id)
get_next_step: {
    input: z.object({
        walkthrough_id: z.string(),
        current_step_id: z.string() // TO BE REMOVED
    })
}

// Target implementation (automatic advancement)
get_next_step: {
    input: z.object({
        walkthrough_id: z.string()
        // No current_step_id needed - fetched from database
    })
}
```

## Requirement #4: Enhanced Progress Analytics

### Current State
- **Status**: 🔶 Partially implemented
- **Existing**: Basic action tracking for `start_walkthrough` (list, auto_start, invalid_name, start_named)
- **Missing**: Comprehensive step-by-step analytics and progress tracking

### Required Analytics Events

#### 1. Walkthrough Start Events
- **Already Implemented**: ✅
  - Tracks when user starts walkthrough
  - Records action type (list, auto_start, invalid_name, start_named)
  - Includes server ID and timestamp

#### 2. Step Progression Events (NEW)
- **Event**: `get_next_step` called
- **Data to Track**:
  - Current step ID (where user was)
  - Next step ID (where user is going)
  - Walkthrough ID
  - Server ID
  - Timestamp
  - Time spent on current step

#### 3. Progress Reset Events (NEW)
- **Event**: User resets walkthrough progress
- **Data to Track**:
  - Walkthrough ID
  - Last completed step before reset
  - Total progress percentage
  - Server ID
  - Timestamp

#### 4. Walkthrough Listing Events (NEW)
- **Event**: User lists available walkthroughs
- **Data to Track**:
  - Server ID
  - Number of walkthroughs shown
  - Timestamp
  - Whether it led to a start action

### Analytics Integration Requirements

#### Database Schema for Analytics
```typescript
// Extend existing analytics tables or create new ones:
// walkthrough_analytics_events
{
    id: string
    organization_id: string
    server_id: string
    session_id: string
    user_id: string
    event_type: 'start' | 'next_step' | 'reset' | 'list' | 'complete'
    walkthrough_id: string | null
    from_step_id: string | null
    to_step_id: string | null
    metadata: json // Additional event-specific data
    timestamp: bigint
}
```

#### Sankey Diagram Support
Data structure needed for user flow visualization:
- Node types: walkthrough steps, "start", "end", "drop-off"
- Link data: user count flowing between nodes
- Support for both intra-walkthrough (step-to-step) and inter-walkthrough flows

### Implementation in Tools

```typescript
// In get_next_step handler
const currentStep = await getProgressCurrentStep(userId, walkthroughId)
const nextStep = await getNextStepInSequence(walkthroughId, currentStep?.id)

// Track analytics event
await trackAnalyticsEvent({
    event_type: 'next_step',
    from_step_id: currentStep?.id,
    to_step_id: nextStep?.id,
    walkthrough_id: walkthroughId,
    // ... other fields
})

// Update user's current step
await updateProgressCurrentStep(userId, walkthroughId, nextStep.id)
```

## Technical Implementation Details

### Database Schema Updates

#### 1. Modify `walkthrough_progress` table:
```sql
ALTER TABLE walkthrough_progress 
ADD COLUMN current_step_id TEXT REFERENCES walkthrough_steps(id);
```

#### 2. Create analytics events table:
```sql
CREATE TABLE walkthrough_analytics_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    server_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT,
    event_type TEXT NOT NULL,
    walkthrough_id TEXT,
    from_step_id TEXT,
    to_step_id TEXT,
    metadata JSONB,
    created_at BIGINT NOT NULL
);
```

### Files to Modify

#### Core Implementation Files:
1. **`packages/dashboard/src/lib/mcp/tools/walkthrough.ts`**
   - Modify `get_next_step` to remove `current_step_id` parameter
   - Add automatic step advancement logic
   - Enhance analytics tracking

2. **`packages/database/src/schema.ts`**
   - Add `current_step_id` to `walkthrough_progress` table
   - Add `walkthrough_analytics_events` table

3. **`packages/dashboard/src/lib/mcp/walkthrough-utils.ts`**
   - Add functions for getting/setting current step
   - Add analytics event tracking utilities

#### Test Files:
- `packages/dashboard/tests/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/walkthrough-mcp-tools.test.ts`
- Update to test automatic advancement behavior

## Implementation Priority

### Phase 1: Automatic Step Advancement
1. Update database schema with `current_step_id`
2. Implement backend progress tracking in tools
3. Remove `current_step_id` parameter requirement
4. Update tests for new behavior

### Phase 2: Enhanced Analytics
1. Create analytics events table
2. Add comprehensive event tracking to all tools
3. Implement analytics query functions
4. Prepare data structures for Sankey diagram visualization

## Success Criteria

### For Automatic Step Advancement
- [ ] User can call `get_next_step` without providing current step
- [ ] System correctly tracks and advances user progress
- [ ] Progress persists across sessions
- [ ] Edge cases handled (last step, invalid state)

### For Enhanced Analytics  
- [ ] All user interactions tracked with appropriate detail
- [ ] Analytics data supports Sankey diagram generation
- [ ] Integration with existing analytics system
- [ ] Real-time event processing

## Key Benefits

### Automatic Step Advancement
- **Simplified Client Logic**: No need to track current step on client side
- **Persistent Progress**: Users can resume from where they left off
- **Better Error Handling**: Server knows exact user state

### Enhanced Analytics
- **Complete User Journey Tracking**: Every interaction captured
- **Visual Flow Analysis**: Sankey diagrams show user paths
- **Drop-off Insights**: Identify where users struggle
- **Data-Driven Improvements**: Optimize walkthrough content based on analytics