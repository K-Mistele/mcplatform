---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "Support Ticket Management Research"
tags: [research, support-tickets, ticket-management, database, ui]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
type: research
---

# Support Ticket Management Research

## Overview
This document analyzes how support ticket management is implemented in MCPlatform, including the database schema, UI components, backend logic, integrations, and MCP server session associations.

## A. Linear/Slack Support Ticket Integration Status

**Current Status: NOT ENABLED**

The system includes database schema support for Linear and Slack integrations, but they are **not currently implemented**:

- Database schema defines support request methods: `'slack'`, `'linear'`, `'dashboard'`, `'none'` in `packages/database/src/schema.ts:6`
- MCP servers have a `supportTicketType` field that can be set to these values (`packages/database/src/schema.ts:49`)
- However, the actual implementation explicitly throws errors for these integrations:
  - `packages/dashboard/src/lib/mcp/tools/support.ts:28`: `if (serverConfig.supportTicketType === 'slack') throw new Error('Slack tickets are not supported yet')`
  - `packages/dashboard/src/lib/mcp/tools/support.ts:29`: `if (serverConfig.supportTicketType === 'linear') throw new Error('Linear tickets are not supported yet')`

**Only the 'dashboard' method is currently supported and functional.**

## B. MCP Server Session Association

**YES - Support tickets are associated with MCP server sessions.**

Support tickets have explicit foreign key relationships to MCP server sessions:

### Database Relationships
- `support_requests.mcpServerSessionId` � `mcp_server_session.mcpServerSessionId` (with cascade delete)
- `support_requests.mcpServerId` � `mcp_servers.id` (with cascade delete)

### Implementation Details
- When a support ticket is created via the `get_support` MCP tool, it captures:
  - `mcpServerId`: The MCP server where the ticket was created
  - `mcpServerSessionId`: The specific session ID where the ticket was submitted
  - Location: `packages/dashboard/src/lib/mcp/tools/support.ts:135-136`

### Backend Queries
- The system provides RPC endpoints to query support tickets by session:
  - `getSessionSupportTickets` in `packages/dashboard/src/lib/orpc/router.ts:343-373`
  - Filters tickets by `mcpServerSessionId` and ensures organization ownership

## C. Database Schema

### Main Tables

#### `support_requests` (`packages/database/src/schema.ts:13-32`)
```typescript
{
    id: text (primary key, format: "sr_${nanoid(8)}")
    createdAt: bigint (timestamp in milliseconds)
    title: text
    conciseSummary: text (problem description)
    context: text (additional context)
    status: enum ('needs_email', 'pending', 'in_progress', 'resolved', 'closed')
    supportRequestMethod: enum ('slack', 'linear', 'dashboard', 'none')
    resolvedAt: bigint (timestamp in milliseconds, nullable)
    email: text (required - user's email)
    organizationId: text (FK to organization.id, cascade delete)
    mcpServerId: text (FK to mcp_servers.id, cascade delete)
    mcpServerSessionId: text (FK to mcp_server_session.mcpServerSessionId, cascade delete)
}
```

#### Related Tables
- `mcp_servers`: Contains `supportTicketType` field defining which ticket method to use
- `mcp_server_session`: Session data for MCP connections
- `mcp_server_user`: User tracking data

### Key Schema Patterns
- Uses `nanoid` for ID generation with prefixes (e.g., `sr_` for support requests)
- Timestamps stored as `bigint` milliseconds, not native timestamp types
- Cascade deletes maintain referential integrity

## D. UI Components and Pages

### Main UI Pages
1. **Support Tickets List**: `/dashboard/support-tickets/page.tsx`
   - Server component that fetches all support tickets for the organization
   - Passes data as promises to client component with Suspense boundaries
   - Joins with `mcp_servers` to show server names and slugs

2. **Support Ticket Details**: `/dashboard/support-tickets/[ticketId]/page.tsx`
   - Detailed view of individual support tickets
   - Shows ticket information, MCP server details, summary, and context
   - Includes security check to ensure ticket belongs to user's organization

### Client Components
- **SupportTicketsClient** (`packages/dashboard/src/components/support-tickets-client.tsx`):
  - Handles filtering by email, MCP server, and status
  - Table view with ticket details and navigation links
  - Uses React 19 `use()` hook to unwrap promise data

### UI Features
- Status badges with color coding for different ticket states
- Email links for contacting users
- Links to associated MCP servers
- Filtering capabilities (email, server, status)
- Responsive table layout

## E. Backend Routes and Implementation

### MCP Tool Integration
- **Tool Name**: `get_support` (registered in each MCP server)
- **Location**: `packages/dashboard/src/lib/mcp/tools/support.ts`
- **Functionality**:
  - Collects problem description, title, and context from AI assistant
  - Handles email collection for non-OAuth users
  - Creates database records in both `tool_calls` and `support_requests` tables
  - Returns success message to assistant

### RPC Endpoints
- **Router**: `packages/dashboard/src/lib/orpc/router.ts`
- **Available Endpoints**:
  - `getSessionToolCalls`: Get all tool calls for a session
  - `getSessionSupportTickets`: Get all support tickets for a session
  - Both require session authentication and organization ownership validation

### API Architecture
- No dedicated REST API endpoints for support tickets
- Uses oRPC for type-safe RPC calls
- MCP server API route handles tool calls that create tickets
- Frontend uses server components for data fetching, client components for interactivity

### Authentication & Authorization
- Platform authentication required for dashboard access
- Organization-based multi-tenancy (tickets filtered by `organizationId`)
- MCP server sessions can be authenticated or anonymous (email collection fallback)

## Summary

The support ticket system is fully functional for dashboard-based tickets with strong MCP server session associations. Linear and Slack integrations are planned (schema exists) but not implemented. The system follows the platform's architectural patterns with server components, oRPC, and proper security boundaries.