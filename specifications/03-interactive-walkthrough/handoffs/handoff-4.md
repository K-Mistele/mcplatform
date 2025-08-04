---
date: 2025-08-04T12:58:55-07:00
researcher: Kyle
git_commit: 734b4879eb792c395c2c61694ce2d8547702bf9a
branch: master
repository: mcplatform
topic: "Replicated Walkthrough Implementation Strategy"
tags: [implementation, strategy, walkthroughs, replicated, research]
status: complete
last_updated: 2025-08-04
last_updated_by: Kyle
type: implementation_strategy
---

# Handoff: Replicated Quick-Start Walkthrough Conversion

## Task(s)
1. **Research walkthrough system architecture** (completed) - Conducted comprehensive research on MCPlatform's walkthrough implementation including database schema, MCP tools, UI components, and export/import functionality
2. **Document findings** (completed) - Created detailed research document outlining all aspects of the walkthrough system
3. **Fix walkthrough script issues** (completed) - Corrected organization table imports in walkthrough tools scripts
4. **Convert Replicated documentation to walkthrough** (work in progress) - Started analyzing the Replicated quick-start guide for conversion

## Recent changes
- Fixed imports in `scripts/walkthrough-tools/import-walkthrough.ts` and `scripts/walkthrough-tools/list-walkthroughs.ts` to use correct `organization` table from auth-schema
- Created comprehensive research document at `specifications/03-interactive-walkthrough/research_2025-08-04_11-18-22_walkthrough-system-comprehensive.md`
- Added example walkthrough export JSON (`walkthrough-wt_V5HKPclB-export.json`) showing structure

## Learnings
1. **Walkthrough Architecture**: The system uses ID-based progress tracking that survives step reordering and modifications. Progress is stored as an array of completed step IDs, not positions.

2. **Content Structure**: Each step has four key fields:
   - `introductionForAgent`: Context for the AI about the step
   - `contextForAgent`: Background information needed
   - `contentForUser`: Main content to present to the user
   - `operationsForAgent`: Specific actions the AI should perform

3. **MCP Tools Behavior**: The `start_walkthrough` tool has smart behavior - it auto-starts if only one walkthrough exists, otherwise lists available options.

4. **Walkthrough Types**: Different types have different field requirements:
   - **Quickstart**: Minimal fields (just contentForUser)
   - **Installer**: Requires most fields for guided installation
   - **Course**: Educational focus with context and content

5. **Export/Import Pattern**: Walkthroughs can be exported to JSON with organization-agnostic structure and imported into different environments.

## Artifacts
- `specifications/03-interactive-walkthrough/research_2025-08-04_11-18-22_walkthrough-system-comprehensive.md` - Comprehensive research document
- `specifications/demos/replicated/quick-start-merged.mdx` - Source Replicated documentation to convert
- `walkthrough-wt_V5HKPclB-export.json` - Example walkthrough export showing expected structure
- `scripts/walkthrough-tools/import-walkthrough.ts` - Fixed import script
- `scripts/walkthrough-tools/list-walkthroughs.ts` - Fixed listing script

## Action Items & Next Steps
1. **Analyze Replicated content structure** - Break down the quick-start guide into logical steps that fit the walkthrough format
2. **Determine walkthrough type** - Decide between "quickstart" or "installer" type based on content focus
3. **Create step breakdown** - Map each section of the Replicated guide to walkthrough steps with appropriate content fields
4. **Write conversion script** - Create a script to transform the MDX content into walkthrough JSON format
5. **Test import process** - Use the import-walkthrough script to load the converted content
6. **Validate MCP tool behavior** - Ensure the walkthrough works correctly with the AI agent tools

## Other Notes
- The Replicated quick-start guide covers multiple topics: environment setup, CLI usage, SDK integration, release management, and embedded cluster installation
- Consider splitting into multiple focused walkthroughs rather than one large one
- The guide includes VM setup instructions which may need special handling in the walkthrough context
- Walkthrough content should be structured to work well with AI agents, not just human readers
- The template engine at `packages/dashboard/src/lib/template-engine.ts:95-142` shows how content is formatted for AI consumption
- Database schema is at `packages/database/src/schema.ts:183-287` for reference on field constraints