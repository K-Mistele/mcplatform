---
date: 2025-08-03T12:23:23-07:00
researcher: Claude
git_commit: 50507c59e757b77aef1b8b0e778cd14330164251
branch: master
repository: mcplatform
topic: "MCP Tool Registration Implementation and Architecture"
tags: [research, codebase, mcp, tool-registration, schema-handling, walkthrough-tools]
status: complete
last_updated: 2025-08-03
last_updated_by: Claude
type: research
---

# Research: MCP Tool Registration Implementation and Architecture

**Date**: 2025-08-03T12:23:23-07:00
**Researcher**: Claude
**Git Commit**: 50507c59e757b77aef1b8b0e778cd14330164251
**Branch**: master
**Repository**: mcplatform

## Research Question
How does MCP tool registration work in the codebase, specifically focusing on the implementation details, schema handling, and the walkthrough tools registration pattern?

## Summary
MCPlatform implements a sophisticated MCP (Model Context Protocol) tool registration system that uses VHost-based routing for multi-tenant server isolation. The system employs a dual-schema approach where Zod schemas define runtime validation while their `.shape` property provides JSON Schema definitions for MCP tool registration. Tools are conditionally registered based on server configuration, with support tools always registered and walkthrough tools registered only when enabled and walkthroughs exist.

## Detailed Findings

### VHost-Based Routing and Server Configuration
The system uses subdomain-based routing to dynamically serve different MCP servers:

- **Configuration Lookup** ([index.ts:118-160](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/lib/mcp/index.ts#L118-L160))
  - Extracts subdomain from `Host` header
  - Validates request is one level under application domain
  - Looks up server config by matching `slug` field in database
  - Returns configuration for dynamic tool registration

- **Entry Point** ([route.ts:52-58](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts#L52-L58))
  - Creates MCP handler with server-specific configuration
  - Passes configuration to tool registration function

### Tool Registration Architecture

#### Core Registration Flow ([index.ts:80-111](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/lib/mcp/index.ts#L80-L111))
1. Always registers support tool via `registerMcpSupportTool()`
2. Conditionally registers walkthrough tools if:
   - `serverConfig.walkthroughToolsEnabled === 'true'`
   - Server has published walkthroughs (async check)
3. Each tool set has its own registration function

#### Registration Pattern ([index.ts:186-225](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/lib/mcp/index.ts#L186-L225))
```typescript
server.registerTool(
    toolName,
    {
        title: tool.description,
        description: tool.description,
        inputSchema: z.object({}).shape // Empty schema, validation in handlers
    },
    async (args) => {
        // Convert args to request format
        // Call specific handler with context
    }
)
```

### Schema Handling Strategy

#### Dual Schema System
The codebase uses a clever dual-schema approach:

1. **JSON Schema for MCP Protocol** - Tool definitions include `inputSchema` property in JSON Schema format
2. **Zod Schema for Runtime Validation** - Handlers use Zod schemas for argument parsing

#### Schema Bridge via `.shape` Property
- **Support Tool** ([support.ts:93](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/lib/mcp/tools/support.ts#L93)): Uses `inputSchema.shape` from dynamically created Zod schema
- **Walkthrough Tools** ([index.ts:210](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/lib/mcp/index.ts#L210)): Uses `z.object({}).shape` as placeholder
- **Key Insight**: The `.shape` property provides JSON Schema-compatible structure without explicit conversion

### Walkthrough Tools Implementation

#### Tool Definitions ([walkthrough.ts:16-217](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/lib/mcp/tools/walkthrough.ts#L16-L217))
Three tools implemented with specific schemas:
- `list_walkthroughs`: Empty schema, lists all walkthroughs with progress
- `start_walkthrough`: Requires `name` string, optional `restart` boolean
- `get_next_step`: Optional `currentStepId` string

#### Registry Pattern ([walkthrough.ts:311-324](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/packages/dashboard/src/lib/mcp/tools/walkthrough.ts#L311-L324))
```typescript
export const walkthroughTools = {
    toolName: {
        tool: toolDefinition,  // MCP tool interface
        handler: handlerFunction  // Async handler
    }
}
```

### Bug Discovery: Empty Schema Registration
During research, found that walkthrough tools are registered with empty schemas (`z.object({}).shape`) instead of their actual input schemas. This causes the "random_string" parameter error reported in support tickets.

## Code References
- `packages/dashboard/src/lib/mcp/index.ts:29-39` - MCP handler creation with tool registration callback
- `packages/dashboard/src/lib/mcp/index.ts:204-225` - Walkthrough tools registration loop
- `packages/dashboard/src/lib/mcp/tools/support.ts:87-94` - Support tool registration with dynamic schema
- `packages/dashboard/src/lib/mcp/tools/walkthrough.ts:82-99` - start_walkthrough tool definition
- `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:39-58` - Request handling and MCP server creation

## Architecture Insights

### Patterns Discovered
1. **VHost-Based Multi-Tenancy**: Subdomain routing enables single endpoint to serve unlimited MCP servers
2. **Conditional Tool Loading**: Tools registered based on feature flags and data existence
3. **Schema Bridge Pattern**: Zod's `.shape` property elegantly bridges TypeScript validation and JSON Schema
4. **Context Propagation**: Tool handlers receive server context (mcpServerId, userId, sessionId)
5. **Tool Registry Pattern**: Centralized registry objects export tool definitions with handlers

### Design Decisions
- Empty schema registration with validation in handlers (current bug source)
- Separation of tool definition from registration logic
- Use of `mcp-handler` package over Vercel's adapter
- Redis-based state management for MCP sessions

## Historical Context (from thoughts/)
From the extensive research in specifications/03-interactive-walkthrough/thoughts/:

- **VHost Routing Rationale** ([technical-specification.md](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/specifications/03-interactive-walkthrough/thoughts/technical-specification.md)): Chosen for horizontal scalability without API proliferation
- **Dual Authentication Design** ([technical-specification.md](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/specifications/03-interactive-walkthrough/thoughts/technical-specification.md)): Separate systems for platform customers vs end-users
- **Content-Resilient Progress** ([structured-content-architecture.md](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/thoughts/structured-content-architecture.md)): Uses step IDs array instead of positions
- **Conditional Registration Pattern** ([implementation-plan.md](https://github.com/anthropics/mcplatform/blob/50507c59e757b77aef1b8b0e778cd14330164251/specifications/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/implementation-plan.md)): Prevents tool pollution when features unused

## Related Research
- `specifications/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/research/research_2025-07-22_10-13-05_mcp-interactive-tools.md` - Initial MCP tools design
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/research/research_2025-07-21_23-07-58_mastra-mcp-course-implementation.md` - Mastra implementation patterns

## Open Questions
1. Why use empty schemas during registration instead of actual tool schemas?
2. Is the `.shape` property usage intentional or accidental schema bridging?
3. Should tool validation happen at registration or handler level?
4. How does the schema mismatch affect other MCP client implementations?