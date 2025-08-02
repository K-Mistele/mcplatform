---
date: 2025-08-02T17:46:53-05:00
researcher: claude-opus-4-20250514
git_commit: b259f4c9cf8c492777b7144706e2e48a176a22be
branch: master
repository: mcplatform
topic: "How to change walkthrough from draft to published mode in UI"
tags: [research, codebase, walkthroughs, publishing, ui, status-management]
status: complete
last_updated: 2025-08-02
last_updated_by: claude-opus-4-20250514
type: research
---

# Research: How to change walkthrough from draft to published mode in UI

**Date**: 2025-08-02T17:46:53-05:00
**Researcher**: claude-opus-4-20250514
**Git Commit**: b259f4c9cf8c492777b7144706e2e48a176a22be
**Branch**: master
**Repository**: mcplatform

## Research Question
Can you please tell me once a walkthrough is created e.g. in draft mode, how I can change the mode of it to be "published"? Please dig into it and let me know if/how it is possible in the UI presently; I can't find it

## Summary
**Currently, there is NO UI functionality to change a walkthrough from draft to published mode after creation.** While the backend fully supports status updates through the `updateWalkthroughAction`, the UI only provides a "Publish Immediately" checkbox during walkthrough creation. No publish/unpublish buttons or toggles exist in the editor or settings pages.

## Detailed Findings

### Backend Infrastructure (Fully Ready)

The backend has complete support for publishing/unpublishing walkthroughs:

1. **Database Schema** (`packages/database/src/schema.ts:47,194`)
   - Status enum: `['draft', 'published', 'archived']`
   - Default status: `'draft'`
   - Indexed for efficient queries

2. **Server Actions** (`packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:39-80`)
   - `updateWalkthroughAction` accepts `isPublished: boolean` parameter
   - Maps boolean to status: `true` → `'published'`, `false` → `'draft'`
   - Properly validates organization ownership
   - Revalidates paths after updates

### UI Components Analysis

1. **Creation Modal** (`packages/dashboard/src/components/create-walkthrough-modal.tsx:191-195`)
   - ✅ Has "Publish Immediately" checkbox
   - Works correctly for immediate publishing on creation

2. **Walkthroughs List** (`packages/dashboard/src/components/walkthroughs-client.tsx:140-142`)
   - ✅ Shows status badge (Published/Draft)
   - ❌ No action to change status

3. **Editor Page** (`packages/dashboard/src/components/walkthrough-editor.tsx`)
   - ❌ No publish/unpublish button
   - Only shows "Saved" indicator
   - No status management controls

4. **Settings Page** (`packages/dashboard/src/app/dashboard/walkthroughs/[walkthroughId]/settings/page.tsx`)
   - ❌ Only manages server assignments
   - No status control functionality

### MCP Integration Impact

Published status directly affects end-user visibility:
- Only `status='published'` walkthroughs are available to MCP servers (`packages/dashboard/src/lib/mcp/index.ts:175`)
- Draft walkthroughs remain completely hidden from end-users

### Historical Context (from thoughts/)

The design documents indicate publishing controls were planned:
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/feature.md`: Mentions "Publish Changes" button
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/implementation-plan.md`: Shows publish toggle in specs
- `specifications/03-interactive-walkthrough/thoughts/ui-ideation.md`: Describes publishing workflow

## Code References
- `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:46` - Update action with isPublished support
- `packages/dashboard/src/components/create-walkthrough-modal.tsx:195` - Working publish checkbox
- `packages/dashboard/src/components/walkthroughs-client.tsx:140` - Status badge display
- `packages/dashboard/src/components/walkthrough-editor.tsx` - Editor missing publish controls
- `packages/dashboard/src/app/dashboard/walkthroughs/[walkthroughId]/settings/page.tsx` - Settings page without status controls

## Architecture Insights
1. **Clean Separation**: Backend uses boolean API (`isPublished`) while database uses enum for future extensibility
2. **Safety First**: Walkthroughs default to draft to prevent accidental publishing
3. **Immediate Effect**: Status changes trigger path revalidation for instant updates
4. **Missing Link**: UI implementation gap despite complete backend support

## UI Screenshots
- **Walkthroughs List**: Shows draft badge but no action to change it
- **Editor Page**: Has save indicator but no publish button
- **Settings Page**: Only handles server assignments, not status

## Open Questions
1. Was the publish button intentionally omitted from MVP?
2. Should publish control be in the editor header, settings page, or both?
3. Should there be a confirmation dialog for publishing/unpublishing?
4. Should archived status be exposed in the UI?

## Recommendation
To enable publishing in the UI, add a status toggle in either:
1. **Editor Header**: Quick access while editing content
2. **Settings Page**: Deliberate action in dedicated settings area
3. **Both**: Maximum flexibility for users

The implementation would be straightforward since all backend infrastructure exists - just need to add UI controls that call `updateWalkthroughAction` with the `isPublished` parameter.