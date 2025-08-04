# Walkthrough Management Scripts

These scripts help export and import walkthroughs between different MCPlatform environments (e.g., development, staging, production).

## Prerequisites

- Have Bun installed
- Ensure you're in the SST environment (run `bun sst shell` from the project root)
- The scripts will automatically connect using SST Resource credentials

## Available Scripts

### 1. List Walkthroughs
View all walkthroughs in the database:

```bash
# List all walkthroughs
bun scripts/walkthrough-tools/list-walkthroughs.ts

# List walkthroughs for a specific organization
bun scripts/walkthrough-tools/list-walkthroughs.ts org_123abc
```

### 2. Export Walkthrough
Export a walkthrough and its steps to a JSON file:

```bash
# Export to default filename (walkthrough-{id}-export.json)
bun scripts/walkthrough-tools/export-walkthrough.ts wt_123abc

# Export to custom filename
bun scripts/walkthrough-tools/export-walkthrough.ts wt_123abc my-walkthrough.json
```

The export includes:
- Walkthrough metadata (title, description, type, status, etc.)
- All steps with their content fields and ordering
- References between steps (preserved as relative indices)
- Export metadata for traceability

### 3. Import Walkthrough
Import a walkthrough from a JSON file into a target organization:

```bash
bun scripts/walkthrough-tools/import-walkthrough.ts my-walkthrough.json org_456def
```

The import will:
- Create a new walkthrough with a fresh ID
- Recreate all steps with new IDs
- Preserve step ordering and references
- Add import metadata for tracking

### 4. Associate Walkthrough with MCP Server
Link an imported walkthrough to an MCP server:

```bash
# Associate with default display order (0)
bun scripts/walkthrough-tools/associate-walkthrough.ts wt_789ghi mcp_123xyz

# Associate with specific display order
bun scripts/walkthrough-tools/associate-walkthrough.ts wt_789ghi mcp_123xyz 1
```

## Typical Workflow

1. **Enter SST shell for source environment:**
   ```bash
   bun sst shell --stage=dev
   ```

2. **Export from source environment:**
   ```bash
   bun scripts/walkthrough-tools/export-walkthrough.ts wt_123abc
   ```

3. **Switch to target environment:**
   ```bash
   exit  # Exit current SST shell
   bun sst shell --stage=prod
   ```

4. **Import to target environment:**
   ```bash
   bun scripts/walkthrough-tools/import-walkthrough.ts walkthrough-wt_123abc-export.json org_targetorg
   ```

5. **Associate with MCP server (if needed):**
   ```bash
   bun scripts/walkthrough-tools/associate-walkthrough.ts wt_newid mcp_serverid
   ```

## Export File Format

The export file is a JSON with this structure:

```json
{
  "version": "1.0",
  "exportedAt": "2024-01-01T00:00:00.000Z",
  "walkthrough": {
    "title": "Getting Started",
    "description": "...",
    "type": "course",
    "status": "published",
    // ... other fields
  },
  "steps": [
    {
      "title": "Step 1",
      "contentFields": {...},
      "displayOrder": 0,
      "nextStepReference": 1,  // Index of next step in array
      // ... other fields
    }
  ],
  "metadata": {
    "originalId": "wt_123abc",
    "originalOrganizationId": "org_123",
    "stepCount": 5,
    "serverAssociationCount": 2
  }
}
```

## Notes

- Organization IDs must exist in the target database before import
- The import creates new IDs for walkthroughs and steps
- Server associations are not exported/imported (must be recreated manually)
- Original timestamps are not preserved (new ones are created on import)