---
date: 2025-08-04T13:40:52-07:00
researcher: Claude
git_commit: 734b4879eb792c395c2c61694ce2d8547702bf9a
branch: master
repository: mcplatform
topic: "Replicated Demo Walkthrough Implementation Strategy"
tags: [implementation, strategy, replicated, walkthrough, import-export]
status: complete
last_updated: 2025-08-04
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: Replicated Platform Quick Start Walkthrough Implementation

## Task(s)
1. **Convert Replicated quickstart guide to MCPlatform walkthrough format** - COMPLETED
   - Analyzed the Replicated quick start merged document (`specifications/demos/replicated/quick-start-merged.mdx`)
   - Created a structured JSON walkthrough with 13 comprehensive steps
   - Each step includes all required fields for the MCPlatform walkthrough system

2. **Import walkthrough into database** - COMPLETED
   - Initially encountered foreign key constraint issues with the standard import script
   - Created a fixed import script to handle step references correctly
   - Successfully imported walkthrough with ID `wt_VqrAi3pnGi8lQYXX3dVfF`
   - Verified import shows all 13 steps in published status

## Recent changes
1. **Created walkthrough JSON files**:
   - `/specifications/demos/replicated/replicated-quickstart-walkthrough.json` - Initial format (array of steps)
   - `/specifications/demos/replicated/replicated-quickstart-walkthrough-import.json` - Proper import format with v1.0 wrapper

2. **Created fixed import script**:
   - `/scripts/walkthrough-tools/import-walkthrough-fixed.ts` - Modified version that handles foreign key constraints by creating steps first without references, then updating them in a second pass

3. **Database changes**:
   - Added new walkthrough record: `wt_VqrAi3pnGi8lQYXX3dVfF`
   - Added 13 walkthrough steps with proper ordering and references
   - Note: There's also a failed import `wt_VGAIqz30nFf_HEQhpY-Zk` with 0 steps that can be cleaned up

## Learnings
1. **Walkthrough Import Format Requirements**:
   - The import format requires a specific structure with `version: "1.0"` and wrapped data
   - See `/scripts/walkthrough-tools/export-walkthrough.ts:57-81` for the expected format
   - Steps array must include metadata fields and use `nextStepReference` as array indices

2. **Foreign Key Constraint Handling**:
   - The standard import script at `/scripts/walkthrough-tools/import-walkthrough.ts:99-109` tries to insert steps with `nextStepId` references that don't exist yet
   - Solution: Create all steps with `nextStepId: null` first, then update references in a second pass
   - This pattern is important for any circular or forward references in the database

3. **Content Field Structure**:
   - Each step requires `contentFields` with version "v1" containing:
     - `introductionForAgent`: High-level context for AI agents
     - `contextForAgent`: Technical background information
     - `contentForUser`: User-facing markdown content
     - `operationsForAgent`: Specific commands and actions

4. **Replicated Platform Key Concepts**:
   - The walkthrough covers: VM setup, CLI installation, Helm chart integration, manifest creation, release management, customer creation, Embedded Cluster installation, Admin Console usage, telemetry, preflight checks, and updates
   - Important files in a Replicated release: HelmChart CR, Application CR, SIG Application CR, Embedded Cluster Config

## Artifacts
1. **Walkthrough JSON Files**:
   - `/specifications/demos/replicated/replicated-quickstart-walkthrough.json` - Original step array format
   - `/specifications/demos/replicated/replicated-quickstart-walkthrough-import.json` - Import-ready format

2. **Scripts**:
   - `/scripts/walkthrough-tools/import-walkthrough-fixed.ts` - Fixed import script handling FK constraints

3. **Source Documentation**:
   - `/specifications/demos/replicated/quick-start-merged.mdx` - Original Replicated quickstart guide
   - `/specifications/demos/replicated/docs/` - Full Replicated documentation tree

4. **Reference Examples**:
   - `/specifications/03-interactive-walkthrough/research/nextjs-installation-walkthrough.json` - Example walkthrough format
   - `/scripts/walkthrough-tools/README-walkthrough-tools.md` - Documentation for walkthrough tools

## Action Items & Next Steps
1. **Associate walkthrough with MCP server** (if needed):
   ```bash
   bun sst shell -- bun scripts/walkthrough-tools/associate-walkthrough.ts wt_VqrAi3pnGi8lQYXX3dVfF <mcp-server-id>
   ```

2. **Clean up failed import**:
   - Remove the failed walkthrough `wt_VGAIqz30nFf_HEQhpY-Zk` from the database
   - This walkthrough has 0 steps due to the foreign key constraint error

3. **Test the walkthrough**:
   - Verify the walkthrough renders correctly in the MCPlatform UI
   - Test step navigation and content display
   - Ensure all 13 steps flow logically

4. **Consider enhancements**:
   - Add more detailed error handling examples in steps
   - Include troubleshooting guides for common issues
   - Add links to specific Replicated documentation pages where relevant

5. **Update standard import script**:
   - Consider submitting the fix from `import-walkthrough-fixed.ts` to the main import script
   - This would prevent future foreign key constraint issues

## Other Notes
1. **Walkthrough Structure**:
   - The 13 steps cover the complete Replicated quick start journey:
     1. Environment Setup and Requirements
     2. Create Vendor Portal Account and Install CLI
     3. Create Your First Application
     4. Prepare the Gitea Helm Chart
     5. Create Manifest Files
     6. Lint and Create First Release
     7. Create a Customer
     8. Install with Embedded Cluster
     9. Configure and Deploy Application
     10. Verify Instance Telemetry
     11. Add Preflight Checks
     12. Update Application
     13. Clean Up and Next Steps

2. **Key File Locations**:
   - Walkthrough tools: `/scripts/walkthrough-tools/`
   - Database schemas: `/packages/database/src/schema.ts` (walkthroughs, walkthroughSteps tables)
   - Import/export logic patterns: `/scripts/walkthrough-tools/import-walkthrough.ts` and `export-walkthrough.ts`

3. **Database Considerations**:
   - Organization ID used: `1HBRrQgQ2oBucPpcNY8K08T0QC2QTW5F` (Claude organization)
   - Walkthrough type: `quickstart`
   - Status: `published`
   - Estimated duration: 45 minutes

4. **Content Quality Notes**:
   - Each step includes detailed operations for agents to help users
   - Content uses markdown formatting with headers, lists, and code blocks
   - Steps build upon each other with proper prerequisite handling
   - Final step includes comprehensive cleanup instructions

5. **Future Improvements**:
   - Could add conditional logic for different installation paths (air-gapped, existing cluster)
   - Might benefit from embedded screenshots or diagrams
   - Could include more specific error messages and their solutions
   - Consider adding progress tracking or checkpoint validation