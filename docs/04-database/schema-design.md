# Database Schema Design

MCPlatform uses PostgreSQL with Drizzle ORM for type-safe database operations. The schema is designed for multi-tenancy with clear separation between platform users and end-users.

## Schema Overview

The database consists of several logical domains:

1. **Authentication**: Platform and MCP user management
2. **Multi-tenancy**: Organization-based isolation  
3. **MCP Servers**: Customer-created MCP server configurations
4. **Analytics**: Tool usage and session tracking
5. **Support**: Customer support and ticketing
6. **Walkthroughs**: Interactive tutorial system

## Multi-tenant Design

### Organization Scoping

All customer data is scoped to organizations to ensure proper isolation:

```typescript
// Core organization table (from auth-schema.ts)
export const organization = pgTable('organization', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').unique().notNull(),
    createdAt: timestamp('created_at').notNull()
})

// All customer resources reference organization
export const mcpServers = pgTable('mcp_servers', {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(), // <- Organization scoping
    // ... other fields
})
```

### Access Control Pattern

Every query for customer data must include organization filtering:

```typescript
// CORRECT: Scoped to user's organization
const servers = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.organizationId, userOrganization.id))

// INCORRECT: Could access other organizations' data
const servers = await db.select().from(mcpServers)
```

## ID Generation Patterns

### Nanoid with Prefixes

All tables use nanoid with descriptive prefixes for easy identification:

```typescript
// Support requests: sr_12Ab34Cd
id: text('id')
    .primaryKey()
    .$defaultFn(() => `sr_${nanoid(8)}`)

// MCP servers: ms_87Xy65Wz
id: text('id')
    .primaryKey()
    .$defaultFn(() => `${nanoid(8)}`) // No prefix for backwards compatibility

// Tool calls: tc_56Qw78Er  
id: text('id')
    .primaryKey()
    .$defaultFn(() => `tc_${nanoid(8)}`)
```

### Why Nanoid?

- **URL-safe**: No special characters
- **Short**: 8 characters provide adequate uniqueness
- **Human-readable**: Easier to debug than UUIDs
- **Collision-resistant**: 64^8 possible combinations

## Timestamp Strategy

### Bigint for Precision

MCPlatform uses `bigint` timestamps instead of native PostgreSQL `timestamp`:

```typescript
// Using bigint for millisecond precision
createdAt: bigint('created_at', { mode: 'number' })
    .$defaultFn(() => Date.now())

// NOT using native timestamp
// createdAt: timestamp('created_at').$defaultFn(() => new Date())
```

### Benefits of Bigint Timestamps

- **Millisecond precision**: Better for analytics and ordering
- **JavaScript compatibility**: Direct `Date.now()` values
- **No timezone issues**: Always UTC milliseconds
- **Consistent across systems**: Same format in frontend and backend

## Core Domain Schemas

### MCP Server Management

The core table for customer-created MCP servers:

```typescript
export const mcpServers = pgTable('mcp_servers', {
    id: text('id').primaryKey().$defaultFn(() => `${nanoid(8)}`),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    name: text('name').notNull(),
    productPlatformOrTool: text('product_platform_or_tool').notNull(),
    slug: text('slug').unique().notNull(), // Used for vhost routing
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    authType: mcpServerAuthType('auth_type').default('none'),
    supportTicketType: supportRequestMethod('support_ticket_type').default('dashboard'),
    walkthroughToolsEnabled: text('walkthrough_tools_enabled').$type<'true' | 'false'>().default('true')
})
```

**Key Design Decisions**:
- `slug` is globally unique for vhost routing
- `authType` enum controls OAuth requirements
- Boolean fields stored as text for Drizzle compatibility

### User Analytics and Tracking

MCP server usage is tracked through separate user and session tables:

```typescript
// End-users (NOT platform users)
export const mcpServerUser = pgTable('mcp_server_user', {
    id: text('id').primaryKey().$defaultFn(() => `mcpu_${nanoid(12)}`),
    trackingId: text('distinct_id').unique({ nulls: 'distinct' }), // Optional anonymous ID
    email: text('email'), // Captured via OAuth
    firstSeenAt: bigint('first_seen_at', { mode: 'number' }).$defaultFn(() => Date.now())
})

// Sessions connecting to MCP servers
export const mcpServerSession = pgTable('mcp_server_session', {
    mcpServerSessionId: text('mcp_server_session_id').primaryKey().notNull(),
    mcpServerSlug: text('mcp_server_slug')
        .references(() => mcpServers.slug, { onDelete: 'cascade' })
        .notNull(),
    connectionDate: date('connection_date')
        .notNull()
        .$defaultFn(() => new Date().toISOString()),
    connectionTimestamp: bigint('connection_timestamp', { mode: 'number' }).$defaultFn(() => Date.now()),
    mcpServerUserId: text('mcp_server_user_id')
        .references(() => mcpServerUser.id, { onDelete: 'cascade' })
})

// Individual tool calls within sessions
export const toolCalls = pgTable('mcp_tool_calls', {
    id: text('id').primaryKey().$defaultFn(() => `tc_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    mcpServerId: text('mcp_server_id').references(() => mcpServers.id).notNull(),
    toolName: text('tool_name').notNull(),
    mcpServerUserId: text('mcp_server_user_id')
        .references(() => mcpServerUser.id, { onDelete: 'cascade' }),
    mcpServerSessionId: text('mcp_server_session_id')
        .references(() => mcpServerSession.mcpServerSessionId, { onDelete: 'cascade' })
        .notNull(),
    input: jsonb('input'),  // Tool input parameters
    output: jsonb('output') // Tool response
})
```

### Support System

Comprehensive support ticketing with activity tracking:

```typescript
export const supportRequests = pgTable('support_requests', {
    id: text('id').primaryKey().$defaultFn(() => `sr_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    title: text('title'),
    conciseSummary: text('concise_summary'),
    context: text('context'),
    status: supportRequestStatus('status').default('pending'),
    supportRequestMethod: supportRequestMethod('support_request_method').default('dashboard'),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
    email: text('email').notNull(), // From end-user, not platform user
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    mcpServerId: text('mcp_server_id')
        .references(() => mcpServers.id, { onDelete: 'cascade' }),
    mcpServerSessionId: text('mcp_server_session_id')
        .references(() => mcpServerSession.mcpServerSessionId, { onDelete: 'cascade' }),
    assigneeId: text('assignee_id')
        .references(() => user.id, { onDelete: 'set null' }), // Platform user
    priority: supportTicketPriority('priority').default('medium')
})

// Activity log for support tickets
export const supportTicketActivities = pgTable('support_ticket_activities', {
    id: text('id').primaryKey().$defaultFn(() => `sta_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    supportRequestId: text('support_request_id')
        .references(() => supportRequests.id, { onDelete: 'cascade' })
        .notNull(),
    userId: text('user_id')
        .references(() => user.id, { onDelete: 'cascade' })
        .notNull(), // Platform user who made the activity
    activityType: supportTicketActivityType('activity_type').notNull(),
    content: jsonb('content'),
    contentType: text('content_type').default('text'),
    metadata: jsonb('metadata')
})
```

## Enum Definitions

MCPlatform uses PostgreSQL enums for controlled vocabularies:

```typescript
// Support ticket states
const supportRequestStatusValues = [
    'needs_email', 'pending', 'in_progress', 'resolved', 'closed'
] as const

// Authentication types for MCP servers  
const mcpServerAuthTypeValues = [
    'platform_oauth', 'custom_oauth', 'none', 'collect_email'
] as const

// Support handling methods
const supportRequestMethodValues = [
    'slack', 'linear', 'dashboard', 'none'
] as const

// Define enums
export const supportRequestStatus = pgEnum('support_request_status', supportRequestStatusValues)
export const mcpServerAuthType = pgEnum('mcp_server_auth_type', mcpServerAuthTypeValues)
export const supportRequestMethod = pgEnum('support_request_method', supportRequestMethodValues)
```

## Foreign Key Relationships

### Cascade Patterns

MCPlatform uses specific cascade patterns for data integrity:

```typescript
// CASCADE: Delete child records when parent is deleted
organizationId: text('organization_id')
    .references(() => organization.id, { onDelete: 'cascade' })

// SET NULL: Keep record but clear reference  
assigneeId: text('assignee_id')
    .references(() => user.id, { onDelete: 'set null' })

// RESTRICT (default): Prevent deletion if references exist
// Used when referential integrity is critical
```

### Relationship Examples

1. **Organization → MCP Servers**: CASCADE (delete servers when org deleted)
2. **MCP Server → Tool Calls**: CASCADE (delete calls when server deleted)  
3. **User → Support Assignments**: SET NULL (preserve tickets when user deleted)
4. **Session → Tool Calls**: CASCADE (delete calls when session ends)

## Index Strategies

### Query Optimization

Indexes are created for common query patterns:

```typescript
// Support ticket lookups by request
index('support_ticket_activities_support_request_id_idx').on(t.supportRequestId)

// Time-based queries (analytics)
index('support_ticket_activities_created_at_idx').on(t.createdAt)

// VHost routing lookups  
index('mcp_server_slug_idx').on(t.slug)

// Session-based queries
index('tool_calls_mcp_server_session_id_idx').on(t.mcpServerSessionId)

// Organization scoping
index('walkthroughs_organization_id_idx').on(t.organizationId)
```

### Performance Considerations

- **Composite indexes** for multi-column WHERE clauses
- **Partial indexes** for commonly filtered subsets
- **Expression indexes** for complex queries
- **Covering indexes** to avoid table lookups

## Data Types and Storage

### JSONB Usage

JSONB is used for flexible, structured data:

```typescript
// Tool call parameters (variable structure)
input: jsonb('input'),
output: jsonb('output'),

// Metadata that varies by context
metadata: jsonb('metadata'),

// Array-like data with querying needs
tags: jsonb('tags').$type<string[]>().default([])
```

### Text vs Varchar

MCPlatform uses `text` consistently instead of `varchar`:
- **No length limits**: Avoid arbitrary constraints  
- **Same performance**: PostgreSQL treats them identically
- **Future-proof**: No need to modify column sizes

### Boolean Representation

Due to Drizzle ORM limitations, booleans are stored as text:

```typescript
// Stored as 'true' | 'false' strings
walkthroughToolsEnabled: text('walkthrough_tools_enabled')
    .$type<'true' | 'false'>()
    .default('true')
```

## Migration Workflow

### Schema Changes

1. **Modify schema files** in `packages/database/src/`
2. **Generate migration**: `bun run db:generate` (ASK FIRST)
3. **Review migration** SQL before applying
4. **Run migration**: `bun run db:migrate` (ASK FIRST)

### Migration Best Practices

- **Backwards compatible**: Don't break existing queries
- **Default values**: Provide defaults for new NOT NULL columns  
- **Index creation**: Create indexes concurrently in production
- **Data migration**: Separate schema and data changes

### Example Migration

```sql
-- Generated migration example
CREATE TABLE "support_requests" (
    "id" text PRIMARY KEY NOT NULL,
    "created_at" bigint DEFAULT extract(epoch from now()) * 1000,
    "title" text,
    "status" "support_request_status" DEFAULT 'pending',
    "email" text NOT NULL,
    "organization_id" text NOT NULL
);

CREATE INDEX "support_requests_organization_id_idx" 
    ON "support_requests" ("organization_id");

ALTER TABLE "support_requests" 
    ADD CONSTRAINT "support_requests_organization_id_fkey" 
    FOREIGN KEY ("organization_id") 
    REFERENCES "organization"("id") 
    ON DELETE cascade;
```

## Query Patterns

### Organization Scoped Queries

All customer data queries must include organization scoping:

```typescript
// Get MCP servers for organization
async function getOrganizationServers(organizationId: string) {
    return await db
        .select()
        .from(mcpServers)
        .where(eq(mcpServers.organizationId, organizationId))
        .orderBy(desc(mcpServers.createdAt))
}

// Get support tickets for organization
async function getOrganizationTickets(organizationId: string) {
    return await db
        .select({
            ticket: supportRequests,
            assignee: user.name
        })
        .from(supportRequests)
        .leftJoin(user, eq(supportRequests.assigneeId, user.id))
        .where(eq(supportRequests.organizationId, organizationId))
        .orderBy(desc(supportRequests.createdAt))
}
```

### Analytics Queries

Time-based analytics with proper indexing:

```typescript
// Tool usage analytics
async function getToolUsageStats(mcpServerId: string, days: number = 30) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000)
    
    return await db
        .select({
            toolName: toolCalls.toolName,
            callCount: count(toolCalls.id),
            uniqueUsers: countDistinct(toolCalls.mcpServerUserId)
        })
        .from(toolCalls)
        .where(
            and(
                eq(toolCalls.mcpServerId, mcpServerId),
                gte(toolCalls.createdAt, cutoff)
            )
        )
        .groupBy(toolCalls.toolName)
        .orderBy(desc(count(toolCalls.id)))
}
```

## Security Considerations

### Row Level Security (Future)

PostgreSQL RLS could enhance security:

```sql
-- Example RLS policy (not currently implemented)
CREATE POLICY organization_isolation ON mcp_servers
    FOR ALL TO application_role
    USING (organization_id = current_setting('app.current_organization_id'));
```

### SQL Injection Prevention

Drizzle ORM provides protection through:
- **Prepared statements**: All queries are parameterized
- **Type safety**: Invalid queries don't compile
- **Schema validation**: Runtime type checking

### Sensitive Data Handling

- **Email addresses**: Stored plaintext for functionality, consider encryption
- **User tracking**: Anonymous tracking IDs where possible  
- **Audit trails**: Complete activity logs for support tickets

## Monitoring and Maintenance

### Database Health

Monitor these metrics:
- **Table sizes**: Identify growing tables
- **Index usage**: Remove unused indexes  
- **Query performance**: Slow query log analysis
- **Connection pooling**: Monitor connection counts

### Backup Strategy

- **Automated backups**: Via AWS RDS
- **Point-in-time recovery**: Available for 7-35 days
- **Cross-region replication**: For disaster recovery
- **Testing**: Regular restore testing

## Related Documentation

- [VHost Routing Architecture](../02-architecture/vhost-routing.md)
- [Dual Authentication System](../03-authentication/dual-auth-system.md)
- [Development Environment Setup](../01-getting-started/dev-environment.md)
- [API Reference](../09-api-reference/orpc-reference.md)