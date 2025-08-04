---
date: 2025-08-03T22:48:35-07:00
researcher: Claude
last_updated: 2025-08-03
last_updated_by: Claude
type: technical_analysis
topic: "Step Reordering Resilience in Walkthrough Progress Tracking"
tags: [walkthroughs, progress-tracking, step-reordering, database-design, resilience]
---

# Step Reordering Resilience Analysis

## Current Implementation Overview

After analyzing the walkthrough progress tracking system in the MCPlatform codebase, here's how next step calculation and progress tracking currently works:

### Database Schema (from `/packages/database/src/schema.ts`)

**`walkthrough_steps` table:**
- `id`: Primary key (e.g., `wts_abc123`)
- `walkthrough_id`: References parent walkthrough
- `display_order`: Integer for step ordering
- `next_step_id`: Self-referential foreign key (currently unused)
- `title`, `content_fields`, etc.

**`walkthrough_progress` table:**
- `id`: Primary key
- `mcp_server_user_id`: User identifier 
- `walkthrough_id`: References walkthrough
- `completed_steps`: JSON array of step IDs (e.g., `["wts_abc123", "wts_def456"]`)
- `current_step_id`: References current step (exists but **currently unused**)
- `started_at`, `last_activity_at`, `completed_at`: Timestamps

### Current Next Step Algorithm (`calculateNextStep` in `walkthrough-utils.ts`)

```typescript
// Lines 64-100: Core algorithm
1. Query all steps for walkthrough ordered by `display_order` ASC
2. Get user's `completed_steps` array from progress record
3. Find first step in ordered list that's NOT in completed_steps array
4. Return that step as "next step"
```

**Key Implementation Details:**
- Progress tracking is based on **step IDs**, not positions/order
- Uses `display_order` field to determine step sequence
- Completed steps stored as array of step IDs in JSON column
- Algorithm: "Find first uncompleted step in display order"

## Resilience Analysis

### ✅ **RESILIENT TO:**

**1. Step Reordering**
- **How it works**: If admin changes `display_order` values, the algorithm re-queries with `ORDER BY display_order ASC` and finds the first uncompleted step in the new order
- **Example**: Steps A(order:1), B(order:2), C(order:3) → User completes A → Admin reorders to B(order:1), A(order:2), C(order:3) → Algorithm correctly returns B as next step
- **Why it works**: Progress is tracked by immutable step IDs, not order positions

**2. Step Addition (Middle/End)**
- **How it works**: New steps get new IDs and `display_order` values, algorithm naturally incorporates them
- **Example**: Steps A, B, C → User completes A → Admin adds step D between A and B → Algorithm returns D as next step (if D has `display_order` between A and B)
- **Why it works**: New steps won't be in `completed_steps` array, so they'll be candidates for "next step"

### ⚠️ **PARTIALLY RESILIENT TO:**

**3. Step Deletion**
- **Current behavior**: Deleted step IDs remain in `completed_steps` array as "ghost references"
- **Impact**: No functional breakage - deleted step IDs are simply ignored when finding next step
- **Issue**: Data bloat over time with orphaned step IDs in progress records
- **Improvement needed**: Cleanup mechanism to remove deleted step IDs from progress records

### ❌ **POTENTIAL ISSUES:**

**4. Major Restructuring**
- **Scenario**: Admin completely restructures walkthrough (e.g., removes 80% of steps, adds new ones)
- **Current behavior**: User might appear to have completed most of a "new" walkthrough if they completed the few surviving steps
- **Impact**: Progress percentage calculations could be misleading
- **Example**: 10-step walkthrough → User completes 5 steps → Admin restructures to 3 steps (keeping 2 completed ones) → User shows 66% complete on "new" walkthrough

**5. Duplicate Content with Different IDs**
- **Scenario**: Admin deletes and recreates step with same content but new ID
- **Current behavior**: User loses progress on that step (must complete again)
- **Impact**: User experience degradation

## Current Progress Tracking Strengths

1. **ID-based tracking**: Using immutable step IDs instead of positions is architecturally sound
2. **Order flexibility**: `display_order` field allows easy reordering without data migration
3. **JSON array storage**: Efficient storage and GIN indexing for completed steps queries
4. **No cascading deletes**: System doesn't break when steps are deleted

## Areas for Improvement

### Immediate Improvements (Low Risk)

1. **Cleanup orphaned step IDs**: Periodic job to remove deleted step IDs from progress records
2. **Better progress calculation**: Account for deleted steps when calculating percentages
3. **Use `current_step_id` field**: Currently exists in schema but unused - could improve performance

### Advanced Improvements (Higher Risk)

1. **Step versioning**: Track step changes to maintain more granular progress history
2. **Content-based matching**: Detect when step content is similar across restructures
3. **Progress migration tools**: Admin UI to help migrate user progress during major restructures

## Conclusion

**The current system is remarkably resilient to common step management operations:**

- ✅ **Step reordering**: Fully supported
- ✅ **Step addition**: Fully supported  
- ⚠️ **Step deletion**: Functional but with data bloat
- ❌ **Major restructuring**: Can cause misleading progress indicators

**Key insight**: The ID-based approach with `display_order` sequencing is a solid architectural choice that handles the most common admin operations (reordering, adding steps) without any issues.

The main limitation is handling major restructures, but this is inherently complex in any progress tracking system and may require admin intervention/tools rather than automatic handling.

**Recommendation**: The current approach is sound and doesn't need a complete overhaul. Focus on incremental improvements like orphaned ID cleanup and better progress calculations rather than architectural changes.