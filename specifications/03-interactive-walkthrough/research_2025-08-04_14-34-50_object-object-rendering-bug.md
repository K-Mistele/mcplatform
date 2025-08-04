---
date: 2025-08-04T14:34:50-07:00
researcher: Claude
git_commit: ae91c82ba394cff6780c8596c7abb832561f5003
branch: master
repository: mcplatform
topic: "Walkthrough Title Rendering as [object Object] Bug Analysis"
tags: [research, codebase, walkthrough, template-rendering, bug-analysis]
status: complete
last_updated: 2025-08-04
last_updated_by: Claude
type: research
---

# Research: Walkthrough Title Rendering as [object Object] Bug Analysis

**Date**: 2025-08-04T14:34:50-07:00  
**Researcher**: Claude  
**Git Commit**: ae91c82ba394cff6780c8596c7abb832561f5003  
**Branch**: master  
**Repository**: mcplatform

## Research Question
Why is the walkthrough title being rendered as "[object Object]" in the user interface, even though it's specified as a string, while the rest of the template renders properly?

## Summary
The bug is caused by a parameter type mismatch in the RPC handler at `packages/dashboard/src/lib/orpc/router.ts:502`. The handler passes the entire `walkthrough` object to `renderWalkthroughStep()`, but the function expects only a string (`walkthroughTitle`). When JavaScript coerces the object to a string for template interpolation, it produces "[object Object]".

## Detailed Findings

### Root Cause - RPC Handler Bug

The bug is located at `packages/dashboard/src/lib/orpc/router.ts:502`:

```typescript
// Current (buggy) implementation:
return renderWalkthroughStep(input.walkthrough as any, input.step as any)

// Should be:
return renderWalkthroughStep(input.walkthrough.title, input.step as any)
```

The template engine function signature expects:
```typescript
export function renderWalkthroughStep(walkthroughTitle: string, step: WalkthroughStep): string
```

### Data Flow Analysis

1. **Client Component** (`packages/dashboard/src/components/preview-panel.tsx:34-46`)
   - Calls `client.walkthrough.renderStep` with walkthrough object containing `title`, `description`, and `type`
   - Expects rendered template string back

2. **RPC Endpoint** (`packages/dashboard/src/lib/orpc/router.ts:485-503`)
   - Validates input with proper schema (walkthrough.title is a string)
   - **BUG**: Handler passes entire `input.walkthrough` object instead of `input.walkthrough.title`

3. **Template Engine** (`packages/dashboard/src/lib/template-engine.ts:100-114`)
   - Expects `walkthroughTitle: string` as first parameter
   - Uses it in template at line 26: `# Walkthrough: ${walkthroughTitle}`
   - When object is passed, JavaScript's string coercion produces "[object Object]"

### UI Components Structure

The walkthrough editor consists of three resizable panels:
- **Steps Navigator** (25% width) - Step management and reordering
- **Content Editor** (50% width) - Form-based content editing
- **Preview Panel** (25% width) - Real-time template rendering

### Database Schema

**Walkthrough Table** (`packages/database/src/schema.ts:183-206`):
- `title: text` - The string field that should be used
- `type: enum` - Walkthrough type (course, installer, etc.)
- `status: enum` - Draft/published/archived

**WalkthroughStep Table** (`packages/database/src/schema.ts:232-260`):
- `contentFields: jsonb` - Structured content with 4 optional fields
- `displayOrder: integer` - For step sequencing

## Code References
- `packages/dashboard/src/lib/orpc/router.ts:502` - The bug location
- `packages/dashboard/src/lib/template-engine.ts:100` - Function expecting string parameter
- `packages/dashboard/src/lib/template-engine.ts:26` - Template interpolation using walkthroughTitle
- `packages/dashboard/src/components/preview-panel.tsx:34` - Client RPC call
- `packages/dashboard/src/components/walkthrough-editor.tsx:72` - UI correctly displays title

## Architecture Insights

1. **Type Safety Gap**: The `as any` type assertions bypass TypeScript's type checking, allowing this mismatch
2. **Separation of Concerns**: The template engine is properly designed to accept simple parameters, not complex objects
3. **Preview System**: Real-time preview updates work correctly once the parameter is fixed

## Historical Context (from thoughts/)

From `specifications/03-interactive-walkthrough/thoughts/implementation-progress.md`:
- The walkthrough system was recently implemented (July-August 2025)
- Known bugs include empty schema registration and race conditions (now fixed)
- The template engine uses Nunjucks for conditional sections and AI-optimized output
- Architecture decision: Many-to-many relationship between walkthroughs and MCP servers

## Related Research
- `specifications/03-interactive-walkthrough/thoughts/v1-architecture-decisions.md` - Core architectural decisions
- `specifications/03-interactive-walkthrough/thoughts/implementation-progress.md` - Known issues and bugs

## Open Questions
None - the bug cause is clearly identified and the fix is straightforward.

## Fix Implementation
To fix this bug, change line 502 in `packages/dashboard/src/lib/orpc/router.ts` from:
```typescript
return renderWalkthroughStep(input.walkthrough as any, input.step as any)
```
to:
```typescript
return renderWalkthroughStep(input.walkthrough.title, input.step as any)
```

This ensures the template engine receives the string title it expects rather than the full walkthrough object.