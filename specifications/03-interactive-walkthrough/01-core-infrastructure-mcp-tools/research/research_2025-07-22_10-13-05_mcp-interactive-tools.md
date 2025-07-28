---
date: 2025-07-22T10:13:05-05:00
researcher: Kyle Mistele
git_commit: 1e45d8ac64fa99d6152abf5adc1cd8f55900e040
branch: master
repository: mcplatform
topic: "MCP Interactive Tools Implementation and Design Patterns"
tags: [research, codebase, mcp, interactive-tools, oauth, walkthrough, semantic-installer]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
---

# Research: MCP Interactive Tools Implementation and Design Patterns

**Date**: 2025-07-22T10:13:05-05:00
**Researcher**: Kyle Mistele
**Git Commit**: 1e45d8ac64fa99d6152abf5adc1cd8f55900e040
**Branch**: master
**Repository**: mcplatform

## Research Question

How are MCP tools implemented both in this codebase and in the MCP protocol, specifically for building interactive walkthroughs and semantic installer wizards that provide step-by-step guidance to end-users through MCP tools with streamable HTTP transport and OAuth authentication?

## Summary

The research reveals a sophisticated MCP implementation in MCPlatform that combines VHost-based routing, dual authentication systems, and streamable HTTP transport. The codebase already includes robust multi-step wizard patterns that can be extended to create interactive MCP tools. Key findings include:

1. **Mature MCP Infrastructure**: Complete implementation with Redis state management, OAuth integration, and tool registration patterns
2. **Dual Authentication Architecture**: Separate systems for platform customers and end-users, enabling proper user de-anonymization
3. **Interactive Patterns Already Exist**: Sophisticated onboarding wizards provide a foundation for MCP-based walkthroughs
4. **Community Best Practices**: Well-established patterns for interactive MCP tools including human-in-the-loop workflows

## Detailed Findings

### MCP Protocol Implementation

**Core Architecture** (`packages/dashboard/src/lib/mcp/index.ts:27-64`):
- Uses `mcp-handler` package with Redis state management
- Streamable HTTP transport only (`disableSse: true`) 
- VHost-based routing via `Host` header subdomain extraction
- Base path includes optional tracking ID: `/api/mcpserver/${trackingId}`

**Transport Layer** (`packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:5-8`):
- Dual transport patterns: SSE and streamable HTTP
- Route patterns: `/api/mcpserver/{trackingid}/mcp` for streamable HTTP
- Session management with `Mcp-Session-Id` headers

**Tool Registration Pattern** (`packages/dashboard/src/lib/mcp/index.ts:78-94`):
```typescript
export function registerMcpServerToolsFromConfig({
    server, serverConfig, trackingId, email, 
    mcpServerUserId, serverSessionId
}) {
    registerMcpSupportTool({ /* params */ })
}
```

### OAuth and Authentication Integration

**Dual Authentication System**:
- **Platform Auth**: `/packages/dashboard/src/lib/auth/auth.ts` - Customer dashboard access
- **Sub-tenant Auth**: `/packages/dashboard/src/lib/auth/mcp/auth.ts` - End-user de-anonymization via OAuth

**OAuth Discovery Endpoints**:
- Authorization Server Metadata: `/.well-known/oauth-authorization-server`
- Protected Resource Metadata: `/.well-known/oauth-protected-resource`

**Authentication Flow Integration**:
- OAuth protection wrapper conditionally applied based on `serverConfig.authType`
- WWW-Authenticate headers include OAuth discovery metadata
- User email from OAuth session flows to MCP tools for personalization

### Interactive Tool Patterns from Community Research

**MCP Protocol Interactive Capabilities**:
- Context-aware multi-step workflows
- Real-time feedback via Server-Sent Events
- Progress notifications and request cancellation
- Human-in-the-loop approval patterns

**Interactive Feedback MCP Pattern**:
```xml
<use_mcp_tool>
  <server_name>interactive-feedback-mcp</server_name>
  <tool_name>interactive_feedback</tool_name>
  <arguments>
    {
      "project_directory": "/path/to/project",
      "summary": "Step X completed. Should I proceed to Step Y?"
    }
  </arguments>
</use_mcp_tool>
```

**Semantic Installer Wizard Patterns**:
1. Progressive disclosure of complexity
2. Step-by-step configuration with validation
3. Context preservation across tool calls
4. Explicit confirmation for significant actions

### Existing Interactive Patterns in Codebase

**Onboarding Wizard Implementation** (`packages/dashboard/src/components/onboarding/create-organization.tsx`):
- Multi-step progress tracking with percentage completion
- Conditional navigation and step skipping
- Form validation at each step
- Back/forward navigation with state management
- Loading states and comprehensive error handling

**Key Interactive Components**:
- `OnboardingFlow` - Main wizard orchestrator with progress indicators
- Step-specific validation before progression
- Dynamic step counting based on workflow branches
- Responsive design with accessibility considerations

### Current Tool Implementation Example

**Support Tool** (`packages/dashboard/src/lib/mcp/tools/support.ts:88-160`):
- Dynamic input schema based on authentication configuration
- Handles both authenticated and unauthenticated users
- Comprehensive tracking in database (`toolCalls` and `supportRequests` tables)
- Integration with server session context

## Code References

- `packages/dashboard/src/lib/mcp/index.ts:27-64` - Core MCP server creation and configuration
- `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:1-88` - HTTP transport endpoint
- `packages/dashboard/src/lib/mcp/tools/support.ts:88-160` - Example tool implementation
- `packages/dashboard/src/lib/auth/mcp/auth.ts:8-37` - Sub-tenant OAuth configuration
- `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:12-40` - OAuth protection wrapper
- `packages/dashboard/src/components/onboarding/create-organization.tsx` - Multi-step wizard patterns
- `packages/database/src/schema.ts:64-116` - MCP server and tool call schemas

## Architecture Insights

**VHost-Based Multi-Tenancy**: Each MCP server gets a unique subdomain (e.g., `acme-corp.mcplatform.com`) with routing determined by `Host` header parsing rather than path-based routing. This enables a single API endpoint to serve countless different MCP servers dynamically.

**Session State Management**: Comprehensive user tracking system that bridges OAuth authentication with MCP tool execution, enabling personalized experiences while maintaining proper user de-anonymization for analytics.

**Tool Registration Architecture**: Extensible pattern where tools are registered based on server configuration, allowing for different tool sets per customer organization while maintaining consistent implementation patterns.

**Interactive UI Foundations**: The codebase already implements sophisticated multi-step wizard patterns with progress tracking, validation, and error handling that provide an excellent foundation for MCP-based interactive experiences.

## Historical Context

The specifications directory structure includes `03-interactive-walkthrough/` but the thoughts subdirectory is currently empty, indicating this feature is planned but not yet specified. The existing requirements creation process (`specifications/thoughts/create_requirements_command.md`) emphasizes iterative, user-centered design patterns that align well with interactive walkthrough requirements.

## Design Recommendations for Interactive MCP Tools

### 1. **Interactive Walkthrough Tool Architecture**
- Extend existing wizard patterns to create MCP tools that guide users through multi-step processes
- Leverage the dual authentication system for both customer configuration and end-user guidance
- Use the existing session tracking to maintain context across tool interactions

### 2. **Semantic Installer Wizard Implementation**
- Create MCP tools that provide step-by-step installation guidance
- Use progressive disclosure patterns similar to existing onboarding flows
- Implement validation at each step with clear feedback mechanisms
- Enable human-in-the-loop confirmation for critical actions

### 3. **Technical Implementation Patterns**
- Build on existing `OnboardingFlow` component patterns for consistency
- Use oRPC server actions for tool mutations with proper path revalidation
- Implement streaming responses for long-running installation processes
- Leverage Redis state management for complex multi-step workflows

### 4. **User Experience Guidelines**
- Start with simple tools and gradually reveal advanced capabilities
- Provide clear progress indication throughout multi-step processes
- Maintain conversation state across tool calls for contextual guidance
- Implement graceful error handling with appropriate fallback options

## Related Research

This research builds upon the existing comprehensive codebase documentation in `CLAUDE.md` and extends the MCP server implementation patterns already established in the platform.

## Open Questions

1. **Tool State Persistence**: How should long-running walkthrough state be persisted across browser sessions?
2. **Multi-User Coordination**: How should collaborative walkthrough experiences be handled when multiple users are involved?
3. **Tool Versioning**: How should walkthrough tools handle updates to underlying systems or processes?
4. **Error Recovery**: What recovery mechanisms should be implemented for interrupted walkthrough sessions?
5. **Analytics Integration**: How should walkthrough completion and abandonment be tracked for customer insights?