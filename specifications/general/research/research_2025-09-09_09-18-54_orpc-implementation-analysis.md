---
date: 2025-09-09T09:18:54-05:00
researcher: claude
git_commit: e6cc18672e9e31c5121252df6bdad18f72758096
branch: master
repository: mcplatform
topic: "How does oRPC work in the codebase? Check out the docs/ directory"
tags: [research, codebase, orpc, api, server-actions, client-server-communication]
status: complete
last_updated: 2025-09-09
last_updated_by: claude
type: research
---

# Research: How does oRPC work in the MCPlatform codebase?

**Date**: 2025-09-09T09:18:54-05:00  
**Researcher**: claude  
**Git Commit**: e6cc18672e9e31c5121252df6bdad18f72758096  
**Branch**: master  
**Repository**: mcplatform  

## Research Question

How does oRPC work in the MCPlatform codebase? What are the implementation patterns, architecture decisions, and usage examples throughout the system?

## Summary

MCPlatform uses oRPC as its primary RPC framework with a dual-pattern approach:

1. **Server Actions** (`.actionable({})`) - For data mutations from forms with automatic validation, error handling, and cache revalidation
2. **Client RPC Calls** - For direct data fetching from client components with manual state management

The system implements a sophisticated type-safe architecture with standardized error handling, multi-tenant security, and comprehensive documentation coverage. All actions follow consistent patterns of authentication → authorization → business logic → revalidation.

## Detailed Findings

### oRPC Architecture Overview

**Entry Points**:
- `packages/dashboard/src/lib/orpc/orpc.server.ts:7` - Global server-side client using `createRouterClient`
- `packages/dashboard/src/lib/orpc/orpc.client.ts:23` - Browser client configuration with `createORPCClient`
- `packages/dashboard/src/app/rpc/[[...rest]]/route.ts:4` - HTTP handler setup using `RPCHandler`

**Base Configuration** (`packages/dashboard/src/lib/orpc/router.ts:8-13`):
```typescript
export const base = os.errors({
    UNAUTHORIZED: {},
    RESOURCE_NOT_FOUND: {},
    INVALID_SUBDOMAIN: {},
    SUBDOMAIN_ALREADY_EXISTS: {}
})
```

### Dual Pattern Implementation

#### 1. Server Actions Pattern
**Location**: `packages/dashboard/src/lib/orpc/actions/`

**Standard Structure**:
```typescript
export const actionName = base
    .input(zodSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()  // Authentication
        // Authorization checks
        // Business logic
        revalidatePath('/path')  // Cache invalidation
        return result
    })
    .actionable({})  // Converts to Next.js server action
```

**Domain-Specific Action Files**:
- `organization.ts` - Team and member management (6 actions)
- `mcp-servers.ts` - MCP server CRUD operations (5 actions)  
- `walkthroughs.ts` - Interactive walkthrough management (7 actions)
- `support-tickets.ts` - Support ticket status updates (2 actions)
- `walkthrough-assignment.ts` - Server assignment operations (3 actions)

#### 2. Client RPC Calls Pattern
**Router Structure** (`packages/dashboard/src/lib/orpc/router.ts:508-529`):
```typescript
export const router = {
    example: { execute: executeExample },
    toolCalls: { getChart: getToolCallsChart },
    sessions: { getToolCalls: getSessionToolCalls, getSupportTickets: getSessionSupportTickets },
    supportTickets: { getActivities: getSupportTicketActivities, getWithMcpUser: getSupportTicketWithMcpUser },
    organization: { getMembers: getOrganizationMembers },
    walkthrough: { renderStep: renderWalkthroughStepRPC }
}
```

### Client-Side Usage Patterns

#### Pattern 1: Form Submission with Server Actions
**Example**: `packages/dashboard/src/components/add-server-modal.tsx:49-86`
```typescript
const { execute, status } = useServerAction(createMcpServerAction, {
    interceptors: [
        onSuccess((result) => {
            toast.success('MCP server created successfully')
            router.push(`/dashboard/mcp-servers/${result.id}`)
        }),
        onError((error) => {
            if (isDefinedError(error)) {
                toast.error(error.message)
            }
        })
    ]
})
```

#### Pattern 2: Direct Client RPC Calls
**Example**: `packages/dashboard/src/components/chart-area-interactive.tsx:30-46`
```typescript
const result = await client.toolCalls.getChart({ timeRange: '1d' })
setChartData(result.data)
```

#### Pattern 3: Real-time Validation
**Example**: `packages/dashboard/src/components/add-server-modal.tsx:71-86`
```typescript
const { execute: validateSlug } = useServerAction(validateSubdomainAction, {
    interceptors: [
        onSuccess(() => setSlugValidationError(null)),
        onError((error) => setSlugValidationError(error.message))
    ]
})
```

### Security and Authentication

**Multi-Tenant Security Pattern**:
```typescript
const session = await requireSession()
// Organization scoping
.where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
```

**Role-Based Authorization** (`packages/dashboard/src/lib/orpc/actions/organization.ts:142-146`):
```typescript
if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
    throw errors.UNAUTHORIZED({ message: 'Insufficient permissions' })
}
```

### Cache Management

**Strategic Path Revalidation**:
- Single path: `revalidatePath('/dashboard/mcp-servers')`
- Multiple paths: `revalidatePath('/dashboard/team/invitations'); revalidatePath('/dashboard/team')`
- Dynamic paths: `revalidatePath('/dashboard/mcp-servers/${input.serverId}')`

### Error Handling

**Typed Error Responses**:
```typescript
throw errors.SUBDOMAIN_ALREADY_EXISTS({
    message: 'Server slug already exists. Server slugs must be globally unique.'
})
```

**Client-Side Error Handling**:
```typescript
onError((error) => {
    if (isDefinedError(error)) {
        // Structured server error with guaranteed properties
        toast.error(error.message)
    } else {
        // Generic/unexpected error
        toast.error('Network error. Please try again.')
    }
})
```

## Code References

### Core Infrastructure
- `packages/dashboard/src/lib/orpc/router.ts:8-13` - Base error definitions
- `packages/dashboard/src/lib/orpc/router.ts:508-529` - Complete router export
- `packages/dashboard/src/lib/orpc/orpc.server.ts:7` - Global server client
- `packages/dashboard/src/lib/orpc/orpc.client.ts:23` - Browser client configuration
- `packages/dashboard/src/app/rpc/[[...rest]]/route.ts:6-12` - HTTP handler setup

### Server Actions Implementation
- `packages/dashboard/src/lib/orpc/actions/organization.ts:115-206` - Role update action with authorization
- `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:61-82` - Subdomain validation logic
- `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:171-237` - Content field merging pattern
- `packages/dashboard/src/lib/orpc/actions/support-tickets.ts:62-63` - Multi-path revalidation

### Client Usage Examples
- `packages/dashboard/src/components/add-server-modal.tsx:49-86` - Form submission with navigation
- `packages/dashboard/src/components/chart-area-interactive.tsx:30-46` - Direct RPC calls with loading states
- `packages/dashboard/src/components/user-detail-client.tsx:112-115` - Parallel data fetching with Promise.all
- `packages/dashboard/src/components/edit-server-configuration.tsx:127-199` - Toggle edit mode pattern

### Complex Data Processing
- `packages/dashboard/src/lib/orpc/router.ts:30-148` - Analytics endpoint with time-series processing
- `packages/dashboard/src/lib/orpc/router.ts:191-274` - Dynamic interval calculation and bucket alignment
- `packages/dashboard/src/lib/orpc/router.ts:442-486` - Cross-auth-system user data joining

## Architecture Insights

### Design Patterns
- **Factory Pattern**: Base router factory for consistent error handling
- **Template Method**: Standardized `.actionable({})` conversion
- **Strategy Pattern**: Flexible authentication (organization required vs optional)
- **Chain of Responsibility**: Input → Auth → Authorization → Logic → Revalidation

### Type Safety Strategy
- Zod schema validation for all inputs
- Strongly-typed error responses with `isDefinedError()` guards  
- TypeScript inference across client-server boundary
- Automatic type generation for RPC endpoints

### Performance Optimizations
- Parallel client RPC calls with `Promise.all()`
- Strategic cache revalidation targeting specific paths
- Efficient database joins through organization relationships
- Time-series data bucketing with deduplication

### Multi-Tenancy Implementation
- Organization-scoped filtering on all queries
- Session-based context injection
- Role-based authorization checks
- Resource ownership verification patterns

## Historical Context (from specifications/)

### Implementation Evolution
Based on 15 relevant documents in specifications/, oRPC was adopted early with consistent patterns:
- **Established Pattern**: `.actionable({})` wrapper for all mutations
- **Dual System**: Server actions for forms, client RPC for data fetching  
- **Error Handling**: Typed responses with structured error patterns
- **Documentation**: Comprehensive API reference documentation completed

### Key Decisions Found
- **Server Actions**: Chosen for form submissions with automatic validation
- **Client RPC**: Selected for direct data fetching with manual state management
- **Integration**: Designed specifically for Next.js App Router with React 19 patterns
- **Type Safety**: Emphasized throughout with Zod validation and TypeScript inference

### Missing Historical Context
No documentation found about:
- Migration from other RPC systems
- Comparison with alternatives (tRPC, GraphQL, etc.)
- Performance considerations driving the choice
- Initial architecture decisions about dual patterns

## Related Research

- [oRPC API Reference](../../../docs/09-api-reference/orpc-reference.md) - Complete endpoint documentation
- [Development Workflow Guide](../../../docs/01-getting-started/development-workflow.md) - Server actions integration
- [Database Schema Design](../../../docs/04-database/schema-design.md) - Multi-tenant query patterns
- [Dual Authentication System](../../../docs/03-authentication/dual-auth-system.md) - Security context

## Open Questions

1. **Performance Monitoring**: Are there metrics tracking oRPC endpoint performance and error rates?
2. **Caching Strategy**: How is client-side caching handled for RPC calls beyond revalidatePath?
3. **Real-time Updates**: Are there plans for WebSocket integration with oRPC patterns?
4. **Testing Strategy**: What are the testing patterns specifically for oRPC endpoints and server actions?
5. **Migration Path**: How would new features be migrated if oRPC patterns needed to change?

## Key Takeaways

1. **Dual Pattern Success**: The server actions vs client RPC separation provides clear mental models
2. **Type Safety Throughout**: Comprehensive TypeScript integration from input validation to error handling
3. **Security by Design**: Multi-tenant security patterns are consistent across all endpoints
4. **Developer Experience**: Rich error handling and validation feedback loops
5. **Documentation Coverage**: Excellent documentation in both code and specification files
6. **Established Conventions**: Mature patterns that are consistently applied across 23+ actions and 8+ RPC endpoints