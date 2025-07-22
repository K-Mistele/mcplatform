# OAuth Integration for Interactive MCP Tools - Working Notes

## Current OAuth Architecture

### Dual Authentication System
1. **Platform Auth** (`/lib/auth/auth.ts`)
   - For customers managing organizations
   - Dashboard access and MCP server configuration

2. **Sub-tenant Auth** (`/lib/auth/mcp/auth.ts`)
   - For end-users interacting with MCP servers
   - OAuth 2.1 with PKCE flow
   - User de-anonymization for analytics

### Integration Points for Interactive Tools

#### User Context Flow
```
OAuth Login → MCP Session → Tool Context → Personalized Experience
```

1. End-user authenticates via OAuth
2. Session created with email/user ID
3. MCP tools receive user context
4. Tools provide personalized guidance

#### Technical Implementation
- User email flows from OAuth session to tool parameters
- Session ID enables state persistence across interactions
- Tracking ID allows analytics on walkthrough completion

## Security Considerations for Interactive Tools

### Token Management
- Access tokens scoped to specific MCP servers
- Refresh token rotation for long-running walkthroughs
- Audience-restricted tokens per customer organization

### Permission Model
- Tools inherit server-level permissions
- User consent for data access during walkthroughs
- Audit logging for sensitive operations

### Privacy Considerations
- User data minimization in tool calls
- Clear consent for analytics tracking
- Data retention policies for walkthrough sessions

## Implementation Notes

### Existing OAuth Protection Pattern
```typescript
// From with-mcp-auth.ts
if (!session) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    error: { code: 401, message: "Unauthorized" }
  }), {
    status: 401,
    headers: {
      'WWW-Authenticate': `Bearer realm="${discoveryUrl}"`
    }
  })
}
```

### Enhancement for Interactive Tools
- Add walkthrough-specific scopes
- Implement step-by-step consent flows
- Enable partial authentication for public tools