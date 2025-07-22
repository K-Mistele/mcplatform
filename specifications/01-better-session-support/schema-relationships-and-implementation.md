---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "MCPlatform Database Schema Relationships & Implementation"
tags: [research, database, schema, architecture, implementation]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
type: research
---

# MCPlatform Database Schema Relationships & Implementation Guide

## Overview

This document provides a comprehensive analysis of the database schema relationships and implementation patterns in MCPlatform, focusing on the core tables that track user sessions, tool calls, and support requests.

## Database Schema Architecture

### Core Table Relationships

```mermaid
erDiagram
    organization ||--o{ mcpServers : "owns"
    organization ||--o{ supportRequests : "receives"
    
    mcpServers ||--o{ toolCalls : "tracks"
    mcpServers ||--o{ supportRequests : "generates"
    mcpServers ||--o{ mcpServerSession : "hosts"
    
    mcpServerUser ||--o{ toolCalls : "performs"
    mcpServerUser ||--o{ mcpServerSession : "participates"
    
    mcpServerSession ||--o{ toolCalls : "contains"
    mcpServerSession ||--o{ supportRequests : "links"
    
    mcpOAuthUser ||--o{ mcpServerUser : "enriches (via email)"
```

### Table Definitions & Relationships

#### 1. `mcpServers` (Central Hub)
**Purpose**: Core configuration for MCP servers hosted by customer organizations

```typescript
{
    id: text (PK) // nanoid(8)
    organizationId: text (FK → organization.id, CASCADE DELETE)
    slug: text (UNIQUE) // Used for vhost-based routing
    name: text
    productPlatformOrTool: text
    oauthIssuerUrl: text
    authType: mcpServerAuthType
    supportTicketType: supportRequestMethod
    createdAt: bigint
}
```

**Key Relationships**:
- **Parent**: `organization` (customer tenant)
- **Children**: `toolCalls`, `supportRequests`, `mcpServerSession`
- **Routing**: Uses `slug` for subdomain-based server identification
- **Indexes**: `mcp_server_slug_idx` on `slug` for efficient routing lookups

#### 2. `mcpServerUser` (End-User Identity)
**Purpose**: Tracks end-users who interact with MCP servers (not platform customers)

```typescript
{
    id: text (PK) // "mcpu_" + nanoid(12)
    trackingId: text (UNIQUE, NULLS NOT DISTINCT) // Anonymous tracking identifier (stored as 'distinct_id')
    email: text // Links to mcpOAuthUser via email matching
    firstSeenAt: bigint
}
```

**Key Relationships**:
- **No direct FK to mcpServers** - relationship established via sessions
- **Enriched by**: `mcpOAuthUser` (LEFT JOIN on email)
- **Children**: `toolCalls`, `mcpServerSession`
- **Indexes**: 
  - `mcp_server_user_distinct_id_idx` on `trackingId` for anonymous user lookups
  - `mcp_server_user_email_idx` on `email` for OAuth user enrichment

**Note**: The `trackingId` field is stored as `distinct_id` in the database but accessed as `trackingId` in TypeScript.

#### 3. `mcpServerSession` (Connection Tracking)
**Purpose**: Tracks individual connection sessions between users and MCP servers

```typescript
{
    title: text // Optional session title/description
    mcpServerSessionId: text (PK) // Session identifier
    mcpServerSlug: text (FK → mcpServers.slug, CASCADE DELETE)
    mcpServerUserId: text (FK → mcpServerUser.id, CASCADE DELETE)
    connectionDate: date
    connectionTimestamp: bigint
}
```

**Key Relationships**:
- **Bridge table** connecting users to servers
- **Parent**: `mcpServers` (via slug), `mcpServerUser`
- **Children**: `toolCalls`, `supportRequests`
- **Indexes**:
  - `mcp_server_session_user_id_idx` on `mcpServerUserId` for user session lookups
  - `mcp_server_session_mcp_server_slug_idx` on `mcpServerSlug` for server session queries

#### 4. `toolCalls` (Activity Tracking)
**Purpose**: Records individual tool invocations within MCP sessions

```typescript
{
    id: text (PK) // "tc_" + nanoid(8)
    mcpServerId: text (FK → mcpServers.id)
    mcpServerUserId: text (FK → mcpServerUser.id, CASCADE DELETE)
    mcpServerSessionId: text (FK → mcpServerSession.mcpServerSessionId, CASCADE DELETE)
    toolName: text
    input: jsonb
    output: jsonb
    createdAt: bigint
}
```

**Key Relationships**:
- **Triple-linked**: References server, user, and session
- **Cascade behavior**: Deletes with user or session, but not server
- **Indexes**: `tool_calls_mcp_server_session_id_idx` on `mcpServerSessionId` for session-based tool call queries

#### 5. `supportRequests` (Support Tickets)
**Purpose**: Customer support tickets submitted by end-users

```typescript
{
    id: text (PK) // "sr_" + nanoid(8)
    organizationId: text (FK → organization.id, CASCADE DELETE)
    mcpServerId: text (FK → mcpServers.id, CASCADE DELETE)
    mcpServerSessionId: text (FK → mcpServerSession.mcpServerSessionId, CASCADE DELETE) // Links to specific session
    email: text // String field, not FK - matches users by email
    title: text
    conciseSummary: text
    context: text
    status: supportRequestStatus
    supportRequestMethod: supportRequestMethod
    resolvedAt: bigint
    createdAt: bigint
}
```

**Key Relationships**:
- **Triple-scoped**: Belongs to organization, specific MCP server, and optionally linked to a session
- **Email-based linking**: Connects to users via email string matching
- **Session context**: Can be linked to a specific session for detailed context

## Dual Authentication Architecture

### Platform Authentication (Customer Access)
- **Tables**: `user`, `session`, `account`, `organization`, `member`, `invitation`
- **Purpose**: Dashboard access for paying customers
- **Schema**: `packages/database/src/auth-schema.ts`
- **Auth Instance**: `packages/dashboard/src/lib/auth/auth.ts`

### MCP OAuth Authentication (End-User Identification)
- **Tables**: `mcpOAuthUser`, `mcpOAuthSession`, `mcpOAuthAccount`, `mcpOAuthApplication`
- **Purpose**: De-anonymize end-users via OAuth flow
- **Schema**: `packages/database/src/mcp-auth-schema.ts`
- **Auth Instance**: `packages/dashboard/src/lib/auth/mcp/auth.ts`
- **Login Page**: `/mcp-oidc/login`

**Critical Separation**: End-users NEVER access the dashboard - they only get identified for tracking purposes.

## Data Fetching Implementation

### Query Patterns & Conventions

#### 1. Organization Scoping
All queries are scoped to the active organization:

```typescript
.where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
```

#### 2. LEFT JOIN for Optional Data Enrichment
```typescript
// Enrich mcpServerUser with OAuth profile data
.leftJoin(mcpOAuthUser, eq(schema.mcpServerUser.email, mcpOAuthUser.email))

// Add server context to tool calls
.leftJoin(schema.mcpServers, eq(schema.toolCalls.mcpServerId, schema.mcpServers.id))
```

#### 3. Multi-Identifier User Lookup
The `getUserData` function supports lookup by ID, tracking ID, or email:

```typescript
.where(or(
    eq(schema.mcpServerUser.id, identifier),
    eq(schema.mcpServerUser.trackingId, identifier),
    eq(schema.mcpServerUser.email, identifier)
))
```

### Core Data Fetching Functions

#### `getUserData(identifier: string)`
**Purpose**: Retrieve user profile with OAuth enrichment

**Query Structure**:
- **Base**: `mcpServerUser`
- **Enrichment**: LEFT JOIN with `mcpOAuthUser` on email
- **Lookup**: Supports ID, trackingId, or email
- **Returns**: Combined user profile with OAuth data

#### `getUserConnections(userId: string)`
**Purpose**: Get user's server connection history

**Query Structure**:
- **Base**: `mcpServerSession`
- **Context**: LEFT JOIN with `mcpServers` for server details
- **Filter**: By `mcpServerUserId`
- **Order**: Most recent connections first
- **Post-filter**: Remove sessions with missing server data

#### `getUserToolCalls(userId: string)`
**Purpose**: Retrieve user's tool usage activity

**Query Structure**:
- **Base**: `toolCalls`
- **Context**: LEFT JOIN with `mcpServers` for server context
- **Filter**: By `mcpServerUserId`
- **Order**: Most recent calls first
- **Data**: Includes input/output JSONB

#### `getUserSupportRequests(email: string)`
**Purpose**: Get support tickets by email

**Query Structure**:
- **Base**: `supportRequests`
- **Context**: LEFT JOIN with `mcpServers` for server context
- **Filter**: By email string matching
- **Order**: Most recent requests first

## UI Implementation Patterns

### React 19 Promise Pattern
The application uses React 19's `use()` hook for efficient data loading:

**Server Component** (creates promises, doesn't await):
```typescript
const userPromise = Promise.resolve(user)
const connectionsPromise = getUserConnections(user.id || '')
const toolCallsPromise = getUserToolCalls(user.id)
const supportRequestsPromise = getUserSupportRequests(user.email || '')
```

**Client Component** (unwraps with `use()`):
```typescript
const user = use(userPromise)
const connections = use(connectionsPromise)
const toolCalls = use(toolCallsPromise)
const supportRequests = use(supportRequestsPromise)
```

### Timeline Event Aggregation
The UI creates a unified activity timeline by:

1. **Event Normalization**: Converting all activities to `TimelineEvent` interface
2. **Deduplication**: Removing duplicate connections by `serverId + createdAt`
3. **Chronological Sorting**: Most recent events first
4. **Interactive Details**: Expandable event information

```typescript
interface TimelineEvent {
    id: string
    type: 'connection' | 'tool_call' | 'support_request'
    timestamp: number
    serverName: string
    serverId: string
    details: any
}
```

## Data Flow Architecture

### 1. Request Routing (VHost-Based)
```
Request: acme-corp.mcplatform.com/api/mcpserver/...
↓
Extract subdomain: "acme-corp"
↓
Query: mcpServers WHERE slug = "acme-corp" (uses mcp_server_slug_idx)
↓
Route to correct server configuration
```

### 2. User Identification Flow
```
Anonymous User (trackingId) 
↓
OAuth Flow (optional)
↓
mcpOAuthUser created
↓
mcpServerUser enriched via email JOIN (uses mcp_server_user_email_idx)
```

### 3. Activity Tracking Flow
```
Tool Call Initiated
↓
Create mcpServerSession (if new)
↓
Record toolCalls entry
↓
Link: server + user + session
```

### 4. Support Request Flow
```
User submits support request
↓
Create supportRequests entry
↓
Link: organization + server + email + session (optional)
```

## Performance Considerations

### Comprehensive Indexing Strategy

The schema includes strategic indexes for optimal query performance:

#### **mcpServers**
- `mcp_server_slug_idx` on `slug` - Critical for subdomain-based routing

#### **mcpServerUser**  
- `mcp_server_user_distinct_id_idx` on `trackingId` - Fast anonymous user lookups
- `mcp_server_user_email_idx` on `email` - Efficient OAuth enrichment queries

#### **mcpServerSession**
- `mcp_server_session_user_id_idx` on `mcpServerUserId` - User session history queries
- `mcp_server_session_mcp_server_slug_idx` on `mcpServerSlug` - Server-specific session queries

#### **toolCalls**
- `tool_calls_mcp_server_session_id_idx` on `mcpServerSessionId` - Session-based tool call filtering

### Query Optimization
- **LEFT JOINs**: Used for optional data enrichment
- **Post-filtering**: Remove null JOINed records in application layer
- **Timestamp Ordering**: Efficient sorting on indexed `createdAt` fields
- **Index Coverage**: All foreign keys and frequent lookup fields are indexed

### Data Integrity
- **Cascade Deletes**: Proper cleanup when organizations/servers are removed
- **Triple Scoping**: Support requests tied to org, server, and optionally session
- **Email Matching**: Flexible user linking without strict FK constraints
- **Unique Constraints**: `slug` for routing, `trackingId` for anonymous users (nulls not distinct)

## Migration Considerations

When updating the schema, consider:

1. **Foreign Key Changes**: May require data migration for existing relationships
2. **Cascade Behavior**: Changes affect deletion patterns
3. **Index Updates**: New queries may need additional indexes
4. **UI Query Updates**: Data fetching functions may need modification
5. **Type Safety**: Update TypeScript types after schema changes
6. **Session Linking**: Support requests can now link to specific sessions for better context

## Common Query Patterns

### User Activity Summary
```typescript
// Get user's complete activity across all servers
const activity = await db
    .select({
        toolCallCount: count(toolCalls.id),
        serverCount: countDistinct(mcpServers.id),
        lastActivity: max(toolCalls.createdAt)
    })
    .from(mcpServerUser)
    .leftJoin(toolCalls, eq(mcpServerUser.id, toolCalls.mcpServerUserId))
    .leftJoin(mcpServers, eq(toolCalls.mcpServerId, mcpServers.id))
    .where(eq(mcpServerUser.id, userId))
```

### Session-Based Tool Call Queries
```typescript
// Get all tool calls for a specific session (leverages tool_calls_mcp_server_session_id_idx)
const sessionToolCalls = await db
    .select()
    .from(toolCalls)
    .where(eq(toolCalls.mcpServerSessionId, sessionId))
    .orderBy(desc(toolCalls.createdAt))
```

### Server Usage Analytics
```typescript
// Get server usage metrics for organization (leverages mcp_server_slug_idx)
const metrics = await db
    .select({
        serverId: mcpServers.id,
        serverName: mcpServers.name,
        userCount: countDistinct(mcpServerUser.id),
        toolCallCount: count(toolCalls.id)
    })
    .from(mcpServers)
    .leftJoin(toolCalls, eq(mcpServers.id, toolCalls.mcpServerId))
    .leftJoin(mcpServerUser, eq(toolCalls.mcpServerUserId, mcpServerUser.id))
    .where(eq(mcpServers.organizationId, organizationId))
    .groupBy(mcpServers.id, mcpServers.name)
```

### User Session History with Context
```typescript
// Get user sessions with server context (leverages multiple indexes)
const sessions = await db
    .select({
        session: mcpServerSession,
        server: mcpServers
    })
    .from(mcpServerSession)
    .leftJoin(mcpServers, eq(mcpServerSession.mcpServerSlug, mcpServers.slug))
    .where(eq(mcpServerSession.mcpServerUserId, userId))
    .orderBy(desc(mcpServerSession.connectionTimestamp))
```

This architecture provides a robust foundation for tracking user interactions across multiple MCP servers while maintaining clear separation between customer management and end-user analytics. The comprehensive indexing strategy ensures optimal performance for all common query patterns.