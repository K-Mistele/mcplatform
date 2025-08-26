---
date: 2025-08-05T11:57:51-07:00
researcher: Claude
git_commit: 4bc633cfd1daf4be5f333f2fb08ccebe9ffcb733
branch: master
repository: mcplatform
topic: "MCP Installation Implementation - Add to Cursor Links and Deeplinks"
tags: [research, codebase, mcp-installation, cursor-integration, deeplinks]
status: complete
last_updated: 2025-08-05
last_updated_by: Claude
type: research
---

# Research: MCP Installation Implementation - Add to Cursor Links and Deeplinks

**Date**: 2025-08-05T11:57:51-07:00
**Researcher**: Claude
**Git Commit**: 4bc633cfd1daf4be5f333f2fb08ccebe9ffcb733
**Branch**: master
**Repository**: mcplatform

## Research Question
How is the MCP installation implemented in the dashboard, specifically the "add to cursor" links and other deeplinks?

## Summary
The MCP installation is implemented through a dedicated `CursorInstallLink` component that provides three installation methods for Cursor IDE: web-based buttons, direct deeplinks, and manual configuration. The system uses a vhost-based routing architecture where MCP servers are accessed via subdomains rather than traditional installation tokens. Currently, only Cursor IDE is supported with no VS Code or other editor integration.

## Detailed Findings

### UI Component Implementation

#### CursorInstallLink Component
- **Location**: `packages/dashboard/src/components/cursor-install-link.tsx:15-179`
- **Purpose**: Provides comprehensive installation UI for Cursor IDE
- **Three Installation Methods**:
  1. **Web Installation Buttons** (lines 109-145)
     - Dark theme: `https://cursor.com/deeplink/mcp-install-dark.svg`
     - Light theme: `https://cursor.com/deeplink/mcp-install-light.svg`
     - Links to: `https://cursor.com/install-mcp?name=${name}&config=${base64Config}`
  
  2. **Direct Deeplink** (lines 147-160)
     - Format: `cursor://anysphere.cursor-deeplink/mcp/install?name=${name}&config=${base64Config}`
     - Base64-encoded JSON configuration
  
  3. **Manual Configuration** (lines 162-176)
     - Target file: `~/.cursor/mcp.json`
     - Raw JSON format for copy-paste

#### Configuration Generation
- **Encoding Process** (`cursor-install-link.tsx:21-35`):
  ```typescript
  const config = { name: serverName, url: serverUrl }
  const base64Config = Buffer.from(JSON.stringify(config)).toString('base64')
  ```
- Server name is URL-encoded for parameter safety
- Configuration contains `name` and `url` fields only

### Backend Architecture

#### VHost-Based Server Resolution
- **Implementation**: `packages/dashboard/src/lib/mcp/index.ts:117-159`
- **Key Function**: `getMcpServerConfiguration()`
  - Extracts subdomain from Host header (line 127)
  - Queries `mcp_servers` table by slug (lines 152-156)
  - Returns null if server not found
- **URL Pattern**: `{slug}.mcplatform.com/api/mcpserver/mcp`

#### Server Creation & Validation
- **Create Action**: `packages/dashboard/src/actions/mcp-servers.ts:10-26`
  - Validates input with `createMcpServerSchema`
  - Requires authenticated session
  - Associates server with organization
  
- **Subdomain Validation**: `packages/dashboard/src/actions/mcp-servers.ts:56-84`
  - Enforces lowercase alphanumeric + hyphens
  - Length limits: 6-36 characters
  - Checks for duplicate slugs

#### User Tracking System
- **Location**: `packages/dashboard/src/lib/mcp/tracking.ts:57-240`
- **Function**: `getAndTrackMcpServerUser()`
  - Tracks users via `Mcp-Session-Id` header
  - Supports OAuth flows for de-anonymization
  - Creates/updates user records with upsert logic

### Database Schema

#### MCP Servers Table
- **Definition**: `packages/database/src/schema.ts:108-127`
- **Key Fields**:
  - `id`: nanoid(8) primary key
  - `slug`: unique subdomain identifier
  - `organizationId`: foreign key for multi-tenancy
  - `authType`: enum for authentication method

#### User Tracking Tables
- **MCP Server User**: `packages/database/src/schema.ts:129-141`
- **MCP Server Session**: `packages/database/src/schema.ts:163-181`
- Tracks user identity and session continuity

### Integration Points

#### Server Details Page
- **Location**: `packages/dashboard/src/app/dashboard/mcp-servers/[serverId]/page.tsx:195`
- Constructs server URL from slug and host (lines 110-114)
- Passes `serverName` and `serverUrl` to `CursorInstallLink`

#### MCP Servers Table
- **Location**: `packages/dashboard/src/components/mcp-servers-table.tsx:113-135`
- Displays server URLs with copy functionality
- No direct installation buttons in table view

## Code References
- `packages/dashboard/src/components/cursor-install-link.tsx:15-179` - Main installation component
- `packages/dashboard/src/lib/mcp/index.ts:117-159` - VHost server resolution
- `packages/dashboard/src/actions/mcp-servers.ts:10-84` - Server creation and validation
- `packages/dashboard/src/lib/mcp/tracking.ts:57-240` - User tracking system
- `packages/dashboard/src/app/dashboard/mcp-servers/[serverId]/page.tsx:195` - Component integration
- `packages/database/src/schema.ts:108-181` - Database schema definitions

## Architecture Insights

### Key Design Patterns
1. **VHost-Based Routing**: Subdomains determine server configuration, not path-based routing
2. **No Installation Tokens**: Real-time configuration lookup via subdomain
3. **Dual Authentication**: Separate systems for platform customers vs end-users
4. **Base64 Configuration**: Safe URL parameter encoding for complex JSON data
5. **Single Editor Support**: Currently Cursor-only, no multi-editor architecture

### Deeplink URL Schemes
1. **Cursor Protocol**: `cursor://anysphere.cursor-deeplink/mcp/install`
2. **Web Fallback**: `https://cursor.com/install-mcp`
3. **Parameters**:
   - `name`: URL-encoded server name
   - `config`: Base64-encoded JSON with name and url

### Installation Flow
1. User navigates to server details page
2. Page constructs server URL from subdomain
3. CursorInstallLink component generates three options
4. User chooses installation method (button/deeplink/manual)
5. Cursor IDE receives configuration and adds MCP server

## Historical Context (from thoughts/)

### Design Decisions
- **No GitHub App Installation**: Explicit decision to avoid GitHub App complexity
- **Subdomain Architecture**: Chosen over traditional installation tokens for simplicity
- **MCP Protocol Focus**: Leverages standard MCP configuration rather than custom deeplinks
- **Interactive Walkthroughs**: Emphasis on guided experiences over installation flows

### Related Research
- `specifications/03-interactive-walkthrough/` - Contains extensive research on MCP tools and guided experiences
- No existing research specifically on installation deeplinks found
- Focus has been on walkthrough delivery rather than installation mechanisms

## Open Questions
1. **VS Code Support**: No implementation found - is this planned?
2. **Other Editors**: No support for Zed, JetBrains IDEs - future roadmap?
3. **Installation Analytics**: How are successful installations tracked?
4. **Error Recovery**: What happens if deeplink installation fails?
5. **Version Compatibility**: How is Cursor version requirement (v1.0+) enforced?
6. **Multi-Server Management**: How do users manage multiple MCP servers in Cursor?

## Recommendations for Feature Development
1. **Expand Editor Support**: Add VS Code, Zed, and other popular IDEs
2. **Installation Tracking**: Implement analytics for successful installations
3. **Error Handling**: Add fallback flows for failed deeplink installations
4. **Version Detection**: Implement Cursor version checking before installation
5. **Bulk Installation**: Support installing multiple MCP servers at once
6. **Uninstall Flow**: Provide removal instructions/automation