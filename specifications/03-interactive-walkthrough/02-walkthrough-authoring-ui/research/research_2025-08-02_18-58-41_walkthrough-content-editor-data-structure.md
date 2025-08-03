---
date: 2025-08-02T18:58:41-05:00
researcher: Claude
git_commit: f76f01de6ef47985179bb769e9000b7763c15d12
branch: master
repository: mcplatform
topic: "Walkthrough Content Editor Data Structure and Templates"
tags: [research, codebase, walkthrough, content-editor, data-structure, templates, prompts]
status: complete
last_updated: 2025-08-02
last_updated_by: Claude
type: research
---

# Research: Walkthrough Content Editor Data Structure and Templates

**Date**: 2025-08-02T18:58:41-05:00
**Researcher**: Claude
**Git Commit**: f76f01de6ef47985179bb769e9000b7763c15d12
**Branch**: master
**Repository**: mcplatform

## Research Question
Understanding the data structure that walkthroughs use, the template system in place, how content is structured based on the JSON object in the database schema, the editing structure, and the shape of the prompt and its purpose.

## Summary
The MCPlatform walkthrough system uses a sophisticated multi-table PostgreSQL structure with JSONB content fields, a versioned schema system, and a template engine that transforms structured content into AI-consumable prompts. The system separates user-facing content from agent instructions through a four-field content model, supports five different walkthrough types with varying field requirements, and uses a form-based editor UI rather than a generic JSON editor.

## Detailed Findings

### Database Schema Structure

#### Core Tables ([schema.ts:182-286](packages/database/src/schema.ts:182-286))
1. **`walkthroughs` Table** ([schema.ts:182-205](packages/database/src/schema.ts:182-205))
   - Primary key: `wt_` prefix + 8-char nanoid
   - Multi-tenant via `organizationId` foreign key
   - Type enum: `'course'`, `'installer'`, `'troubleshooting'`, `'integration'`, `'quickstart'`
   - Status enum: `'draft'`, `'published'`, `'archived'`
   - Metadata stored as JSONB with optional tags array

2. **`walkthrough_steps` Table** ([schema.ts:231-259](packages/database/src/schema.ts:231-259))
   - Primary key: `wts_` prefix + 8-char nanoid
   - **Critical field**: `contentFields` - JSONB with versioned schema
   - Supports both `displayOrder` (integer) and `nextStepId` (linked list)
   - Cascade delete from parent walkthrough

3. **`walkthrough_progress` Table** ([schema.ts:261-286](packages/database/src/schema.ts:261-286))
   - Tracks user progress through `completedSteps` JSONB array
   - Non-destructive progress tracking survives step reordering
   - Links to MCP server users for end-user tracking

4. **`mcp_server_walkthroughs` Junction Table** ([schema.ts:207-229](packages/database/src/schema.ts:207-229))
   - Many-to-many relationship between servers and walkthroughs
   - Per-server display ordering and enable/disable control
   - Unique constraint on `(mcpServerId, walkthroughId)`

### Content Field Structure

#### Versioned Schema ([schema.ts:19-40](packages/database/src/schema.ts:19-40))
```typescript
walkthroughStepContentFieldVersion1 = z.object({
    version: z.literal('v1'),
    introductionForAgent: z.string().optional(),    // Learning objectives & completion criteria
    contextForAgent: z.string().optional(),         // Background information for agent
    contentForUser: z.string().optional(),          // User-facing content to display verbatim
    operationsForAgent: z.string().optional()       // Actions for agent to perform
})
```

**Field Purposes**:
- **introductionForAgent**: Sets step objectives, definitions of done, and navigation instructions
- **contextForAgent**: Provides background context for the agent's reference
- **contentForUser**: Content to be displayed verbatim to the user
- **operationsForAgent**: Specific CRUD operations and tool usage instructions

### Template Engine System

#### Template Structure ([template-engine.ts:8-91](packages/dashboard/src/lib/template-engine.ts:8-91))
The template engine creates structured prompts with:
1. **Header Section**: Walkthrough and step identification
2. **Navigation Context**: Instructions for step progression
3. **Conditional Content Blocks**: XML-wrapped sections for each content field
4. **Verbatim User Content**: Explicit instructions to repeat content exactly

#### Generated Prompt Format
```markdown
# Walkthrough: ${walkthroughTitle}
## Step ${displayOrder}: ${stepTitle}
*Navigation instructions*

<step_information_and_objectives>
${introductionForAgent}
</step_information_and_objectives>

<background_information_context>
${contextForAgent}
</background_information_context>

<operations_to_perform>
${operationsForAgent}
</operations_to_perform>

<step_content>
${contentForUser}
</step_content>
```

### Editor UI Architecture

#### Component Structure ([walkthrough-editor.tsx:1-155](packages/dashboard/src/components/walkthrough-editor.tsx:1-155))
- **Three-panel layout** using ResizablePanelGroup:
  - Left (25%): StepsNavigator with drag-drop reordering
  - Center (50%): ContentEditor with structured form fields
  - Right (25%): PreviewPanel showing raw/rendered output

#### Content Editing ([content-editor.tsx:1-589](packages/dashboard/src/components/content-editor.tsx:1-589))
- **Form-based editing**: Each content field has dedicated textarea
- **Type-specific requirements**: Different walkthrough types require different fields
- **Auto-save**: Draft recovery via localStorage
- **Validation**: React Hook Form with Zod schemas
- **No JSON editor**: Purpose-built UI for structured content

### Walkthrough Type Requirements

#### Field Requirements by Type ([content-editor.tsx:43-74](packages/dashboard/src/components/content-editor.tsx:43-74))
- **Course**: `contextForAgent` + `contentForUser` (required)
- **Installer**: `contextForAgent` + `contentForUser` + `operationsForAgent` (required)
- **Troubleshooting**: All four fields required
- **Integration**: `contextForAgent` + `contentForUser` + `operationsForAgent` (required)
- **Quickstart**: Only `contentForUser` (required)

### Data Flow Architecture

1. **Content Creation**: Form inputs → validated data → server action
2. **Storage**: JSONB in PostgreSQL with version field
3. **Retrieval**: MCP tools query published walkthroughs
4. **Template Processing**: `renderWalkthroughStep()` transforms to prompt
5. **Delivery**: Structured prompt sent to AI agent

### Prompt Generation Purpose

The prompt system serves multiple purposes:
1. **Agent Instruction**: Clear directives for AI behavior during steps
2. **Content Separation**: Distinguishes background info from user content
3. **Progress Management**: Includes navigation and completion criteria
4. **Type Safety**: Enforces content requirements per walkthrough type
5. **Evolution Support**: Version field enables future schema changes

## Code References
- `packages/database/src/schema.ts:19-40` - Content field schema definition
- `packages/database/src/schema.ts:182-286` - Database table definitions
- `packages/dashboard/src/lib/template-engine.ts:8-111` - Template engine implementation
- `packages/dashboard/src/components/walkthrough-editor.tsx:1-155` - Main editor container
- `packages/dashboard/src/components/content-editor.tsx:1-589` - Content editing form
- `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:156-162` - Default content creation
- `packages/dashboard/src/lib/mcp/walkthrough-utils.ts:24-45` - Content rendering utilities

## Architecture Insights

1. **Version-First Design**: Content schema includes version field for migration support
2. **Separation of Concerns**: Clear boundary between storage (JSONB) and presentation (template)
3. **Type-Driven Requirements**: Walkthrough types determine required fields dynamically
4. **Non-Destructive Progress**: Progress tracking survives content reorganization
5. **Multi-Tenant Isolation**: Organization-based data separation at database level
6. **Flexible Assignment**: Many-to-many server relationships with per-server ordering

## Historical Context (from thoughts/)

### Key Design Decisions
- `specifications/03-interactive-walkthrough/thoughts/technical-specification.md` - PostgreSQL with JSONB chosen over S3 for transactional integrity
- `specifications/03-interactive-walkthrough/thoughts/ui-ideation.md` - Full-page editor chosen over modal for complex content needs
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/thoughts/structured-content-architecture.md` - Four-field structure balances flexibility with structure
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/thoughts/ui-ux-recommendations.md` - Form-based editing preferred over JSON editor for usability

### Implementation Evolution
- Initial design used single content field, evolved to four structured fields
- Template system added to separate authoring from AI consumption
- Version field added early for future schema migrations
- Progress tracking redesigned to be non-destructive

## Related Research
- `specifications/03-interactive-walkthrough/01-core-infrastructure-mcp-tools/research/research_2025-07-22_10-13-05_mcp-interactive-tools.md` - MCP tools integration patterns
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/research/research_2025-07-21_23-07-58_mastra-mcp-course-implementation.md` - Mastra course structure analysis
- `specifications/03-interactive-walkthrough/02-walkthrough-authoring-ui/validation-findings.md` - Implementation validation (95% score)

## Open Questions
1. How will content field schema migrations be handled when moving from v1 to v2?
2. Should there be a content preview mode that shows exactly what the AI sees?
3. How will analytics track which content fields are most effective?
4. Should template customization be exposed to authors?