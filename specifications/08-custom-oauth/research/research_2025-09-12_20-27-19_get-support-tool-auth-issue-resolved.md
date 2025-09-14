---
date: 2025-09-12T20:27:19-05:00
researcher: Claude
git_commit: a0c2605fbd051f58da81f23d9953f033184e2ce8
branch: master
repository: mcplatform
topic: "Custom OAuth get_support Tool Authentication Issue - RESOLVED"
tags: [research, codebase, custom-oauth, authentication, mcp-tools, bug-fix, resolved]
status: complete
last_updated: 2025-09-12
last_updated_by: Claude
type: research
---

# Research: Custom OAuth get_support Tool Authentication Issue - RESOLVED

**Date**: 2025-09-12T20:27:19-05:00
**Researcher**: Claude
**Git Commit**: a0c2605fbd051f58da81f23d9953f033184e2ce8
**Branch**: master
**Repository**: mcplatform

## Research Question
User reports getting "To get support, please log in and then call this tool again" when using the get_support MCP tool through an MCP client with custom_oauth configuration, despite being authorized. Investigation of root cause and recommendation for fix.

## Summary
**UPDATE: The bug has been FIXED in the current codebase.** The issue reported in the previous research document (research_2025-09-12_16-35-59) has been resolved. The code now correctly implements session type discrimination and queries the appropriate user table based on authentication type. If the user is still experiencing this issue, it may be due to:
1. Running an older version of the code
2. Cached sessions without proper user data
3. Missing user email in the mcpServerUser record
4. Configuration issues with the custom OAuth setup

## Detailed Findings

### Current Implementation Status (FIXED)

#### Fixed Code in tracking.ts (`packages/dashboard/src/lib/mcp/tracking.ts:72-90`)
The bug has been resolved with proper session type discrimination:

```typescript
if (serverConfig.authType?.includes('oauth')) {
    const session = await auth.api.getMcpSession({ headers: await headers() })
    if (session?.userId) {
        // FIXED: Correct session type discrimination
        if ('tokenType' in session && session.tokenType === 'proxy') {
            // Custom OAuth: query mcpServerUser table (CORRECT)
            const [user] = await db
                .select()
                .from(schema.mcpServerUser)
                .where(eq(schema.mcpServerUser.id, session.userId))
                .limit(1)
            if (user?.email) email = user.email
        } else {
            // Platform OAuth: query mcpOAuthUser table (CORRECT)
            const [user] = await db.select().from(mcpOAuthUser).where(eq(mcpOAuthUser.id, session.userId)).limit(1)
            if (user?.email) email = user.email
        }
    }
}
```

### Authentication Flow Verification

#### 1. Custom OAuth Proxy Session Creation (`packages/dashboard/src/lib/mcp/with-mcp-auth.ts:58-64`)
- Creates session with `tokenType: 'proxy'`
- Sets `userId` to `upstreamToken.mcpServerUserId`
- Token format: `mcp_at_${nanoid(32)}`

#### 2. Session Type Definition (`packages/dashboard/src/lib/mcp/with-mcp-auth.ts:5-11`)
```typescript
export type McpAuthSession = OAuthAccessToken | {
    tokenType: 'proxy'
    accessToken: string
    userId: string
    expiresAt?: number | null
}
```

#### 3. Support Tool Check (`packages/dashboard/src/lib/mcp/tools/support.ts:108-114`)
```typescript
let submissionEmail: string
if ('email' in args) submissionEmail = args.email as string
else if (email) submissionEmail = email  // Now correctly populated
else return {
    content: [{ type: 'text', text: 'To get support, please log in and then call this tool again.' }]
}
```

### Database Schema Verification

#### mcpServerUser Table (`packages/database/src/schema.ts:157-174`)
- ID format: `mcpu_${nanoid(12)}`
- Contains `email` field (nullable)
- Referenced by `upstreamOAuthTokens.mcpServerUserId`

#### mcpOAuthUser Table (`packages/database/src/mcp-auth-schema.ts:3-17`)
- Separate table for platform OAuth users
- Email field is required and unique
- Not used for custom OAuth flows

## Potential Remaining Issues

If the user is still experiencing the error despite the fix, check:

### 1. Code Version
Verify the deployed code includes the fix:
```bash
# Check if the fix is present in tracking.ts
grep -A5 "tokenType.*proxy" packages/dashboard/src/lib/mcp/tracking.ts
```

### 2. User Email Population
The mcpServerUser record might not have an email:
```sql
-- Check if user has email populated
SELECT id, email, upstream_sub FROM mcp_server_user 
WHERE id = 'mcpu_...' -- Use actual user ID from session
```

### 3. OAuth Callback User Creation (`packages/dashboard/src/app/oauth/callback/route.ts:264-277`)
Verify user creation properly sets email:
```typescript
// Line 270-277: User creation/lookup
const userResult = await createOrUpdateMcpServerUser({
    upstreamSub: decodedToken.sub,
    email: userInfo.email,  // Ensure this is populated
    profileData: userInfo
})
```

### 4. Session Cache Issues
Clear any cached sessions that might have incorrect data:
- Restart the application
- Clear proxy token cache
- Re-authenticate through OAuth flow

## Code References
- `packages/dashboard/src/lib/mcp/tracking.ts:72-90` - **FIXED**: Correct table query logic
- `packages/dashboard/src/lib/mcp/with-mcp-auth.ts:58-64` - Proxy session creation
- `packages/dashboard/src/lib/mcp/tools/support.ts:108-114` - Email availability check
- `packages/dashboard/src/app/oauth/callback/route.ts:270-277` - User creation with email
- `packages/database/src/schema.ts:157-174` - mcpServerUser table definition

## Architecture Insights
1. **Fix Implementation**: The codebase now correctly implements session type discrimination using the `tokenType: 'proxy'` property
2. **Table Separation**: Custom OAuth users are stored in `mcpServerUser`, platform OAuth users in `mcpOAuthUser`
3. **Proxy Token System**: MCPlatform acts as an OAuth proxy, never exposing upstream tokens to MCP clients
4. **Email Resolution Chain**: OAuth callback → mcpServerUser creation → proxy session → tracking.ts → support tool

## Historical Context
- Previous research (2025-09-12_16-35-59) identified the bug when code was querying wrong table
- Fix was implemented to add session type discrimination
- Current code correctly handles both authentication types

## Recommendations

### If Issue Persists:

1. **Verify Deployment**
   ```bash
   # Check current git commit in production
   git log -1 --format="%H" packages/dashboard/src/lib/mcp/tracking.ts
   # Should show commit with the fix
   ```

2. **Debug Session Data**
   Add logging to verify session properties:
   ```typescript
   console.log('Session type check:', {
       hasTokenType: 'tokenType' in session,
       tokenType: session.tokenType,
       userId: session.userId
   })
   ```

3. **Check User Email**
   Verify email is populated during OAuth callback:
   ```typescript
   // In oauth/callback/route.ts
   console.log('Creating user with email:', userInfo.email)
   ```

4. **Force Email Collection**
   As a workaround, configure the server to use `collect_email` auth type temporarily

### Next Steps
1. Confirm the deployed version includes the fix
2. Check if mcpServerUser records have email populated
3. Verify OAuth userInfo endpoint returns email
4. Test with fresh authentication (clear tokens/cache)

## Conclusion
The root cause identified in the previous research has been **successfully fixed**. The code now correctly:
- Discriminates between custom OAuth and platform OAuth sessions
- Queries the appropriate user table based on session type
- Retrieves email for custom OAuth users from `mcpServerUser` table

If the issue persists, it's likely due to deployment lag, missing user data, or configuration issues rather than the code bug itself.