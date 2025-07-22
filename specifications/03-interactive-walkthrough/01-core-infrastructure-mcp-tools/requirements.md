# Requirements for Interactive Walkthrough - Core Infrastructure & MCP Tools

## Goal
Implement foundational backend infrastructure and end-user-facing MCP tools that enable customers to deliver guided, step-by-step walkthroughs through their MCP servers. The system uses a many-to-many architecture allowing flexible walkthrough assignment and reuse across multiple server contexts while maintaining proper organization scoping and user progress tracking.

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
The system builds on existing MCPlatform patterns:
- **MCP server infrastructure**: `src/lib/mcp/index.ts` provides `getMcpServerConfiguration` for VHost-based routing
- **Tool implementation patterns**: `src/lib/mcp/tools/support.ts` demonstrates standard MCP tool structure with Zod validation
- **Authentication system**: Sub-tenant OAuth via `src/lib/auth/mcp/auth.ts` for end-user identification
- **User tracking**: `src/lib/mcp/tracking.ts:getAndTrackMcpServerUser` handles session management
- **Database patterns**: Organization-scoped queries using Drizzle ORM with `nanoid` IDs and `bigint` timestamps

### Composition Pattern
- **Database operations**: Server components query database directly with organization scoping
- **MCP tools**: Added to existing servers using established tool registration patterns
- **State management**: PostgreSQL for persistence, session tracking via existing `mcp_server_user` system
- **Progress updates**: Real-time progress tracking without requiring server actions (read-only from MCP tool perspective)

### Data Model
New tables integrate with existing schema:
- **Existing**: `organization`, `mcp_servers`, `mcp_server_user` tables
- **New**: `walkthroughs`, `mcp_server_walkthroughs`, `walkthrough_steps`, `walkthrough_progress` tables
- **Schema location**: `packages/database/src/schema.ts` (extends existing schema)

## User Stories
(in given/when/then format)

### End-User MCP Tool Interaction
1. **End-user**: As a developer using an MCP-enabled IDE, when I call the `list_walkthroughs` tool, then I see all available walkthroughs assigned to the current MCP server with titles, descriptions, and step counts, ordered by display priority.

2. **End-user**: As a developer, when I call `select_walkthrough` for the first time, then the system triggers OAuth authentication if needed and creates a new progress record starting at the first step.

3. **End-user**: As a developer, when I call `select_walkthrough` for a walkthrough I've started before, then I resume from my current step position with all previous progress preserved.

4. **End-user**: As a developer, when I call `next_walkthrough_step`, then the system dynamically calculates the next uncompleted step using the `completedSteps` array, returns the content, and atomically updates my progress.

5. **End-user**: As a developer, when I reach the final step and call `next_walkthrough_step`, then my walkthrough status is marked as completed and I receive confirmation of completion.

6. **End-user**: As a developer, when I call `get_walkthrough_status`, then I receive structured information about my overall progress including current step and completion status for all steps in the walkthrough.

7. **End-user**: As a developer, when I want to restart a walkthrough I've partially completed, then I can call `reset_walkthrough_progress` with confirmation to clear my progress and begin fresh from the first step.

### Progress Tracking & Session Management  
8. **End-user**: As a developer, when I close my IDE and restart it days later, then I can resume my walkthrough exactly where I left off without losing any progress.

9. **End-user**: As a developer using multiple MCP servers from the same organization, when the same walkthrough is assigned to different servers, then my progress is independent per server context for analytics purposes.

10. **System**: When a walkthrough author reorders, adds, or deletes steps, then existing users maintain their progress seamlessly via the `completedSteps` array tracking and dynamic next-step calculation.

11. **System**: When a walkthrough is updated with new content, then existing users maintain their progress on the version they started, preventing confusion or lost progress.

### OAuth Integration & User Identification
12. **End-user**: As a developer, when I call walkthrough tools without being authenticated, then I'm prompted for OAuth authorization and seamlessly returned to my walkthrough after completing the flow.

13. **System**: When an end-user completes OAuth authentication, then their email is captured for de-anonymization and linked to their walkthrough progress for analytics and support purposes.

## Requirements

### Functional Requirements

#### Database Schema Implementation
- Four new tables must be created following MCPlatform naming conventions with `nanoid` IDs and `bigint` timestamps
- `walkthroughs` table stores organization-scoped metadata with versioning and publish status, including `firstStepId` reference
- `mcp_server_walkthroughs` junction table enables many-to-many assignments with display ordering and enable/disable controls
- `walkthrough_steps` table uses linked-list structure via `next_step_id` for flexible step ordering and insertion, plus `displayOrder` and optional `sectionTitle`
- `walkthrough_progress` table tracks user position with version compatibility, completion status, and JSONB `completedSteps` array for granular progress tracking
- Progress tracking enum: `walkthrough_status` with values `['not_started', 'in_progress', 'completed']`
- All foreign key relationships must include proper cascade deletes and organization scoping

#### MCP Tool Implementation
- `list_walkthroughs` tool returns walkthroughs assigned to current server filtered by `isEnabled` and `isPublished` status, ordered by `displayOrder`
- `select_walkthrough` tool handles OAuth flow initiation, progress creation/resumption, and version compatibility with `resume_if_exists` parameter
- `next_walkthrough_step` tool uses dynamic progress calculation algorithm to find next uncompleted step and updates `completedSteps` array
- `get_walkthrough_status` tool returns structured progress information including overall status, current step, and completion status for all steps
- `reset_walkthrough_progress` tool allows users to clear their progress and restart a walkthrough from the beginning with confirmation requirement
- All tools must integrate with existing VHost routing via `getMcpServerConfiguration` function
- Tools must follow established patterns from `src/lib/mcp/tools/support.ts` including Zod validation and error handling

#### Progress Tracking Logic
- **Dynamic Next Step Calculation**: System must use `displayOrder`-based algorithm to find next step rather than relying solely on `nextStepId` linked-list pointers
- **Next Step Algorithm**: For each user/walkthrough, fetch user's `completedSteps` array and all walkthrough steps sorted by `displayOrder`, then return first step ID not in completed array
- **Atomic Progress Updates**: When user completes a step, must atomically update `completedSteps` array, `currentStepId`, and `status` in single database transaction
- **Content Change Resilience**: System must handle walkthrough edits (reordering, adding, deleting steps) without breaking user progress via `completedSteps` tracking
- **Version Compatibility**: Users maintain progress on their started version while new users get latest version
- User progress must persist across IDE sessions using existing session management infrastructure
- System must support multiple users progressing through same walkthrough simultaneously
- Progress updates must be atomic to prevent race conditions during concurrent access

#### Integration Requirements  
- Tools must integrate with existing sub-tenant OAuth system for user identification without creating new authentication flows
- All database operations must enforce organization boundaries following existing patterns
- Tool calls must be logged in existing `tool_calls` table for analytics
- Error responses must follow established JSON-RPC error format patterns

### Non-Functional Requirements

#### Performance
- Database queries must use proper indexing for efficient server-walkthrough lookups and progress queries
- Linked-list step traversal must perform efficiently without N+1 query patterns
- Tool response times must remain under 200ms for typical operations
- System must handle concurrent users accessing same walkthrough without performance degradation

#### Security & Permissions
- All operations must respect organization boundaries and prevent cross-tenant data access
- OAuth integration must use existing sub-tenant authentication system without exposing platform authentication
- Walkthrough content must be sanitized if storing user-provided markdown content
- Rate limiting must apply to MCP tool calls using existing infrastructure

#### User Experience
- Progress tracking must work seamlessly across different IDE session lifetimes
- OAuth flow must be non-disruptive to walkthrough experience with automatic resumption
- Error states must provide clear feedback without exposing internal system details
- Version compatibility must prevent user confusion during content updates

#### Mobile Support
- N/A - MCP tools operate within development environments, not mobile interfaces

## Design Considerations

### Layout & UI
- N/A - This sub-feature focuses on backend infrastructure; UI handled in separate sub-features

### Responsive Behavior  
- N/A - MCP tools operate via JSON-RPC protocol, not web interfaces

### State Management
- **Server-side state**: All walkthrough content and progress stored in PostgreSQL with proper organization scoping
- **Session state**: User authentication and progress tracking via existing `mcp_server_user` and session management
- **Progress persistence**: User can resume walkthroughs across different IDE sessions and server restarts
- **Version handling**: Content updates handled via walkthrough version field without losing user progress

## Success Criteria

### Core Functionality
- End-users can discover walkthroughs via `list_walkthroughs` tool showing appropriate content for their server context
- End-users can start new walkthroughs via `select_walkthrough` with automatic OAuth flow when needed
- End-users can navigate through steps via `next_walkthrough_step` using dynamic progress calculation algorithm
- End-users can check their progress via `get_walkthrough_status` tool showing detailed completion information
- End-users can reset their progress via `reset_walkthrough_progress` tool to start over from the beginning
- Progress tracking survives walkthrough content changes (step reordering, additions, deletions) via `completedSteps` array
- Progress persists correctly across IDE sessions and server restarts
- Multiple users can progress through same walkthrough independently without conflicts
- Walkthrough completion is properly detected and recorded for analytics

### Technical Implementation  
- All database operations properly scoped to organizations preventing data leaks
- OAuth integration works seamlessly with existing sub-tenant authentication system
- Dynamic progress calculation algorithm works efficiently using `displayOrder` sorting and `completedSteps` array lookups
- Content versioning prevents user progress loss during walkthrough updates
- Progress tracking resilience handles content changes without breaking user state
- All five MCP tools (`list_walkthroughs`, `select_walkthrough`, `next_walkthrough_step`, `get_walkthrough_status`, `reset_walkthrough_progress`) function correctly
- MCP tools integrate with existing server infrastructure without conflicts or breaking changes
- Error handling follows established JSON-RPC patterns with proper status codes

### Integration Success
- Tools register successfully with existing MCP servers using established registration patterns
- VHost-based routing correctly identifies server context for walkthrough filtering
- User tracking integrates properly with existing `getAndTrackMcpServerUser` function
- Analytics logging works correctly via existing `tool_calls` table infrastructure