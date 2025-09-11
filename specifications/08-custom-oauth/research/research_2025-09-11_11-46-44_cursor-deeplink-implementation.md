---
date: 2025-09-11T11:46:44-05:00
researcher: Assistant
git_commit: 8e6f34d30664d9e3e9100b9a7a24c445f795929b
branch: 08-custom-oauth
repository: mcplatform
topic: "Cursor Deep Linking Implementation vs Official Documentation"
tags: [research, codebase, cursor, deeplink, mcp-server, installation]
status: complete
last_updated: 2025-09-11
last_updated_by: Assistant
last_updated_note: "Corrected analysis based on actual Cursor documentation examples"
type: research
---

# Research: Cursor Deep Linking Implementation vs Official Documentation

**Date**: 2025-09-11T11:46:44-05:00
**Researcher**: Assistant
**Git Commit**: 8e6f34d30664d9e3e9100b9a7a24c445f795929b
**Branch**: 08-custom-oauth
**Repository**: mcplatform

## Research Question
Understand how Cursor deep linking is implemented in the dashboard and compare it with the official Cursor documentation to identify discrepancies or outdated implementations.

## Summary
The current implementation in MCPlatform includes an unnecessary `name` field in the configuration object. Based on the official Cursor documentation example (`cursor://anysphere.cursor-deeplink/mcp/install?name=postgres&config=eyJjb21tYW5kIjoibnB4Ii...`), the configuration should only contain the server settings (`url` for URL-based or `command`/`args` for command-based), not the name itself, since the name is passed separately as a URL parameter.

## Critical Discrepancies Found

### 1. Configuration Contains Unnecessary Name Field

**Current Implementation** (`packages/dashboard/src/components/cursor-install-link.tsx:22-25`):
```typescript
const config = {
    name: serverName,  // This field shouldn't be here
    url: serverUrl
}
```

**Expected Format Based on Documentation**:
For URL-based servers:
```json
{
  "url": "https://example.com/api/mcpserver/mcp"
}
```

For command-based servers (from actual Cursor docs example):
```json
{
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
}
```

The `name` is passed as a separate URL parameter (`name=$NAME`) and should not be included in the base64-encoded configuration object.

### 2. Missing Configuration Properties

The official documentation specifies that configurations must contain either:
- A `command` property (for local executable servers)
- A `url` property (for URL-based servers)

Additional optional properties include:
- `args` (array) - Command arguments
- `env` (object) - Environment variables
- `headers` (object) - HTTP headers for authentication

The current implementation only supports URL-based servers and doesn't provide options for:
- Command-based servers
- Environment variables
- Authentication headers

### 3. Base64 Encoding Includes Extra Field

**Current Implementation** (`packages/dashboard/src/components/cursor-install-link.tsx:31`):
```typescript
const base64Config = Buffer.from(JSON.stringify(config)).toString('base64')
// This encodes: {"name":"serverName","url":"serverUrl"}
```

It should encode only the server configuration:
```typescript
const correctConfig = {
    url: serverUrl
}
const base64Config = Buffer.from(JSON.stringify(correctConfig)).toString('base64')
// This would encode: {"url":"serverUrl"}
```

### 4. Web Installation URLs Match Documentation

The web installation buttons correctly use `https://cursor.com/install-mcp` which aligns with the documentation. However, they still carry the incorrect configuration structure in the `config` parameter.

## Detailed Findings

### Current Implementation Structure
- **File**: `packages/dashboard/src/components/cursor-install-link.tsx`
- **Purpose**: Generate Cursor installation links and buttons for MCP servers
- **Methods Provided**:
  1. Direct deep link (`cursor://` protocol)
  2. Web installation buttons (dark/light themes)
  3. Manual configuration copying

### Documentation Requirements
According to the official Cursor documentation:
1. **URL Format**: `cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_ENCODED_CONFIG`
2. **Configuration Structure**: The config parameter contains only the server configuration (not the name)
3. **Required Fields**: Either `command` or `url` must be present
4. **Version Requirements**: Cursor v0.48.0+ for URL-based servers (component says v1.0+)
5. **Example from docs**: `name=postgres&config=eyJjb21tYW5kIjoibnB4Ii...` where the decoded config is `{"command":"npx","args":[...]}`

### Implementation Issues

#### Issue 1: Configuration Structure
- **Location**: `packages/dashboard/src/components/cursor-install-link.tsx:22-25`
- **Problem**: Includes `name` field in config when it should only have `url`
- **Impact**: May cause installation issues as Cursor doesn't expect a `name` field in the config

#### Issue 2: Version Requirement Discrepancy
- **Location**: `packages/dashboard/src/components/cursor-install-link.tsx:104`
- **Current Text**: "requires Cursor v1.0 or later"
- **Documentation**: States v0.48.0+ for URL-based servers
- **Impact**: Misleading version requirements

#### Issue 3: Missing Authentication Support
- **Current**: No support for headers or environment variables
- **Required**: OAuth tokens and API keys often need to be passed via headers
- **Impact**: Limited to public/unauthenticated servers only

## Code References
- `packages/dashboard/src/components/cursor-install-link.tsx:22-25` - Incorrect configuration structure
- `packages/dashboard/src/components/cursor-install-link.tsx:31` - Base64 encoding of wrong format
- `packages/dashboard/src/components/cursor-install-link.tsx:34` - Correct deeplink URL structure
- `packages/dashboard/src/components/cursor-install-link.tsx:37-51` - Web installation buttons (correct URLs, wrong config)
- `packages/dashboard/src/components/cursor-install-link.tsx:104` - Incorrect version requirement
- `packages/dashboard/src/components/cursor-install-link.tsx:173` - Reference to ~/.cursor/mcp.json (correct)

## Architecture Insights
1. The component correctly implements the URL structure for deeplinks
2. The web fallback URLs are properly configured
3. The UI provides multiple installation methods which is good UX
4. The base64 encoding approach is correct, but includes an unnecessary `name` field
5. The component is cleanly separated and reusable

## Recommended Fixes

### 1. Fix Configuration Structure
```typescript
// Replace lines 22-25 with:
const config = {
    url: serverUrl
}
// The name is already passed as a URL parameter, no need to include it in config
```

### 2. Add Authentication Support
```typescript
interface CursorInstallLinkProps {
    serverName: string
    serverUrl: string
    headers?: Record<string, string>  // Add optional headers
    env?: Record<string, string>       // Add optional environment variables
}

// Update config generation:
const config = {
    url: serverUrl,
    ...(headers && { headers }),
    ...(env && { env })
}
```

### 3. Update Version Requirement
Change line 104 to reflect the correct version:
```typescript
<CardDescription>One-click installation for Cursor IDE (requires Cursor v0.48.0 or later)</CardDescription>
```

### 4. Consider Command-Based Server Support
Add support for command-based servers as an alternative to URL-based servers:
```typescript
interface CursorInstallLinkProps {
    serverName: string
    serverUrl?: string
    command?: string
    args?: string[]
    // ... other props
}

const config = {
    ...(serverUrl && { url: serverUrl }),
    ...(command && { command, args })
}
```

## Related Research
- Official Cursor Documentation: https://docs.cursor.com/en/tools/developers
- MCP JSON Format: Referenced in `~/.cursor/mcp.json`
- Example from docs: `cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_ENCODED_CONFIG`

## Open Questions
1. Does the extra `name` field in the config cause any issues with Cursor's installation process?
2. Should we support both command-based and URL-based server configurations?
3. How should authentication credentials be securely passed through deeplinks?
4. Should we validate the configuration against Cursor's expected schema before encoding?

## Follow-up Research (2025-09-11T11:50:00-05:00)

After reviewing the actual Cursor documentation example, I've corrected my initial analysis:

**Actual Documentation Example**:
- URL: `cursor://anysphere.cursor-deeplink/mcp/install?name=postgres&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBtb2RlbGNvbnRleHRwcm90b2NvbC9zZXJ2ZXItcG9zdGdyZXMiLCJwb3N0Z3Jlc3FsOi8vbG9jYWxob3N0L215ZGIiXX0=`
- Decoded config: `{"command":"npx","args":["-y","@modelcontextprotocol/server-postgres","postgresql://localhost/mydb"]}`

The configuration object does NOT wrap the server settings with the server name as a key. The name is passed separately as a URL parameter, and the config contains only the server settings themselves.