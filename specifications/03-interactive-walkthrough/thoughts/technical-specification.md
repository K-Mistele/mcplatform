# Data Structures for Interactive Walkthroughs

This document outlines the proposed data structures for implementing the interactive walkthrough feature. The design supports a many-to-many relationship between walkthroughs and MCP servers, allowing walkthroughs to be managed independently and assigned to multiple servers.

## Data Storage Decision: Postgres

For the initial implementation, we will store walkthrough content directly in the PostgreSQL database using a `text` field.

**Reasoning:**
- **Simplicity**: It keeps the architecture contained and avoids the complexity of managing a separate object storage service like S3.
- **Transactional Integrity**: Data consistency is easier to maintain when all related data lives within the same database.
- **Sufficient for V1**: The size of Markdown content for each step is unlikely to strain the database in the near term.
- **Future Flexibility**: We can migrate to an object storage solution in the future by adding a `content_url` field and a backfill script if content size becomes a concern.

## Architecture Overview

The new architecture decouples walkthroughs from MCP servers and follows MCPlatform's established patterns:

1. **Independent Management**: Walkthroughs are created and managed separately in their own dashboard section using oRPC server actions
2. **Many-to-Many Relationship**: Each walkthrough can be assigned to multiple MCP servers, and each server can have multiple walkthroughs
3. **Flexible Assignment**: Dashboard users can dynamically add/remove walkthroughs from servers without affecting the walkthrough content
4. **No Public API**: All operations use internal oRPC server actions and server components - MCP tools are added to existing servers, not exposed as new HTTP endpoints

## Proposed Schema

Four new tables are proposed to support this feature. They integrate with existing `mcp_servers`, `organization`, and `mcp_server_user` tables while maintaining proper separation of concerns.

---

### 1. `walkthroughs`

This table stores the metadata for each interactive walkthrough. Walkthroughs are now organization-scoped but independent of specific MCP servers.

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
    firstStepId: text('first_step_id'), // Foreign key reference added after walkthrough_steps table
    version: integer('version').default(1).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
});
```

**Fields Explained:**
- `id`: Unique identifier for the walkthrough, following the `wt_` prefix convention.
- `organizationId`: Ensures all data is correctly scoped to an organization (removed direct MCP server link).
- `title`, `description`: User-facing metadata, editable in the dashboard.
- `firstStepId`: The entry point to the walkthrough's linked list of steps.
- `version`: A simple integer for versioning. Can be incremented when significant changes are made.
- `isPublished`: Controls whether the walkthrough is available for assignment to MCP servers.

---

### 2. `mcp_server_walkthroughs`

This junction table creates the many-to-many relationship between MCP servers and walkthroughs.

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

**Fields Explained:**
- `id`: Unique identifier for the assignment relationship.
- `mcpServerId`: The MCP server this walkthrough is assigned to.
- `walkthroughId`: The walkthrough being assigned.
- `organizationId`: Ensures data is properly scoped (should match both server and walkthrough org).
- `displayOrder`: Controls the order walkthroughs are presented to users on this server.
- `isEnabled`: Allows temporarily disabling a walkthrough on a server without removing the assignment.
- `assignedAt`: Timestamp for when the walkthrough was assigned to this server.
- `unq`: Ensures a walkthrough can only be assigned to a server once.

---

### 3. `walkthrough_steps`

This table contains the actual content for each step in a walkthrough, structured as a linked list. It includes an optional `sectionTitle` to allow for logical grouping of steps.

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
    sectionTitle: text('section_title'), // Optional: for grouping steps into lessons/sections
    content: text('content').notNull(), // Markdown content
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    nextStepId: text('next_step_id').references((): AnyPgColumn => walkthroughSteps.id, { onDelete: 'set null' }),
    displayOrder: integer('display_order').default(0), // For UI ordering within a section
});
```

**Fields Explained:**
- `id`: Unique identifier for the step (`ws_` prefix).
- `walkthroughId`: Links the step to its parent walkthrough.
- `sectionTitle`: An optional title to group related steps, like a chapter or lesson name.
- `content`: The Markdown content for the step.
- `nextStepId`: A self-referencing foreign key that creates the linked list structure. If `null`, it's the last step.
- `displayOrder`: Provides a hint for UI ordering, especially for steps within the same section.

---

### 4. `walkthrough_progress`

This table tracks the progress of each `mcp_server_user` through a specific walkthrough. It now includes a `completedSteps` field to store a more granular history of the user's progress.

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
        .notNull(), // Track which server context the user started this walkthrough from
    currentStepId: text('current_step_id')
        .references(() => walkthroughSteps.id, { onDelete: 'cascade' })
        .notNull(),
    status: pgEnum('walkthrough_status', ['not_started', 'in_progress', 'completed'])('status').default('not_started'),
    completedSteps: jsonb('completed_steps').$type<string[]>().default([]), // Array of completed step IDs
    startedAt: bigint('started_at', { mode: 'number' }),
    completedAt: bigint('completed_at', { mode: 'number' }),
    version: integer('version').notNull(), // The version of the walkthrough the user is on
}, (t) => ({
    unq: unique().on(t.mcpServerUserId, t.walkthroughId),
}));
```

**Fields Explained:**
- `mcpServerUserId`: Identifies the end-user.
- `walkthroughId`: Identifies the walkthrough.
- `mcpServerId`: Tracks which server context the user started this walkthrough from (for analytics).
- `currentStepId`: The last step the user has viewed. This is the core of the state tracking.
- `status`: Tracks whether the user has started, is in the middle of, or has completed the walkthrough.
- `completedSteps`: A JSON array of all step IDs the user has completed. This allows for more detailed progress tracking and non-linear navigation UI.
- `version`: Stores the version of the walkthrough the user started. This is crucial for handling content updates gracefully.
- `unq`: A unique constraint to ensure a user has only one progress record per walkthrough.

## MCP Tools Integration

Three new tools are added to existing MCP servers (not new HTTP endpoints). The tools query for walkthroughs assigned to the specific server making the request:

```typescript
// Example query for list_walkthroughs tool
const availableWalkthroughs = await db
    .select({
        id: walkthroughs.id,
        title: walkthroughs.title,
        description: walkthroughs.description,
    })
    .from(walkthroughs)
    .innerJoin(mcpServerWalkthroughs, eq(walkthroughs.id, mcpServerWalkthroughs.walkthroughId))
    .where(
        and(
            eq(mcpServerWalkthroughs.mcpServerId, currentMcpServerId),
            eq(mcpServerWalkthroughs.isEnabled, true),
            eq(walkthroughs.isPublished, true)
        )
    )
    .orderBy(mcpServerWalkthroughs.displayOrder);
```

## Technical Architecture Integration

### Building on Existing Patterns

The walkthrough system builds on established MCPlatform patterns:

#### Dashboard UI Components
- **Extension of Wizard Pattern**: Current `OnboardingFlow` component pattern can be extended to `WalkthroughManagement` components
- **oRPC Server Actions**: All CRUD operations (create, update, delete, assign walkthroughs) handled via oRPC server actions with proper organization scoping - no public API
- **Client Components**: Markdown editor, step ordering interface, and assignment management using shadcn/ui components with React 19 patterns

#### State Management Architecture

**Server-Side State**:
- All walkthrough content and metadata stored in PostgreSQL
- Progress tracking persisted across sessions
- Server-side validation for all operations

**Client-Side State**:
- Optimistic updates for editing experience using React 19 patterns
- URL state management with `nuqs` for walkthrough navigation
- Form validation states and loading indicators

**Real-Time Updates**:
- Progress updates reflected immediately in analytics
- Content changes propagated to active sessions

### MCP Tools Implementation

The MCP server will expose three core tools that work with the new many-to-many architecture:

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

Returns walkthroughs assigned to the current MCP server, ordered by `displayOrder`.

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

Handles OAuth flow for user identification if needed, then starts or resumes walkthrough progress.

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

Advances user through the walkthrough steps, updating progress tracking.

#### 4. `get_walkthrough_status` Tool
```typescript
{
  name: "get_walkthrough_status",
  description: "Gets the current progress for a given walkthrough, including completed steps.",
  inputSchema: {
    type: "object",
    properties: {
      walkthrough_id: { type: "string" }
    },
    required: ["walkthrough_id"]
  }
}
```
Returns a structured object with the overall status, current step, and a list of all steps with their completion status, powered by the `completedSteps` array in the `walkthrough_progress` table.

#### 5. `reset_walkthrough_progress` Tool
```typescript
{
  name: "reset_walkthrough_progress",
  description: "Resets all progress for a specific walkthrough for the current user. This action is irreversible.",
  inputSchema: {
    type: "object",
    properties: {
      walkthrough_id: { type: "string" },
      confirm: { type: "boolean" }
    },
    required: ["walkthrough_id", "confirm"]
  }
}
```
Provides a way for users to start over by clearing the corresponding record in `walkthrough_progress`.

### Integration with Existing Infrastructure

#### Database Integration
- Extends existing schema pattern with proper organization scoping
- Uses established `nanoid` ID generation and `bigint` timestamp patterns
- Integrates with existing `mcp_servers` and `mcp_server_user` tables

#### Authentication Integration
- Leverages existing sub-tenant OAuth system for user identification
- Maintains organization boundaries for all operations
- Integrates with existing session management

#### MCP Server Integration
- Tools added to existing MCP server infrastructure (no new HTTP endpoints)
- Follows established vhost routing pattern via `getMcpServerConfiguration`
- Maintains existing error handling and rate limiting patterns
- Dashboard operations use oRPC server actions with proper authorization

### Dashboard UI Architecture

#### New Sidebar Section: "Walkthroughs"
Independent of MCP servers, this section allows:

**Walkthrough Management**:
```
/dashboard/walkthroughs
├── /                     # List all organization walkthroughs
├── /new                  # Create new walkthrough
├── /[id]                 # Edit walkthrough details and steps
└── /[id]/preview        # Preview walkthrough experience
```

**Server Assignment Interface**:
- Accessible from both walkthrough detail pages and MCP server detail pages
- Drag-and-drop interface for ordering walkthroughs on servers
- Toggle enable/disable for temporary changes

#### Component Architecture
```typescript
// Main walkthrough management page
<WalkthroughList />
  ├── <WalkthroughCard /> // Shows title, description, assigned servers count
  └── <NewWalkthroughButton />

// Walkthrough editor
<WalkthroughEditor />
  ├── <WalkthroughMetaEditor /> // Title, description, publish status
  ├── <StepsList />
  │   └── <StepEditor />       // Markdown editor with preview
  └── <ServerAssignments />    // Manage which servers show this walkthrough

// Server detail page enhancement
<McpServerDetail />
  ├── ... existing tabs
  └── <WalkthroughAssignments /> // Manage walkthroughs for this server
```

### Performance Considerations

#### Efficient Querying
- Indexes on junction table for fast server-walkthrough lookups
- Cached walkthrough content for frequently accessed items
- Optimized linked-list traversal for step navigation

#### Content Delivery
- Direct PostgreSQL storage for V1 simplicity
- Migration path to object storage if content grows large
- Lazy loading of step content for better initial load times

### Security & Authorization

#### Organization Scoping
- All operations properly scoped to user's organization
- Walkthrough assignments respect server ownership
- Content sanitization for Markdown input

#### Access Control
- Only organization members can manage walkthroughs
- MCP servers only expose assigned and published walkthroughs
- Progress tracking requires proper user identification via OAuth

This architecture provides a solid foundation for the interactive walkthrough feature with proper separation of concerns, flexible assignment capabilities, and comprehensive tracking while building on MCPlatform's established patterns.
