# Walkthrough Database Schema

This document describes the database schema for MCPlatform's walkthrough system, which enables customers to create interactive tutorials and courses that can be embedded into their documentation sites.

## Overview

The walkthrough system consists of 5 interconnected tables that support:
- Creating and managing walkthrough content
- Assigning walkthroughs to MCP servers
- Tracking user progress and completion
- Detailed analytics for customer insights

## Database Tables

### 1. `walkthroughs` - Main Walkthrough Entity

The core table storing walkthrough metadata and configuration.

```sql
CREATE TABLE walkthroughs (
    id TEXT PRIMARY KEY,                    -- Format: wt_{8-char-nanoid}
    organization_id TEXT NOT NULL,         -- References organization.id
    title TEXT NOT NULL,
    description TEXT,
    type walkthrough_type DEFAULT 'course' NOT NULL,
    status walkthrough_status DEFAULT 'draft',
    created_at BIGINT DEFAULT (current timestamp),
    updated_at BIGINT DEFAULT (current timestamp),
    estimated_duration_minutes INTEGER,
    tags JSONB DEFAULT '[]',               -- Array of strings
    metadata JSONB                         -- Flexible metadata storage
);
```

**Key Fields:**
- **`id`**: Auto-generated with `wt_` prefix + 8-character nanoid
- **`type`**: One of `course`, `installer`, `troubleshooting`, `integration`, `quickstart`
- **`status`**: One of `draft`, `published`, `archived`
- **`tags`**: JSON array of strings for categorization
- **`metadata`**: Flexible JSON field for future extensions

**Indexes:**
- `walkthroughs_organization_id_idx` - Organization-based queries
- `walkthroughs_status_idx` - Status filtering

### 2. `walkthrough_steps` - Step Content and Structure

Contains the individual steps that make up each walkthrough, with rich content fields designed for AI agent interaction.

```sql
CREATE TABLE walkthrough_steps (
    id TEXT PRIMARY KEY,                    -- Format: wts_{8-char-nanoid}
    walkthrough_id TEXT NOT NULL,          -- References walkthroughs.id
    title TEXT NOT NULL,
    content_fields JSONB NOT NULL DEFAULT '{...}',
    display_order INTEGER NOT NULL DEFAULT 0,
    next_step_id TEXT,                      -- Self-referencing for step linking
    created_at BIGINT DEFAULT (current timestamp),
    updated_at BIGINT DEFAULT (current timestamp),
    metadata JSONB
);
```

**Content Fields Structure (`content_fields` JSON):**
```typescript
{
    version: 'v1',
    introductionForAgent: string,    // Step overview for AI agent
    contextForAgent: string,         // Context and information sources  
    contentForUser: string,          // What agent should tell the user
    operationsForAgent: string       // Actions for agent to perform
}
```

**Key Fields:**
- **`display_order`**: Determines step sequence within walkthrough
- **`next_step_id`**: Optional linking to create step flows (self-referencing)
- **`content_fields`**: Versioned JSON structure with agent-specific content

**Indexes:**
- `walkthrough_steps_walkthrough_id_idx` - Steps per walkthrough
- `walkthrough_steps_display_order_idx` - Ordering queries
- `walkthrough_steps_next_step_id_idx` - Step linking queries

### 3. `mcp_server_walkthroughs` - Server Assignment Junction

Links walkthroughs to MCP servers, enabling customers to assign specific walkthroughs to their documentation sites.

```sql
CREATE TABLE mcp_server_walkthroughs (
    id TEXT PRIMARY KEY,                    -- Format: msw_{8-char-nanoid}
    mcp_server_id TEXT NOT NULL,           -- References mcp_servers.id
    walkthrough_id TEXT NOT NULL,          -- References walkthroughs.id
    display_order INTEGER NOT NULL DEFAULT 0,
    is_enabled TEXT NOT NULL DEFAULT 'true', -- 'true' or 'false'
    created_at BIGINT DEFAULT (current timestamp)
);
```

**Key Fields:**
- **`display_order`**: Controls walkthrough ordering within each MCP server
- **`is_enabled`**: Allows temporary disabling without deletion

**Constraints:**
- **Unique constraint**: `(mcp_server_id, walkthrough_id)` - One assignment per server-walkthrough pair

**Indexes:**
- `mcp_server_walkthroughs_server_id_idx` - Server-based queries
- `mcp_server_walkthroughs_walkthrough_id_idx` - Walkthrough usage tracking
- `mcp_server_walkthroughs_display_order_idx` - Ordering queries

### 4. `walkthrough_progress` - User Progress Tracking

Tracks individual user progress through walkthroughs, enabling resumption and completion analytics.

```sql
CREATE TABLE walkthrough_progress (
    id TEXT PRIMARY KEY,                    -- Format: wtp_{8-char-nanoid}
    mcp_server_user_id TEXT NOT NULL,      -- References mcp_server_user.id
    walkthrough_id TEXT NOT NULL,          -- References walkthroughs.id
    completed_steps JSONB DEFAULT '[]',    -- Array of completed step IDs
    current_step_id TEXT,                   -- References walkthrough_steps.id
    completed_at BIGINT,                    -- NULL until walkthrough completed
    started_at BIGINT DEFAULT (current timestamp),
    last_activity_at BIGINT DEFAULT (current timestamp),
    metadata JSONB
);
```

**Key Fields:**
- **`completed_steps`**: JSON array of step IDs for fast progress queries
- **`current_step_id`**: Pointer to user's current position
- **`completed_at`**: Set when walkthrough is fully completed

**Indexes:**
- `walkthrough_progress_user_id_idx` - User-based progress queries
- `walkthrough_progress_walkthrough_id_idx` - Walkthrough analytics
- `walkthrough_progress_last_activity_idx` - Activity-based queries
- `walkthrough_progress_completed_steps_gin_idx` - GIN index for array operations

### 5. `walkthrough_step_completions` - Detailed Analytics Events

Records individual step completion events for detailed analytics and flow analysis.

```sql
CREATE TABLE walkthrough_step_completions (
    id TEXT PRIMARY KEY,                    -- Format: wtsc_{8-char-nanoid}
    mcp_server_user_id TEXT NOT NULL,      -- References mcp_server_user.id
    walkthrough_id TEXT NOT NULL,          -- References walkthroughs.id
    step_id TEXT NOT NULL,                  -- References walkthrough_steps.id
    mcp_server_id TEXT NOT NULL,           -- References mcp_servers.id
    mcp_server_session_id TEXT NOT NULL,   -- References mcp_server_session.id
    completed_at BIGINT DEFAULT (current timestamp),
    metadata JSONB
);
```

**Key Fields:**
- **Rich Context**: Links completion to user, walkthrough, step, server, and session
- **`completed_at`**: Precise completion timestamp for analytics

**Constraints:**
- **Unique constraint**: `(mcp_server_user_id, walkthrough_id, step_id)` - Prevents duplicate completions

**Specialized Indexes for Analytics:**
- `wtsc_server_time_idx` - Organization time-series queries via server JOIN
- `wtsc_walkthrough_step_time_idx` - Sankey diagram flow analysis  
- `wtsc_user_walkthrough_idx` - User progress queries
- `wtsc_session_idx` - Session-based completion analysis
- `wtsc_server_walkthrough_idx` - Organization-wide walkthrough analytics

## Data Flow and Relationships

### Creation Flow
1. **Organization** creates a **Walkthrough** with metadata
2. **Walkthrough Steps** are added with content and ordering
3. **Walkthrough** is assigned to one or more **MCP Servers**

### User Interaction Flow  
1. End-user accesses MCP server with assigned walkthroughs
2. **Walkthrough Progress** record created on first interaction
3. **Step Completions** recorded for each completed step
4. **Progress** updated with current step and completion status

### Analytics Queries
- **Organization Dashboard**: Server-based time series using `wtsc_server_time_idx`
- **Flow Analysis**: Step-to-step progression using `wtsc_walkthrough_step_time_idx`
- **User Journey**: Individual progress using `wtsc_user_walkthrough_idx`
- **Session Analysis**: Within-session behavior using `wtsc_session_idx`

## Design Patterns

### ID Generation
All tables use text IDs with descriptive prefixes:
- `wt_` - Walkthroughs
- `wts_` - Walkthrough Steps  
- `msw_` - MCP Server Walkthroughs
- `wtp_` - Walkthrough Progress
- `wtsc_` - Walkthrough Step Completions

### Timestamp Storage
- Uses `bigint` for all timestamps (JavaScript `Date.now()` values)
- Avoids native `timestamp` types for consistency

### JSON Content Strategy
- **Versioned Content**: `content_fields` includes `version` for schema evolution
- **Flexible Metadata**: All tables include `metadata` JSONB for extensions
- **Array Storage**: Uses JSONB arrays with GIN indexes for efficient queries

### Cascade Delete Strategy
- Organization deletion cascades to all related walkthrough data
- Walkthrough deletion removes steps, assignments, and progress
- Maintains referential integrity throughout the hierarchy

## Query Examples

### Get Walkthrough with Steps
```sql
SELECT w.*, 
       json_agg(ws.* ORDER BY ws.display_order) as steps
FROM walkthroughs w
LEFT JOIN walkthrough_steps ws ON w.id = ws.walkthrough_id
WHERE w.id = 'wt_abc123'
GROUP BY w.id;
```

### User Progress Summary
```sql
SELECT w.title,
       wp.started_at,
       wp.last_activity_at,
       wp.completed_at,
       jsonb_array_length(wp.completed_steps) as completed_count,
       COUNT(ws.id) as total_steps
FROM walkthrough_progress wp
JOIN walkthroughs w ON wp.walkthrough_id = w.id
LEFT JOIN walkthrough_steps ws ON w.id = ws.walkthrough_id
WHERE wp.mcp_server_user_id = 'user_123'
GROUP BY w.id, wp.id;
```

### Organization Completion Analytics
```sql
SELECT w.title,
       COUNT(DISTINCT wtsc.mcp_server_user_id) as unique_users,
       COUNT(wtsc.id) as total_completions,
       DATE_TRUNC('day', to_timestamp(wtsc.completed_at / 1000)) as completion_date
FROM walkthrough_step_completions wtsc
JOIN mcp_servers ms ON wtsc.mcp_server_id = ms.id
JOIN walkthroughs w ON wtsc.walkthrough_id = w.id
WHERE ms.organization_id = 'org_123'
GROUP BY w.id, completion_date
ORDER BY completion_date DESC;
```