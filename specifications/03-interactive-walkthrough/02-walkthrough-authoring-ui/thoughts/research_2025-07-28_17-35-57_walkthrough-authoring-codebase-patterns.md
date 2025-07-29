---
date: 2025-07-28T17:35:57-05:00
researcher: Claude
git_commit: b42b8db356cb88ec7bc73b8abf4225a442cad0e2
branch: master
repository: mcplatform
topic: "Walkthrough Authoring UI: Codebase Patterns & Implementation Guide"
tags: [research, codebase, walkthrough-authoring, orpc, database, ui-patterns, backend]
status: complete
last_updated: 2025-07-28
last_updated_by: Claude
type: research
---

# Research: Walkthrough Authoring UI - Codebase Patterns & Implementation Guide

**Date**: 2025-07-28T17:35:57-05:00  
**Researcher**: Claude  
**Git Commit**: b42b8db356cb88ec7bc73b8abf4225a442cad0e2  
**Branch**: master  
**Repository**: mcplatform

## Research Question

Deeply research the MCPlatform codebase to understand the relevant oRPC, database, UI, and backend patterns needed for implementing the walkthrough authoring UI, and provide recommendations for updating the implementation plan.

## Summary

This research reveals a sophisticated, well-architected codebase with established patterns that provide an excellent foundation for the walkthrough authoring UI. The key findings include a dual authentication system, comprehensive oRPC patterns, React 19 server component architecture, structured content management, and sophisticated MCP tool integration. The backend infrastructure is complete, while the frontend requires implementation following established architectural patterns.

## Detailed Findings

### oRPC Architecture & Server Actions

**Server Actions Pattern** (`packages/dashboard/src/lib/orpc/actions.ts`):
- All server actions use `'use server'` directive with consistent pattern
- Base router provides typed error definitions: `UNAUTHORIZED`, `RESOURCE_NOT_FOUND`, `INVALID_SUBDOMAIN`, `SUBDOMAIN_ALREADY_EXISTS`
- Standard pattern: `base.input(zodSchema).handler(async ({ input, errors }) => { ... }).actionable({})`
- Organization scoping security: Every operation validates `session.session.activeOrganizationId`
- Systematic `revalidatePath()` usage for cache invalidation after mutations

**Client-Side Usage Pattern**:
```typescript
const { execute, status } = useServerAction(actionName, {
    interceptors: [
        onSuccess(() => toast.success('Success')),
        onError((error) => {
            if (isDefinedError(error)) {
                toast.error(error.message) // Strongly-typed errors
            }
        })
    ]
})
```

### Database Architecture & Schemas

**Dual Authentication System**:
- **Platform Auth** (`auth-schema.ts`): Dashboard users with organization multi-tenancy
- **Sub-tenant Auth** (`mcp-auth-schema.ts`): End-user identification with parallel `mcp_oauth_` tables
- Complete isolation between customer management and end-user tracking

**Walkthrough Schema** (`schema.ts:167-267`):
- `walkthroughs`: Core metadata with organization scoping
- `walkthroughSteps`: Structured content using versioned JSONB fields
- `walkthroughProgress`: User progress tracking with resilient step arrays
- `mcpServerWalkthroughs`: Many-to-many server assignment

**Structured Content Fields** (versioned for future evolution):
```typescript
contentFields: {
    version: 'v1',
    introductionForAgent: string,  // Context about step objectives
    contextForAgent: string,       // Background info and search terms
    contentForUser: string,        // Required user-facing content
    operationsForAgent: string     // Specific AI agent actions
}
```

### UI Patterns & Component Architecture

**Server + Client Component Pattern**:
- **Server Components** (pages): Async data fetching with promise-based data passing
- **Client Components**: React 19 `use()` hook to unwrap promises
- **Consistent wrapping**: `ErrorBoundary` + `Suspense` for all async operations

**Navigation System** (`app-sidebar.tsx`):
- Static configuration with `@tabler/icons-react` icons
- Active state detection using `usePathname()`
- Organization-aware header with user profile integration

**Data Table Patterns** (`mcp-servers-table.tsx`):
- Full TanStack Table implementation with selection, sorting, filtering
- Custom cell renderers with action buttons
- Integrated modal patterns for CRUD operations

**Three-Panel Layout Examples**:
- ResizablePanelGroup pattern in user detail pages
- Responsive breakpoints with container queries (`@container/main`)
- Panel collapsing on mobile with sidebar integration

### Backend Infrastructure & MCP Tools

**MCP Tool Architecture** (`lib/mcp/tools/walkthrough.ts`):
- 5 fully implemented tools: `list_walkthroughs`, `get_current_step`, `complete_step`, etc.
- Consistent JSON response format with `content[].text` structure
- Database integration with tool call tracking for analytics
- Registry pattern combining tool definitions and handlers

**VHost-Based Routing** (`lib/mcp/index.ts:118-160`):
- Subdomain extraction from Host header for multi-tenancy
- Database lookup mapping subdomain to MCP server configuration
- Security validation preventing direct application domain access

**Walkthrough Business Logic** (`lib/mcp/walkthrough-utils.ts`):
- Progress-preserving step calculation algorithm
- Sophisticated user identification and tracking
- Complete CRUD operations with proper error handling

## Code References

- `packages/dashboard/src/lib/orpc/actions.ts:21-37` - Server action pattern with organization scoping
- `packages/dashboard/src/lib/orpc/router.ts:7-12` - Error definitions and base router
- `packages/database/src/schema.ts:212-240` - Walkthrough steps with structured content
- `packages/dashboard/src/components/app-sidebar.tsx:31-72` - Navigation structure
- `packages/dashboard/src/components/mcp-servers-table.tsx:173-363` - TanStack Table implementation
- `packages/dashboard/src/lib/mcp/tools/walkthrough.ts:17-426` - Complete MCP tool suite
- `packages/dashboard/src/lib/mcp/walkthrough-utils.ts:326-374` - Progress tracking utilities

## Architecture Insights

1. **Strict Security Model**: Organization scoping on every database operation prevents tenant data leakage
2. **React 19 Architecture**: Promise-based data passing enables server-side optimization with client-side interactivity
3. **Type Safety**: Heavy use of Zod schemas with TypeScript inference throughout the stack
4. **Content Versioning**: Structured JSONB fields with version discriminated unions for future evolution
5. **Dual Authentication**: Complete separation between platform users and end-user tracking
6. **MCP Integration**: Sophisticated tool registry with analytics tracking and structured content rendering

## Historical Context (from specifications/)

### Design Evolution
- **Architectural Shift**: Modal-based editing rejected in favor of full-page three-panel editor
- **Content Structure Innovation**: Four-field approach specifically designed for AI agent optimization
- **Template System**: Nunjucks rendering for consistent AI agent instruction formatting

### Implementation Status
- **Backend**: Fully implemented with comprehensive test coverage (40 tests)
- **Frontend**: Needs implementation following established patterns
- **MCP Tools**: Complete and production-ready

### Key Learnings from Mastra Research
- Local-first state with server sync for reliability
- Progressive disclosure with hierarchical content structure
- Content evolution support without losing user progress

## Open Questions

1. **Nunjucks Integration**: Current implementation uses simple string concatenation; Nunjucks templates would provide more sophisticated rendering
2. **Step Reordering**: Drag-and-drop functionality not yet implemented in existing tables
3. **Auto-save Strategy**: Implementation plan specifies manual save, but debounced auto-save could improve UX
4. **Mobile Responsiveness**: Three-panel layout needs mobile optimization strategy

## Related Research

- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/implementation-plan.md` - Comprehensive implementation strategy
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/thoughts/structured-content-architecture.md` - Four-field content design
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/thoughts/ui-ux-recommendations.md` - Full-page editor rationale