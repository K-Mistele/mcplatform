---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "Sub-Feature: Core Infrastructure & MCP Tools"
tags: [sub-feature-definition, interactive-walkthrough, core-infrastructure, mcp-tools]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
type: sub_feature_definition
---

# Sub-Feature: Core Infrastructure & MCP Tools

## Parent Feature
[Interactive Walkthrough Feature](../feature.md)

## Overview
This sub-feature establishes the foundational backend infrastructure and end-user-facing MCP tools for the Interactive Walkthrough system. It implements a **many-to-many architecture** where walkthroughs are managed independently from MCP servers, allowing flexible assignment and reuse across multiple server contexts.

**Key Architectural Decisions:**
- **PostgreSQL for V1**: Content stored directly in database (text fields) rather than object storage for simplicity
- **Linked-List Structure**: Steps connected via `next_step_id` for flexible ordering and insertion
- **Organization Scoping**: All data properly scoped to organizations following MCPlatform patterns
- **VHost-Based Routing**: Uses existing `getMcpServerConfiguration` pattern with Host header inspection
- **No Public API**: All operations use internal oRPC server actions and existing MCP server infrastructure

## Database Schema Design

### Core Tables Overview
Four new tables integrate with existing `mcp_servers`, `organization`, and `mcp_server_user` tables:

1. **`walkthroughs`** - Organization-scoped walkthrough metadata and versioning
2. **`mcp_server_walkthroughs`** - Junction table for many-to-many server-walkthrough assignments
3. **`walkthrough_steps`** - Individual step content in linked-list structure
4. **`walkthrough_progress`** - User progress tracking with server context and version compatibility

### 1. `walkthroughs` Table

```typescript
export const walkthroughs = pgTable('walkthroughs', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `wt_${nanoid(10)}`),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    firstStepId: text('first_step_id'), // Foreign key reference to walkthrough_steps
    version: integer('version').default(1).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
});
```

**Key Fields:**
- `organizationId`: Ensures organization-scoped access (decoupled from specific MCP servers)
- `firstStepId`: Entry point to the walkthrough's linked list of steps
- `version`: Simple integer versioning for content updates
- `isPublished`: Controls availability for assignment to MCP servers

### 2. `mcp_server_walkthroughs` Junction Table

```typescript
export const mcpServerWalkthroughs = pgTable('mcp_server_walkthroughs', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `msw_${nanoid(10)}`),
    mcpServerId: text('mcp_server_id')
        .references(() => mcpServers.id, { onDelete: 'cascade' })
        .notNull(),
    walkthroughId: text('walkthrough_id')
        .references(() => walkthroughs.id, { onDelete: 'cascade' })
        .notNull(),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    displayOrder: integer('display_order').default(0),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    assignedAt: bigint('assigned_at', { mode: 'number' }).$defaultFn(() => Date.now()),
}, (t) => ({
    unq: unique().on(t.mcpServerId, t.walkthroughId),
}));
```

**Key Fields:**
- `displayOrder`: Controls presentation order on each server
- `isEnabled`: Allows temporary disabling without removing assignment
- `organizationId`: Ensures data scoping consistency
- `unq`: Prevents duplicate assignments of same walkthrough to same server

### 3. `walkthrough_steps` Table

```typescript
export const walkthroughSteps = pgTable('walkthrough_steps', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `ws_${nanoid(10)}`),
    walkthroughId: text('walkthrough_id')
        .references(() => walkthroughs.id, { onDelete: 'cascade' })
        .notNull(),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(), // Markdown content stored directly
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    nextStepId: text('next_step_id').references((): AnyPgColumn => walkthroughSteps.id, { onDelete: 'set null' }),
});
```

**Key Fields:**
- `content`: Markdown content stored as text (PostgreSQL for V1 simplicity)
- `nextStepId`: Self-referencing foreign key creating linked-list structure
- **Linked-List Benefits**: Easy insertion, deletion, and reordering without renumbering

### 4. `walkthrough_progress` Table

```typescript
export const walkthroughProgress = pgTable('walkthrough_progress', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `wp_${nanoid(10)}`),
    mcpServerUserId: text('mcp_server_user_id')
        .references(() => mcpServerUser.id, { onDelete: 'cascade' })
        .notNull(),
    walkthroughId: text('walkthrough_id')
        .references(() => walkthroughs.id, { onDelete: 'cascade' })
        .notNull(),
    mcpServerId: text('mcp_server_id')
        .references(() => mcpServers.id, { onDelete: 'cascade' })
        .notNull(), // Track server context for analytics
    currentStepId: text('current_step_id')
        .references(() => walkthroughSteps.id, { onDelete: 'cascade' })
        .notNull(),
    status: pgEnum('walkthrough_status', ['not_started', 'in_progress', 'completed'])('status').default('not_started'),
    startedAt: bigint('started_at', { mode: 'number' }),
    completedAt: bigint('completed_at', { mode: 'number' }),
    version: integer('version').notNull(), // Version of walkthrough user is on
}, (t) => ({
    unq: unique().on(t.mcpServerUserId, t.walkthroughId),
}));
```

**Key Fields:**
- `mcpServerUserId`: Links to existing sub-tenant OAuth user system
- `mcpServerId`: Tracks server context where walkthrough was started (for analytics)
- `currentStepId`: Core state tracking - user's current position in walkthrough
- `version`: Handles content updates gracefully without losing user progress
- `status`: Enum tracking walkthrough lifecycle phases

## MCP Tools Implementation

### Integration Architecture
- **No New HTTP Endpoints**: Tools added to existing MCP servers using established infrastructure
- **VHost Routing**: Uses existing `getMcpServerConfiguration` pattern to identify server context
- **OAuth Integration**: Leverages existing sub-tenant OAuth system for user identification
- **Query Patterns**: Tools query junction table to find walkthroughs assigned to specific servers

### Tool Specifications

#### 1. `list_walkthroughs` Tool

```typescript
{
  name: "list_walkthroughs",
  description: "List all available walkthroughs for this MCP server",
  inputSchema: {
    type: "object",
    properties: {},
    required: []
  }
}
```

**Implementation Logic:**
```typescript
const availableWalkthroughs = await db
    .select({
        id: walkthroughs.id,
        title: walkthroughs.title,
        description: walkthroughs.description,
        stepCount: count(walkthroughSteps.id),
    })
    .from(walkthroughs)
    .innerJoin(mcpServerWalkthroughs, eq(walkthroughs.id, mcpServerWalkthroughs.walkthroughId))
    .leftJoin(walkthroughSteps, eq(walkthroughs.id, walkthroughSteps.walkthroughId))
    .where(
        and(
            eq(mcpServerWalkthroughs.mcpServerId, currentMcpServerId),
            eq(mcpServerWalkthroughs.isEnabled, true),
            eq(walkthroughs.isPublished, true)
        )
    )
    .groupBy(walkthroughs.id)
    .orderBy(mcpServerWalkthroughs.displayOrder);
```

**Returns:** Array of walkthrough metadata with step counts, ordered by server-specific `displayOrder`

#### 2. `select_walkthrough` Tool

```typescript
{
  name: "select_walkthrough",
  description: "Start or resume a specific walkthrough",
  inputSchema: {
    type: "object",
    properties: {
      walkthrough_id: { type: "string" },
      resume_if_exists: { type: "boolean", default: true }
    },
    required: ["walkthrough_id"]
  }
}
```

**Implementation Logic:**
1. **OAuth Flow**: Trigger sub-tenant OAuth if user not identified
2. **Progress Check**: Query `walkthrough_progress` for existing progress
3. **Resume or Start**: Either return current step or create new progress record
4. **Version Handling**: Ensure user's version matches current walkthrough version

#### 3. `next_walkthrough_step` Tool

```typescript
{
  name: "next_walkthrough_step",
  description: "Get the next step in the current walkthrough",
  inputSchema: {
    type: "object",
    properties: {
      current_step_id: { type: "string", optional: true }
    }
  }
}
```

**Implementation Logic:**
1. **Validate User**: Ensure user has active walkthrough progress
2. **Navigate Linked List**: Follow `nextStepId` to get next step
3. **Update Progress**: Update `currentStepId` in progress table
4. **Handle Completion**: Mark as completed if no next step exists
5. **Return Content**: Deliver step title and markdown content

## State Management Architecture

### Server-Side State
- **PostgreSQL Storage**: All walkthrough content and metadata stored in database
- **Progress Persistence**: User progress survives across IDE sessions
- **Version Tracking**: Content updates handled without losing user progress
- **Server Context**: Progress tracks which server user started walkthrough from

### Authentication Integration

#### Sub-Tenant OAuth System
- **Existing Infrastructure**: Uses secondary betterAuth instance (`/lib/auth/mcp/auth.ts`)
- **User Identification**: OAuth flow captures email for de-anonymization
- **Progress Linking**: `mcp_server_user` records linked to progress tracking
- **Session Management**: Leverages existing session infrastructure

#### OAuth Flow for Walkthroughs
1. **Tool Call**: User calls `select_walkthrough` or `next_walkthrough_step`
2. **Identity Check**: System checks for existing `mcp_server_user` session
3. **OAuth Redirect**: If not identified, trigger OAuth flow via existing `/mcp-oidc/login` endpoint
4. **Progress Tracking**: Once identified, create or resume progress records
5. **Content Delivery**: Return appropriate walkthrough content

### Data Storage Patterns

#### Organization Scoping
```typescript
// All queries must include organization scoping
const walkthroughsQuery = db
    .select()
    .from(walkthroughs)
    .where(eq(walkthroughs.organizationId, userOrganizationId));
```

#### Linked-List Traversal
```typescript
// Navigate through steps using linked-list structure
const getNextStep = async (currentStepId: string) => {
    const currentStep = await db
        .select({ nextStepId: walkthroughSteps.nextStepId })
        .from(walkthroughSteps)
        .where(eq(walkthroughSteps.id, currentStepId))
        .limit(1);
    
    if (!currentStep[0]?.nextStepId) return null; // End of walkthrough
    
    return await db
        .select()
        .from(walkthroughSteps)
        .where(eq(walkthroughSteps.id, currentStep[0].nextStepId))
        .limit(1);
};
```

#### Many-to-Many Relationship Handling
```typescript
// Query walkthroughs assigned to a specific server
const serverWalkthroughs = await db
    .select({
        walkthrough: walkthroughs,
        assignment: mcpServerWalkthroughs
    })
    .from(walkthroughs)
    .innerJoin(mcpServerWalkthroughs, eq(walkthroughs.id, mcpServerWalkthroughs.walkthroughId))
    .where(
        and(
            eq(mcpServerWalkthroughs.mcpServerId, serverId),
            eq(walkthroughs.organizationId, orgId),
            eq(mcpServerWalkthroughs.isEnabled, true)
        )
    )
    .orderBy(mcpServerWalkthroughs.displayOrder);
```

## Performance & Security Considerations

### Database Indexing Strategy
```sql
-- Indexes for efficient querying
CREATE INDEX idx_walkthroughs_org ON walkthroughs(organization_id);
CREATE INDEX idx_server_walkthroughs_server ON mcp_server_walkthroughs(mcp_server_id);
CREATE INDEX idx_server_walkthroughs_display_order ON mcp_server_walkthroughs(mcp_server_id, display_order);
CREATE INDEX idx_walkthrough_steps_walkthrough ON walkthrough_steps(walkthrough_id);
CREATE INDEX idx_walkthrough_progress_user ON walkthrough_progress(mcp_server_user_id);
```

### Content Security
- **Markdown Sanitization**: All user-provided markdown content sanitized before storage
- **Organization Boundaries**: All queries enforce organization scoping
- **Rate Limiting**: MCP tool calls subject to existing rate limiting infrastructure

### Migration Path to Object Storage
```typescript
// Future migration design
export const walkthroughSteps = pgTable('walkthrough_steps', {
    // ... existing fields
    content: text('content'), // Will become optional
    contentUrl: text('content_url'), // For S3/object storage URLs
    contentType: text('content_type').default('markdown'), // Future rich media support
});
```

## Implementation Phases

### Phase 1: Database Foundation
- [ ] Create and run database migrations for all four tables
- [ ] Add foreign key references between tables
- [ ] Create necessary database indexes
- [ ] Implement database seed data for testing

### Phase 2: Basic MCP Tools
- [ ] Implement `list_walkthroughs` tool with server filtering
- [ ] Implement `select_walkthrough` tool with OAuth integration
- [ ] Implement `next_walkthrough_step` tool with progress tracking
- [ ] Add tools to existing MCP server infrastructure

### Phase 3: State Management
- [ ] Implement progress tracking logic
- [ ] Add version compatibility handling
- [ ] Implement session persistence across IDE restarts
- [ ] Add completion tracking and analytics foundation

### Phase 4: Integration Testing
- [ ] Unit tests for all database operations
- [ ] Integration tests for MCP tools
- [ ] End-to-end tests for walkthrough flow
- [ ] Performance testing for linked-list operations

## Dependencies

### Internal Dependencies
- Existing MCP server infrastructure and tool registration system
- Sub-tenant OAuth authentication system (`/lib/auth/mcp/auth.ts`)
- Database migration system and Drizzle ORM setup
- Organization scoping patterns and authorization middleware

### External Dependencies
- PostgreSQL database with proper permissions
- Existing `mcp_servers`, `organization`, and `mcp_server_user` tables
- Current VHost routing logic in `getMcpServerConfiguration`

## Related Documents
- [Technical Specification](../thoughts/technical-specification.md)
- [OAuth Integration Notes](../thoughts/oauth-integration-notes.md)
- [MCP Tool Patterns](../thoughts/mcp-tool-patterns.md)
