---
date: 2025-08-04T11:18:22-07:00
researcher: Kyle
git_commit: bb50e1ae446ae5d3252043d32e359c0e59124499
branch: master
repository: mcplatform
topic: "Understanding the Walkthrough System Architecture and Implementation"
tags: [research, codebase, walkthroughs, mcp-tools, ui-components, architecture]
status: complete
last_updated: 2025-08-04
last_updated_by: Kyle
type: research
---

# Research: Understanding the Walkthrough System Architecture and Implementation

**Date**: 2025-08-04T11:18:22-07:00
**Researcher**: Kyle
**Git Commit**: bb50e1ae446ae5d3252043d32e359c0e59124499
**Branch**: master
**Repository**: mcplatform

## Research Question
Research the codebase to understand how walkthroughs work and are implemented, in preparation for converting the Replicated quick-start documentation into a walkthrough for the platform.

## Summary
The MCPlatform walkthrough system is a sophisticated multi-tenant platform for creating interactive, AI-guided learning experiences. It features a three-layer architecture: database storage with flexible content fields, MCP tools for AI agent interaction, and a comprehensive UI with multi-panel editing. The system uses ID-based progress tracking that survives walkthrough modifications, smart MCP tools that auto-adapt based on context, and supports cross-environment deployment through export/import utilities.

## Detailed Findings

### Database Architecture
The walkthrough system uses a multi-table PostgreSQL schema with the following key components:

- **Core Tables** ([schema.ts:183-287](packages/database/src/schema.ts#L183)):
  - `walkthroughs`: Main table with organization scoping, type enum (course, installer, troubleshooting, etc.), and status tracking
  - `walkthrough_steps`: Steps with flexible JSON content fields and display ordering
  - `mcp_server_walkthroughs`: Many-to-many association table for server assignments
  - `walkthrough_progress`: User progress tracking with array of completed step IDs
  - `walkthrough_step_completions`: Analytics table for completion events

- **Key Design Decisions**:
  - Content stored directly in PostgreSQL (not S3) for simplicity and transactional integrity
  - ID-based progress tracking using immutable step IDs with separate `display_order` field
  - Flexible content fields using discriminated unions with versioning support

### MCP Tools Integration
The system provides two main MCP tools for AI agent interaction:

- **`start_walkthrough` Tool** ([walkthrough.ts:130-275](packages/dashboard/src/lib/mcp/tools/walkthrough.ts#L130)):
  - Smart behavior: auto-starts single walkthroughs or lists multiple options
  - Supports restart functionality to clear existing progress
  - Tracks all interactions in `toolCalls` table for analytics

- **`get_next_step` Tool** ([walkthrough.ts:282-431](packages/dashboard/src/lib/mcp/tools/walkthrough.ts#L282)):
  - Combines step completion with progression logic
  - Automatically advances through walkthrough steps
  - Returns formatted content using template engine

### Content Structure and Templates
The system uses structured content fields optimized for AI agent consumption:

- **Content Fields** ([schema.ts:217-223](packages/database/src/schema.ts#L217)):
  - `introductionForAgent`: Context for the AI about the step
  - `contextForAgent`: Background information needed
  - `contentForUser`: Main content to present to the user
  - `operationsForAgent`: Specific actions the AI should perform

- **Template Engine** ([template-engine.ts:95-142](packages/dashboard/src/lib/template-engine.ts#L95)):
  - Converts structured content into formatted markdown
  - Uses XML-like sections for clear agent guidance
  - Includes progress metadata and navigation hints

### UI Architecture
The walkthrough system features a comprehensive authoring interface:

- **Three-Panel Editor** ([walkthrough-editor.tsx:108-152](packages/dashboard/src/components/walkthrough-editor.tsx#L108)):
  - Resizable panels using `react-resizable-panels`
  - Steps Navigator: Drag-and-drop step reordering with `@dnd-kit/sortable`
  - Content Editor: Form-based editing with draft management
  - Preview Panel: Live preview with raw/rendered modes

- **Key UI Components**:
  - `walkthroughs-client.tsx`: Data table with sorting/filtering using `@tanstack/react-table`
  - `walkthrough-assignment-card.tsx`: Drag-and-drop server assignment interface
  - `create-walkthrough-modal.tsx`: Type-based walkthrough creation
  - `publication-status-card.tsx`: Draft/published status management

### Progress Tracking Algorithm
The system implements resilient progress tracking that survives walkthrough modifications:

- **Core Algorithm** ([walkthrough-utils.ts:65-101](packages/dashboard/src/lib/mcp/walkthrough-utils.ts#L65)):
  ```typescript
  // Progress based on completed step IDs, not positions
  const completedStepIds = progress?.completedSteps || []
  const nextStep = steps.find((step) => !completedStepIds.includes(step.id))
  ```

- **Resilience Features**:
  - Progress preserved when steps are reordered
  - New steps automatically appear as incomplete
  - Deleted steps are gracefully ignored
  - Completion percentage calculated dynamically

### Export/Import System
The platform supports cross-environment deployment of walkthroughs:

- **Export Functionality** ([export-walkthrough.ts:31-96](scripts/walkthrough-tools/export-walkthrough.ts#L31)):
  - Exports walkthrough with all steps to JSON
  - Strips organization-specific IDs
  - Preserves content and structure

- **Import Functionality** ([import-walkthrough.ts:33-133](scripts/walkthrough-tools/import-walkthrough.ts#L33)):
  - Generates new IDs for imported content
  - Maintains step relationships and ordering
  - Associates with target organization

### Testing Patterns
Comprehensive test coverage demonstrates usage patterns:

- **Test Setup** ([walkthrough-core-infrastructure.test.ts:42-128](packages/dashboard/tests/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/walkthrough-core-infrastructure.test.ts#L42)):
  - Creates full hierarchy: organization → MCP server → user → session → walkthrough → steps
  - Tracks all created resources for cleanup
  - Tests both utility functions and MCP tools

- **Integration Testing** ([walkthrough-mcp-tools.test.ts:554-616](packages/dashboard/tests/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/walkthrough-mcp-tools.test.ts#L554)):
  - Complete user flows from start to completion
  - Edge case coverage (empty walkthroughs, reordering, invalid operations)
  - Analytics verification for all operations

## Architecture Insights

### VHost-Based Routing
The system uses subdomain-based routing for MCP servers:
- Single API endpoint serves multiple MCP servers
- `getMcpServerConfiguration` extracts subdomain from Host header
- Matches against server `slug` field for configuration lookup

### Dual Authentication System
Two parallel authentication systems serve different purposes:
- **Platform Auth**: Customer dashboard access (primary Better Auth instance)
- **Sub-tenant Auth**: End-user de-anonymization (separate Better Auth instance)
- Clean separation ensures customers never see end-user auth flows

### Type-Driven UI Requirements
Different walkthrough types have different content requirements:
- **Course**: Minimal fields (content and context)
- **Troubleshooting**: All fields required for comprehensive guidance
- **Quickstart**: Simplified with just user content
- UI dynamically adjusts based on selected type

## Historical Context (from thoughts/)

### Key Design Decisions
- **Many-to-Many Architecture** (`specifications/03-interactive-walkthrough/thoughts/technical-specification.md`): Walkthroughs managed independently from MCP servers
- **PostgreSQL Storage** (`specifications/03-interactive-walkthrough/thoughts/technical-specification.md`): Direct text storage chosen over S3 for V1
- **Structured Content** (`specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/thoughts/structured-content-architecture.md`): Transform markdown to structured fields for AI performance
- **Registration-Based Tools** (`specifications/03-interactive-walkthrough/thoughts/research_2025-08-03_12-23-23_mcp-tool-registration.md`): Tools use callback registration pattern

### Implementation Strategy
- **Handoff Documents**: Multiple handoffs track implementation progress (`handoff-0.md` through `handoff-3.md`)
- **Feature Specifications**: Separate specs for core infrastructure, authoring UI, and analytics
- **UI/UX Recommendations**: Comprehensive design patterns documented in thoughts

## Related Research
- `specifications/03-interactive-walkthrough/thoughts/research_2025-08-03_12-23-23_mcp-tool-registration.md` - MCP tool architecture
- `specifications/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/thoughts/step-reordering-resilience-analysis.md` - Progress tracking resilience
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/research/research_2025-07-21_23-07-58_mastra-mcp-course-implementation.md` - Implementation patterns

## Open Questions
1. How should the Replicated quick-start content be structured into walkthrough steps?
2. What type of walkthrough (course, installer, quickstart) best fits the Replicated use case?
3. Should we create multiple walkthroughs for different Replicated features or one comprehensive guide?
4. How should we handle the VM setup requirements in the walkthrough context?