# MCP Server API Documentation

This document describes the Model Context Protocol (MCP) server implementation in MCPlatform, including API patterns, tool registration, and server configuration.

## Overview

MCPlatform implements MCP servers that can be embedded into customer documentation sites to provide AI-powered assistance. Each server is dynamically configured based on VHost routing and provides customized tools for end-users.

## Core Architecture

### Dynamic Handler Creation

**Location**: `packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:22-88`

The MCP server uses a catch-all route that handles multiple transport patterns:
- `/api/mcpserver/sse` - SSE transport (no tracking ID)
- `/api/mcpserver/mcp` - Streamable HTTP transport (no tracking ID)  
- `/api/mcpserver/{trackingid}/sse` - SSE transport (with tracking ID)
- `/api/mcpserver/{trackingid}/mcp` - Streamable HTTP transport (with tracking ID)

#### Request Flow

1. **Extract Tracking ID** (`maybeGetTrackingId()` at line 75-79)
   - Checks URL slug parameters for optional tracking ID
   - Returns tracking ID if present, otherwise null

2. **Load Server Configuration** (`getMcpServerConfiguration()` at line 39)
   - Uses VHost routing to determine which MCP server configuration to load
   - See [VHost Routing Documentation](../02-architecture/vhost-routing.md) for details

3. **Track User** (`getAndTrackMcpServerUser()` at line 46-49)
   - Idempotently creates or updates end-user records
   - Links tracking ID to email if available via OAuth

4. **Create Handler** (`createHandlerForServer()` at line 52-58)
   - Builds MCP server with dynamic tool registration
   - Applies OAuth wrapper if required

5. **Process Request** (line 61-67)
   - Forwards request to MCP handler
   - Sets session ID in response headers
   - Logs JSON-RPC requests/responses for debugging

### Server Configuration Resolution

**Location**: `packages/dashboard/src/lib/mcp/index.ts:117-159`

The `getMcpServerConfiguration` function implements VHost-based routing:

```typescript
// Extract subdomain from Host header
const requestHost = request.headers.get('host') ?? new URL(request.url).host
const requestHostname = requestHost.split(':')[0]

// Validate subdomain is one level under application domain
const requestIsOneLevelUnderApplicationOnSameDomain =
    requestUrlDomainSegments.length === thisUrlDomainSegments.length + 1 &&
    requestUrlDomainSegments.slice(-thisUrlDomainSegments.length).join('.') === thisUrlDomainSegments.join('.')

// Extract subdomain and lookup server
const subdomain = requestUrlDomainSegments[0]
const [serverConfig] = await db
    .select()
    .from(schema.mcpServers)
    .where(eq(schema.mcpServers.slug, subdomain))
    .limit(1)
```

#### Security Validations
- Must use subdomain (not root domain)
- Must be exactly one level under application domain  
- Future: Support arbitrary customer domains

## MCP Handler Creation

**Location**: `packages/dashboard/src/lib/mcp/index.ts:15-72`

### Handler Factory Pattern

```typescript
export function createHandlerForServer({
    serverConfig,
    trackingId,
    email,
    mcpServerUserId,
    serverSessionId
}: {
    serverConfig: McpServerConfig
    trackingId: string | null
    email: string | null
    mcpServerUserId: string
    serverSessionId: string
}): (req: Request) => Promise<Response>
```

### MCP Handler Configuration

**Base Configuration** (line 28-65):
```typescript
const mcpHandler = createMcpHandler(
    async (server) => {
        await registerMcpServerToolsFromConfig({
            server,
            serverConfig,
            trackingId,
            email,
            mcpServerUserId,
            serverSessionId
        })
    },
    {
        serverInfo: {
            name: serverConfig.name,
            version: '1.0.0'
        }
    },
    {
        redisUrl: process.env.REDIS_URL,
        basePath: trackingId ? `/api/mcpserver/${trackingId}` : `/api/mcpserver`,
        verboseLogs: true,
        disableSse: true,
        onEvent(event) {
            // Event logging and error tracking
        }
    }
)
```

### OAuth Integration

If server configuration includes OAuth (`authType` contains 'oauth'):
```typescript
if (!serverConfig.authType?.includes('oauth')) {
    return mcpHandler
}
return withMcpAuth(auth, mcpHandler)
```

Uses the MCP authentication system (separate from platform auth) - see [Dual Authentication System](../03-authentication/dual-auth-system.md).

## Tool Registration System

**Location**: `packages/dashboard/src/lib/mcp/index.ts:79-110`

### Dynamic Tool Registration

```typescript
export async function registerMcpServerToolsFromConfig({
    server,
    serverConfig,
    trackingId,
    email,
    mcpServerUserId,
    serverSessionId
})
```

### Standard Tools

#### 1. Support Tool (Always Registered)

**Location**: `packages/dashboard/src/lib/mcp/tools/support.ts:11-34`

Registered for all servers unless `supportTicketType` is `'none'`:

```typescript
registerMcpSupportTool({ 
    server, 
    serverConfig, 
    trackingId, 
    email, 
    mcpServerUserId, 
    serverSessionId 
})
```

**Tool Name**: `get_support`
**Purpose**: Creates support tickets for end-users experiencing issues

#### 2. Walkthrough Tools (Conditional)

**Location**: `packages/dashboard/src/lib/mcp/tools/walkthrough.ts:12-28`

Registered only if:
- `walkthroughToolsEnabled` is `'true'`
- Server has published walkthroughs (checked via `checkServerHasWalkthroughs()`)

```typescript
if (serverConfig.walkthroughToolsEnabled === 'true') {
    const hasWalkthroughs = await checkServerHasWalkthroughs(serverConfig.id)
    
    if (hasWalkthroughs) {
        registerWalkthroughTools({
            server,
            serverConfig,
            mcpServerUserId,
            serverSessionId
        })
    }
}
```

**Tools Registered**:
- `start_walkthrough` - Lists or starts interactive walkthroughs
- `get_next_step` - Progresses through walkthrough steps

## MCP Tools Reference

### Support Tool

**Tool**: `get_support`  
**Location**: `packages/dashboard/src/lib/mcp/tools/support.ts:89-161`

#### Input Schema (OAuth Disabled)
```typescript
{
    title: string,           // Concise ticket title
    problemDescription: string,  // Problem explanation with error messages
    problemContext?: string,     // Additional project context
    email?: string              // User email (required if not authenticated)
}
```

#### Input Schema (OAuth Enabled)
```typescript
{
    title: string,
    problemDescription: string,
    problemContext?: string
    // email automatically from OAuth
}
```

#### Functionality
1. **Email Validation**: Requires email via OAuth or manual input
2. **Ticket Creation**: Inserts record in `supportRequests` table
3. **Tool Call Tracking**: Records usage in `toolCalls` table
4. **User Email Update**: Updates `mcpServerUser` with email if provided

#### Database Operations
```typescript
// Create support ticket
db.insert(schema.supportRequests).values({
    title: args.title,
    conciseSummary: args.problemDescription,
    context: args.problemContext,
    email: submissionEmail,
    organizationId: serverConfig.organizationId,
    mcpServerId: serverConfig.id,
    mcpServerSessionId: serverSessionId,
    status: 'pending'
})

// Track tool usage
db.insert(schema.toolCalls).values({
    toolName: 'get_support',
    input: args,
    output: 'support_ticket_created',
    mcpServerId: serverConfig.id,
    mcpServerSessionId: serverSessionId
})
```

### Walkthrough Tools

#### Tool: `start_walkthrough`

**Location**: `packages/dashboard/src/lib/mcp/tools/walkthrough.ts:130-275`

Smart walkthrough tool with multiple behaviors:

##### Input Schema
```typescript
{
    name?: string,        // Optional walkthrough name/title
    restart?: boolean     // Default false - restart from beginning
}
```

##### Behaviors

**1. No Parameters - Single Walkthrough**
- Auto-starts the only available walkthrough
- Returns first step content immediately

**2. No Parameters - Multiple Walkthroughs**  
- Lists all available walkthroughs with progress info
- Returns formatted JSON with walkthrough details

**3. With Name Parameter**
- Starts named walkthrough (exact title match)
- Returns first step or error if not found

##### Response Format
```typescript
{
    content: [{
        type: 'text',
        text: string  // Either step content or walkthrough list
    }]
}
```

##### Database Operations
- Tracks all tool calls with action type (`list`, `auto_start`, `start_named`, `invalid_name`)
- Creates/updates `walkthroughProgress` records
- Can delete existing progress if `restart: true`

#### Tool: `get_next_step`

**Location**: `packages/dashboard/src/lib/mcp/tools/walkthrough.ts:282-431`

Progresses through active walkthrough steps.

##### Input Schema
```typescript
{
    currentStepId?: string  // Step ID to mark complete before getting next
}
```

##### Functionality
1. **Find Active Walkthrough**: Gets most recent progress by `lastActivityAt`
2. **Complete Current Step**: If `currentStepId` provided, marks as completed
3. **Calculate Next Step**: Uses `calculateNextStep()` utility
4. **Render Step Content**: Uses template engine for formatted output

##### Step Completion Flow
```typescript
if (currentStepId) {
    await completeStep(mcpServerUserId, walkthroughId, currentStepId, serverConfig.id, serverSessionId)
}
```

##### Response Format
Rendered step content with progress metadata:
```typescript
{
    content: [{
        type: 'text',
        text: renderWalkthroughStepOutput(stepHtml, {
            progressPercent: number,
            completed: boolean,
            stepId: string,
            totalSteps: number,
            completedSteps: number,
            walkthroughId: string
        })
    }]
}
```

## Server Configuration Types

**Location**: `packages/dashboard/src/lib/mcp/types.ts`

### McpServerConfig Interface
```typescript
interface McpServerConfig {
    id: string
    name: string
    slug: string
    organizationId: string
    
    // Authentication
    authType?: string[]             // e.g., ['oauth']
    
    // Support configuration  
    supportTicketType: 'none' | 'dashboard' | 'slack' | 'linear'
    productPlatformOrTool: string   // Used in support tool descriptions
    
    // Walkthrough configuration
    walkthroughToolsEnabled: 'true' | 'false'
}
```

### Feature Flags

**Support Types**:
- `'none'` - No support tool registered
- `'dashboard'` - Support tickets in MCPlatform dashboard (implemented)
- `'slack'` - Slack integration (not implemented)
- `'linear'` - Linear integration (not implemented)

**Authentication Types**:
- `['oauth']` - Requires OAuth login for tool access
- `undefined` - Anonymous access allowed

## User Tracking & Sessions

### End-User Identification

MCPlatform supports multiple identification methods:

1. **Tracking ID**: Anonymous identifier passed in URL
2. **OAuth Email**: Authenticated email from MCP OAuth flow
3. **Manual Email**: Email provided during support ticket creation

### Session Management

**Session Creation** (`getAndTrackMcpServerUser()`):
- Creates unique `mcpServerUserId` and `serverSessionId`
- Links tracking data across requests
- Updates user email when available

**Session Headers**:
```typescript
newResponse.headers.set('Mcp-Session-Id', userData.serverSessionId)
```

### Database Relationships

**User Tracking**:
```
mcpServerUser (end-users)
├── trackingId (anonymous identifier)
├── email (from OAuth or manual input)
└── firstSeenAt (initial connection time)

mcpServerSession (sessions)  
├── mcpServerUserId (links to user)
├── mcpServerSessionId (unique session)
├── connectionTimestamp (session start)
└── connectionDate (for daily grouping)
```

**Data Collection**:
```
toolCalls (tool usage)
├── mcpServerId (which server)
├── mcpServerSessionId (which session)
├── toolName (which tool)
├── input/output (parameters and results)
└── createdAt (timestamp)

supportRequests (support tickets)
├── mcpServerId (which server)  
├── mcpServerSessionId (which session)
├── organizationId (which customer)
└── email (end-user contact)
```

## Event Logging & Monitoring

### MCP Event Types

**Location**: `packages/dashboard/src/lib/mcp/index.ts:52-63`

```typescript
onEvent(event) {
    if (event.type === 'ERROR') {
        console.error(`MCP ERROR:`, event)
        // TODO: Track errors in database
    } else if (event.type === 'REQUEST_RECEIVED') {
        console.log(`MCP REQUEST RECEIVED:`, event)
    } else if (event.type === 'REQUEST_COMPLETED') {
        console.log(`MCP REQUEST COMPLETED:`, event)
    } else {
        console.log(`MCP EVENT:`, event)
    }
}
```

### JSON-RPC Logging

**Request/Response Logging** (`packages/dashboard/src/app/api/mcpserver/[...slug]/route.ts:31-63`):
```typescript
// Log incoming requests
requestBody.then((text) => console.log(`JSON RPC REQUEST:`, text))

// Log outgoing responses  
responseText.then((text) => console.log(`JSON RPC RESPONSE:`, text))
```

## Error Handling Patterns

### Configuration Errors
- Invalid subdomain format
- Server configuration not found
- Missing environment variables

### Runtime Errors  
- Tool execution failures
- Database connection issues
- OAuth authentication failures

### Security Validations
- VHost routing validation
- Organization-scoped data access
- Email verification requirements

## Protocol Compliance

### MCP Standard Compliance

MCPlatform's MCP implementation follows the Model Context Protocol specification:

1. **JSON-RPC 2.0**: All communication uses JSON-RPC 2.0 format
2. **Server Info**: Provides server name and version in handshake
3. **Tool Registration**: Dynamically registers available tools
4. **Error Responses**: Returns standard error codes and messages

### Transport Support

**Supported Transports**:
- ✅ Streamable HTTP (`/mcp` endpoints)
- ❌ SSE (disabled via `disableSse: true`)
- ❌ WebSocket (not implemented)

### Tool Schema Compliance

All tools provide:
- `title`: Human-readable tool name
- `description`: Tool purpose and usage instructions  
- `inputSchema`: Zod-based input validation
- Response in MCP content format

## Usage Examples

### Client Connection

```typescript
// Connect to MCP server with tracking
const mcpClient = new MCPClient('/api/mcpserver/user123/mcp')

// Connect anonymously
const mcpClient = new MCPClient('/api/mcpserver/mcp')
```

### Tool Invocation

```javascript
// Get support
await mcpClient.callTool('get_support', {
    title: 'API connection failed',
    problemDescription: 'Getting 500 error when calling /api/users',
    problemContext: 'Building a React app with user authentication',
    email: 'developer@example.com'
})

// Start walkthrough
await mcpClient.callTool('start_walkthrough', {
    name: 'Getting Started with API',
    restart: false
})

// Progress through walkthrough
await mcpClient.callTool('get_next_step', {
    currentStepId: 'step-1-introduction'
})
```

## Related Documentation

- [VHost Routing System](../02-architecture/vhost-routing.md) - Server resolution and DNS setup
- [Dual Authentication System](../03-authentication/dual-auth-system.md) - Platform vs MCP user authentication
- [Database Schema](../04-database/schema-design.md) - Data relationships and patterns
- [oRPC API Reference](../09-api-reference/orpc-reference.md) - Internal API for managing servers

## Implementation Notes

### Performance Considerations

- **Server Lookup**: Single database query for VHost resolution
- **Tool Registration**: Conditional registration based on server config
- **Session Tracking**: Efficient upserting with tracking ID/email combination

### Security Architecture

- **Organization Isolation**: All data scoped to customer organization
- **Anonymous Access**: Supports tracking without requiring authentication
- **OAuth Integration**: Optional OAuth for enhanced user identification
- **Input Validation**: All tool inputs validated with Zod schemas

### Monitoring & Analytics

- **Tool Usage Tracking**: All tool calls recorded with input/output
- **Session Analytics**: Connection patterns and user behavior
- **Error Tracking**: Comprehensive error logging (TODO: Database storage)
- **Performance Metrics**: Request/response timing in logs

## Advanced MCP Features

### Template Engine Integration

**Location**: `packages/dashboard/src/lib/template-engine/index.ts`

The walkthrough tools use a sophisticated template engine for rendering step content:

#### Step Rendering

```typescript
export function renderWalkthroughStep(
    walkthrough: { title: string; description: string | null; type: string | null },
    step: { id: string; title: string; displayOrder: number; contentFields: any }
): string
```

**Content Fields Structure**:
```typescript
{
    version: 'v1',
    introductionForAgent: string,    // Context for AI agents
    contextForAgent: string,         // Additional agent instructions
    contentForUser: string,          // User-facing content (Markdown)
    operationsForAgent: string       // Specific operations to perform
}
```

#### Output Formatting

```typescript
export function renderWalkthroughStepOutput(
    stepHtml: string,
    metadata: {
        progressPercent: number
        completed: boolean
        stepId: string
        totalSteps: number
        completedSteps: number
        walkthroughId: string
    }
): string
```

**Template Features**:
- Markdown-to-HTML conversion for user content
- Progress bar rendering with completion percentage
- Step metadata injection for navigation context
- Agent instruction formatting for AI systems

### Walkthrough Progress System

**Location**: `packages/dashboard/src/lib/mcp/walkthrough-utils.ts`

#### Progress Tracking

```typescript
export async function getOrInitializeProgress(
    mcpServerUserId: string,
    walkthroughId: string
): Promise<WalkthroughProgress>
```

**Progress States**:
- `startedAt`: When user first interacted with walkthrough
- `lastActivityAt`: Most recent step interaction
- `completedAt`: When all steps completed
- `completedSteps`: Array of completed step IDs

#### Step Completion Logic

```typescript
export async function completeStep(
    mcpServerUserId: string,
    walkthroughId: string,
    stepId: string,
    mcpServerId: string,
    serverSessionId: string
)
```

**Completion Behavior**:
1. Validates step belongs to walkthrough
2. Adds stepId to completedSteps array
3. Updates lastActivityAt timestamp
4. Sets completedAt if all steps done
5. Records tool call for analytics

#### Next Step Calculation

```typescript
export async function calculateNextStep(
    walkthroughId: string,
    progress: WalkthroughProgress | null
): Promise<{
    step: WalkthroughStep | null
    isCompleted: boolean
    completedSteps: number
    totalSteps: number
    progressPercent: number
}>
```

**Algorithm**:
1. Gets all steps ordered by displayOrder
2. Finds first uncompleted step
3. Calculates completion percentage
4. Returns next step or completion status

### Multi-Server Walkthrough Management

#### Server Walkthrough Lookup

```typescript
export async function getServerWalkthroughs(
    mcpServerId: string,
    mcpServerUserId?: string
): Promise<Array<{
    walkthrough: Walkthrough
    progress: WalkthroughProgress | null
    totalSteps: number
    progressPercent: number
}>>
```

**Query Optimization**:
- Single query with LEFT JOIN for progress data
- Filters by organizationId for security
- Only returns published walkthroughs
- Calculates progress percentages in application layer

#### Walkthrough Availability Check

```typescript
export async function checkServerHasWalkthroughs(mcpServerId: string): Promise<boolean>
```

**Performance Note**: Fast existence check used for tool registration decisions.

### Authentication Integration Patterns

#### MCP OAuth Wrapper

**Location**: `packages/dashboard/src/lib/mcp/index.ts:54-65`

```typescript
if (serverConfig.authType?.includes('oauth')) {
    return withMcpAuth(auth, mcpHandler)
}
```

**Authentication Flow**:
1. Intercepts MCP requests requiring auth
2. Redirects to MCP OAuth login if unauthenticated
3. Validates session against MCP auth system
4. Passes authenticated email to tool context

#### Email Resolution Priority

**Priority Order for User Identification**:
1. **OAuth Email**: From authenticated MCP session (highest priority)
2. **Manual Email**: From tool input parameters
3. **Tracking ID**: Anonymous identifier (lowest priority)

**Implementation Pattern**:
```typescript
// Email resolution in support tool
const submissionEmail = 
    email ||                    // OAuth email first
    args.email ||              // Manual email second
    null                       // Anonymous allowed
```

### Database Integration Patterns

#### Organization Scoping

**Security Pattern**: All MCP operations enforce organization boundaries:

```typescript
// Example: Support ticket creation
db.insert(schema.supportRequests).values({
    // ... ticket data
    organizationId: serverConfig.organizationId,  // Scope to customer
    mcpServerId: serverConfig.id,                // Scope to server
    mcpServerSessionId: serverSessionId          // Scope to session
})
```

#### Multi-Table Analytics Tracking

**Tool Call Recording Pattern**:
```typescript
// Every tool execution tracked
db.insert(schema.toolCalls).values({
    toolName: 'tool_name',
    input: args,
    output: result,
    mcpServerId: serverConfig.id,
    mcpServerSessionId: serverSessionId,
    createdAt: Date.now()
})
```

**Analytics Schema**:
- `toolCalls`: Individual tool executions
- `mcpServerSession`: Connection sessions
- `mcpServerUser`: End-user profiles
- `supportRequests`: Support interactions
- `walkthroughProgress`: Learning progress

#### Session Upserting Strategy

```typescript
// Efficient user and session tracking
export async function getAndTrackMcpServerUser({
    trackingId,
    email,
    mcpServerSlug
}: {
    trackingId: string | null
    email: string | null
    mcpServerSlug: string
})
```

**Upserting Logic**:
1. Find existing user by trackingId or email
2. Create new user if none found
3. Update email if provided and different
4. Create new session record
5. Return user and session IDs

### Error Handling & Recovery

#### Tool Execution Error Patterns

```typescript
// Comprehensive error handling in tools
try {
    // Tool logic
    const result = await performToolOperation()
    
    // Track successful execution
    await trackToolCall('success', args, result)
    
    return { content: [{ type: 'text', text: result }] }
} catch (error) {
    // Track failed execution
    await trackToolCall('error', args, error.message)
    
    // Return user-friendly error
    return {
        content: [{
            type: 'text',
            text: 'An error occurred while processing your request. Please try again or contact support.'
        }]
    }
}
```

#### Configuration Validation

**Server Config Validation**:
```typescript
// Invalid support types
if (serverConfig.supportTicketType === 'slack') {
    throw new Error('Slack tickets are not supported yet')
}
if (serverConfig.supportTicketType === 'linear') {
    throw new Error('Linear tickets are not supported yet')
}
```

**VHost Validation**:
```typescript
if (!requestIsOneLevelUnderApplicationOnSameDomain) {
    return new Response(
        'Invalid vhost usage. Please use a subdomain of the MCPlatform domain.',
        { status: 400 }
    )
}
```

### Performance & Scalability

#### Connection Pooling

**Redis Integration**: MCP handlers use Redis for session state:
```typescript
{
    redisUrl: process.env.REDIS_URL,
    basePath: trackingId ? `/api/mcpserver/${trackingId}` : `/api/mcpserver`
}
```

#### Query Optimization Patterns

**Efficient Walkthrough Queries**:
```typescript
// Single query with progress calculation
const walkthroughsWithProgress = await db
    .select({
        // Walkthrough fields
        walkthroughId: schema.walkthroughs.id,
        title: schema.walkthroughs.title,
        // ... more fields
        
        // Progress fields (LEFT JOIN)
        progressStartedAt: schema.walkthroughProgress.startedAt,
        progressCompletedSteps: schema.walkthroughProgress.completedSteps,
        // ... progress fields
    })
    .from(schema.walkthroughs)
    .leftJoin(
        schema.walkthroughProgress,
        and(
            eq(schema.walkthroughProgress.walkthroughId, schema.walkthroughs.id),
            eq(schema.walkthroughProgress.mcpServerUserId, mcpServerUserId)
        )
    )
    .where(
        and(
            eq(schema.walkthroughs.organizationId, organizationId),
            eq(schema.walkthroughs.status, 'published')
        )
    )
```

#### Caching Strategies

**Server Configuration Caching** (Future Enhancement):
```typescript
// TODO: Cache server configurations
const cachedConfig = await redis.get(`server:${subdomain}`)
if (cachedConfig) {
    return JSON.parse(cachedConfig)
}

// Cache miss - query database
const serverConfig = await queryDatabase(subdomain)
await redis.setex(`server:${subdomain}`, 300, JSON.stringify(serverConfig))
```

### Development & Debugging Tools

#### Verbose Logging Configuration

```typescript
{
    verboseLogs: true,  // Enable detailed MCP protocol logging
    onEvent(event) {
        // Custom event logging
        console.log(`MCP EVENT [${event.type}]:`, event)
    }
}
```

**Log Types**:
- `REQUEST_RECEIVED`: Incoming JSON-RPC requests
- `REQUEST_COMPLETED`: Completed request processing
- `ERROR`: Tool execution or protocol errors
- `CONNECTION`: Client connection events

#### Development Environment Setup

**Local Development URLs**:
```bash
# Local server URLs
http://testserver.localhost:3000/api/mcpserver/mcp
http://testserver.localhost:3000/api/mcpserver/user123/mcp

# With ngrok for external testing
https://testserver.randomid.ngrok.io/api/mcpserver/mcp
```

**Environment Variables Required**:
```bash
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=...
BETTER_AUTH_SECRET=...
```

### Testing Patterns

#### Tool Testing Strategy

```typescript
// Test tool registration
describe('MCP Tool Registration', () => {
    test('registers support tool when enabled', async () => {
        const mockServer = createMockMcpServer()
        const config = { supportTicketType: 'dashboard' }
        
        registerMcpSupportTool({ server: mockServer, serverConfig: config })
        
        expect(mockServer.tools).toHaveProperty('get_support')
    })
    
    test('skips tool registration when disabled', async () => {
        const mockServer = createMockMcpServer()
        const config = { supportTicketType: 'none' }
        
        registerMcpSupportTool({ server: mockServer, serverConfig: config })
        
        expect(mockServer.tools).not.toHaveProperty('get_support')
    })
})
```

#### Integration Testing

```typescript
// Test complete MCP flow
describe('MCP Server Integration', () => {
    test('handles walkthrough progression', async () => {
        const response = await fetch('/api/mcpserver/mcp', {
            method: 'POST',
            headers: { 'host': 'testserver.localhost:3000' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'start_walkthrough',
                    arguments: { name: 'Getting Started' }
                }
            })
        })
        
        const result = await response.json()
        expect(result.result.content[0].text).toContain('Step 1')
    })
})
```

### Security Considerations

#### Input Sanitization

**Zod Schema Validation**:
```typescript
// All tool inputs validated
const inputSchema = z.object({
    title: z.string().max(200, 'Title too long'),
    problemDescription: z.string().max(2000, 'Description too long'),
    problemContext: z.string().max(1000, 'Context too long').optional(),
    email: z.string().email('Invalid email').optional()
})
```

#### Data Isolation

**Organization Boundaries**:
- All queries filtered by `organizationId`
- Server configurations scoped to organizations
- User data isolated between customers
- Session data cannot cross organization boundaries

#### Rate Limiting (Future Enhancement)

```typescript
// TODO: Implement rate limiting per server/user
const rateLimitKey = `mcp:${mcpServerId}:${trackingId || 'anonymous'}`
const requestCount = await redis.incr(rateLimitKey)
if (requestCount === 1) {
    await redis.expire(rateLimitKey, 60) // 1 minute window
}
if (requestCount > 100) {
    throw new Error('Rate limit exceeded')
}
```

### Monitoring & Observability

#### Metrics Collection

**Key Metrics to Track**:
1. **Tool Usage**: Calls per tool per server
2. **Session Duration**: Time between first and last activity
3. **Completion Rates**: Walkthrough completion percentages
4. **Error Rates**: Failed tool executions
5. **User Engagement**: Return user patterns

**Implementation Pattern**:
```typescript
// Metrics recording in tool execution
const startTime = Date.now()
try {
    const result = await executeToolLogic()
    await recordMetric('tool_success', {
        tool: toolName,
        duration: Date.now() - startTime,
        server: mcpServerId
    })
    return result
} catch (error) {
    await recordMetric('tool_error', {
        tool: toolName,
        error: error.message,
        server: mcpServerId
    })
    throw error
}
```

#### Health Checks

```typescript
// Server health endpoint
GET /api/mcpserver/health

{
    status: 'healthy',
    checks: {
        database: 'connected',
        redis: 'connected',
        registeredServers: 15
    }
}
```

### Future Enhancements

#### Planned Features

1. **WebSocket Support**: Real-time bidirectional communication
2. **Tool Marketplace**: Custom tool registration system
3. **Advanced Analytics**: Funnel analysis and cohort tracking
4. **A/B Testing**: Tool and content variation testing
5. **Integration APIs**: Slack, Linear, Jira support ticket routing

#### Architecture Evolution

**Microservice Migration Path**:
```typescript
// Future: Separate MCP service
const mcpService = new MCPService({
    port: 8080,
    redisUrl: process.env.REDIS_URL,
    databaseUrl: process.env.DATABASE_URL
})

// Load balancing across multiple instances
const loadBalancer = new MCPLoadBalancer([
    'mcp-1.internal:8080',
    'mcp-2.internal:8080',
    'mcp-3.internal:8080'
])
```

**Tool Plugin System**:
```typescript
// Future: Dynamic tool loading
interface MCPToolPlugin {
    name: string
    version: string
    register(server: MCPServer, config: any): void
    unregister(server: MCPServer): void
}

const customTool: MCPToolPlugin = {
    name: 'custom_analytics',
    version: '1.0.0',
    register: (server, config) => {
        server.registerTool('analyze_data', /* ... */)
    }
}
```

### Complete MCP Protocol Reference

#### JSON-RPC 2.0 Message Format

**Request Format**:
```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "get_support",
        "arguments": {
            "title": "API connection failed",
            "problemDescription": "Getting 500 error when calling /api/users"
        }
    }
}
```

**Response Format**:
```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "content": [
            {
                "type": "text",
                "text": "Support ticket #12345 has been created..."
            }
        ]
    }
}
```

**Error Response Format**:
```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "error": {
        "code": -32602,
        "message": "Invalid params",
        "data": {
            "details": "Email is required when not authenticated"
        }
    }
}
```

#### Tool Schema Reference

**Support Tool Schema**:
```json
{
    "name": "get_support",
    "title": "Get support about [Product Name]",
    "description": "Use this tool to get support about [Product]. Call this tool when there is an error you are unable to resolve...",
    "inputSchema": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "A very concise title for the support ticket"
            },
            "problemDescription": {
                "type": "string", 
                "description": "A concise explanation of the problem..."
            },
            "problemContext": {
                "type": "string",
                "description": "Include additional context about user's project..."
            },
            "email": {
                "type": "string",
                "format": "email",
                "description": "The email address of the user requesting support"
            }
        },
        "required": ["title", "problemDescription"],
        "additionalProperties": false
    }
}
```

**Walkthrough Tool Schemas**:
```json
{
    "name": "start_walkthrough",
    "title": "Start Interactive Walkthrough",
    "description": "Start an interactive walkthrough or list available walkthroughs",
    "inputSchema": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "Optional walkthrough name/title to start"
            },
            "restart": {
                "type": "boolean",
                "description": "Set to true to restart from beginning",
                "default": false
            }
        },
        "additionalProperties": false
    }
}

{
    "name": "get_next_step",
    "title": "Get Next Walkthrough Step", 
    "description": "Progress through the active walkthrough",
    "inputSchema": {
        "type": "object",
        "properties": {
            "currentStepId": {
                "type": "string",
                "description": "Step ID to mark complete before getting next"
            }
        },
        "additionalProperties": false
    }
}
```

### Advanced Usage Scenarios

#### Multi-Step Walkthrough Flow

**Complete Walkthrough Example**:
```javascript
// 1. Start walkthrough (multiple available)
const startResponse = await mcpClient.callTool('start_walkthrough', {})
console.log(startResponse.content[0].text)
// Returns: JSON list of available walkthroughs

// 2. Start specific walkthrough
const beginResponse = await mcpClient.callTool('start_walkthrough', {
    name: "Getting Started with API Integration"
})
console.log(beginResponse.content[0].text)
// Returns: Step 1 content with progress bar

// 3. Progress through steps
const step2Response = await mcpClient.callTool('get_next_step', {
    currentStepId: "step-1-introduction" 
})
console.log(step2Response.content[0].text)
// Returns: Step 2 content with updated progress

// 4. Continue until completion
const finalResponse = await mcpClient.callTool('get_next_step', {
    currentStepId: "step-5-conclusion"
})
// Returns: Completion message with 100% progress
```

#### Error Recovery Patterns

**Handling Support Tool Errors**:
```javascript
try {
    const response = await mcpClient.callTool('get_support', {
        title: "Database connection issue",
        problemDescription: "Cannot connect to PostgreSQL database"
        // Missing email when required
    })
} catch (error) {
    if (error.code === -32602) {
        // Handle invalid params - likely missing email
        const retryResponse = await mcpClient.callTool('get_support', {
            title: "Database connection issue",
            problemDescription: "Cannot connect to PostgreSQL database",
            email: "developer@company.com"
        })
    }
}
```

**Handling Walkthrough Errors**:
```javascript
const response = await mcpClient.callTool('start_walkthrough', {
    name: "Non-existent Walkthrough"
})

// Response will contain error message, not throw exception
if (response.content[0].text.includes('not found')) {
    // Fallback to listing available walkthroughs
    const listResponse = await mcpClient.callTool('start_walkthrough', {})
    // Parse JSON to get available options
    const walkthroughs = JSON.parse(listResponse.content[0].text)
}
```

### Integration Examples

#### React MCP Client Component

```tsx
import React, { useState, useEffect } from 'react'
import { MCPClient } from '@modelcontextprotocol/client'

interface MCPTool {
    name: string
    title: string
    description: string
    inputSchema: object
}

export function MCPDashboard({ serverUrl, trackingId }: {
    serverUrl: string
    trackingId?: string
}) {
    const [client, setClient] = useState<MCPClient>()
    const [tools, setTools] = useState<MCPTool[]>([])
    const [isConnected, setIsConnected] = useState(false)

    useEffect(() => {
        const connectToMCP = async () => {
            try {
                const mcpClient = new MCPClient(
                    trackingId 
                        ? `${serverUrl}/${trackingId}/mcp`
                        : `${serverUrl}/mcp`
                )
                
                await mcpClient.connect()
                
                // Get available tools
                const toolsResponse = await mcpClient.listTools()
                setTools(toolsResponse.tools)
                
                setClient(mcpClient)
                setIsConnected(true)
            } catch (error) {
                console.error('Failed to connect to MCP server:', error)
                setIsConnected(false)
            }
        }

        connectToMCP()
        
        return () => {
            client?.disconnect()
        }
    }, [serverUrl, trackingId])

    const callTool = async (toolName: string, args: object) => {
        if (!client) return

        try {
            const response = await client.callTool(toolName, args)
            return response.content[0].text
        } catch (error) {
            console.error(`Tool ${toolName} failed:`, error)
            return `Error: ${error.message}`
        }
    }

    return (
        <div className="mcp-dashboard">
            <div className="connection-status">
                Status: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            
            {tools.map(tool => (
                <ToolCard
                    key={tool.name}
                    tool={tool}
                    onExecute={(args) => callTool(tool.name, args)}
                />
            ))}
        </div>
    )
}

function ToolCard({ tool, onExecute }: {
    tool: MCPTool
    onExecute: (args: object) => Promise<string>
}) {
    const [result, setResult] = useState<string>()
    const [isLoading, setIsLoading] = useState(false)

    const handleSupportTicket = async () => {
        setIsLoading(true)
        try {
            const response = await onExecute({
                title: "Integration Help",
                problemDescription: "Need help integrating the MCP client",
                email: "developer@example.com"
            })
            setResult(response)
        } finally {
            setIsLoading(false)
        }
    }

    const handleStartWalkthrough = async () => {
        setIsLoading(true)
        try {
            const response = await onExecute({})
            setResult(response)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="tool-card">
            <h3>{tool.title}</h3>
            <p>{tool.description}</p>
            
            {tool.name === 'get_support' && (
                <button onClick={handleSupportTicket} disabled={isLoading}>
                    {isLoading ? 'Creating Ticket...' : 'Get Support'}
                </button>
            )}
            
            {tool.name === 'start_walkthrough' && (
                <button onClick={handleStartWalkthrough} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Start Learning'}
                </button>
            )}
            
            {result && (
                <div className="tool-result">
                    <pre>{result}</pre>
                </div>
            )}
        </div>
    )
}
```

#### Node.js Backend Integration

```javascript
const { MCPClient } = require('@modelcontextprotocol/client')
const express = require('express')

class MCPServiceIntegration {
    constructor(baseUrl) {
        this.baseUrl = baseUrl
        this.clients = new Map() // Track clients per user/session
    }

    async getClientForUser(userId, trackingId = null) {
        const clientKey = `${userId}-${trackingId || 'anonymous'}`
        
        if (this.clients.has(clientKey)) {
            return this.clients.get(clientKey)
        }

        const mcpUrl = trackingId 
            ? `${this.baseUrl}/${trackingId}/mcp`
            : `${this.baseUrl}/mcp`
            
        const client = new MCPClient(mcpUrl)
        await client.connect()
        
        this.clients.set(clientKey, client)
        
        // Auto-cleanup after 30 minutes of inactivity
        setTimeout(() => {
            this.clients.delete(clientKey)
            client.disconnect()
        }, 30 * 60 * 1000)
        
        return client
    }

    async createSupportTicket(userId, ticketData) {
        try {
            const client = await this.getClientForUser(userId, ticketData.trackingId)
            
            const response = await client.callTool('get_support', {
                title: ticketData.title,
                problemDescription: ticketData.description,
                problemContext: ticketData.context,
                email: ticketData.email
            })
            
            // Parse response to extract ticket ID
            const responseText = response.content[0].text
            const ticketMatch = responseText.match(/ticket #(\d+)/)
            
            return {
                success: true,
                ticketId: ticketMatch ? ticketMatch[1] : null,
                message: responseText
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            }
        }
    }

    async startWalkthroughForUser(userId, walkthroughName = null) {
        const client = await this.getClientForUser(userId)
        
        const response = await client.callTool('start_walkthrough', {
            ...(walkthroughName && { name: walkthroughName })
        })
        
        const responseText = response.content[0].text
        
        // Check if response is JSON (list) or HTML (step content)
        try {
            const parsed = JSON.parse(responseText)
            return {
                type: 'walkthrough_list',
                walkthroughs: parsed.walkthroughs
            }
        } catch {
            return {
                type: 'walkthrough_step',
                content: responseText
            }
        }
    }
}

// Express.js integration
const app = express()
const mcpService = new MCPServiceIntegration('https://customer.mcplatform.com/api/mcpserver')

app.post('/api/support', async (req, res) => {
    const { userId, title, description, context, email } = req.body
    
    const result = await mcpService.createSupportTicket(userId, {
        title,
        description, 
        context,
        email
    })
    
    res.json(result)
})

app.post('/api/walkthrough/start', async (req, res) => {
    const { userId, walkthroughName } = req.body
    
    try {
        const result = await mcpService.startWalkthroughForUser(userId, walkthroughName)
        res.json(result)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
})

app.listen(3001, () => {
    console.log('MCP integration service running on port 3001')
})
```

### Performance Optimization Strategies

#### Connection Management

**Connection Pooling Pattern**:
```javascript
class MCPConnectionPool {
    constructor(serverUrl, options = {}) {
        this.serverUrl = serverUrl
        this.maxConnections = options.maxConnections || 10
        this.connectionTimeout = options.connectionTimeout || 30000
        
        this.activeConnections = new Map()
        this.connectionQueue = []
    }

    async getConnection(trackingId = null) {
        const connectionKey = trackingId || 'anonymous'
        
        // Return existing connection if available
        if (this.activeConnections.has(connectionKey)) {
            const conn = this.activeConnections.get(connectionKey)
            if (conn.isActive()) {
                return conn
            } else {
                this.activeConnections.delete(connectionKey)
            }
        }

        // Create new connection if under limit
        if (this.activeConnections.size < this.maxConnections) {
            return await this.createConnection(connectionKey)
        }

        // Wait for available connection
        return new Promise((resolve, reject) => {
            this.connectionQueue.push({ resolve, reject, connectionKey })
            
            setTimeout(() => {
                reject(new Error('Connection timeout'))
            }, this.connectionTimeout)
        })
    }

    async createConnection(connectionKey) {
        const mcpUrl = connectionKey !== 'anonymous'
            ? `${this.serverUrl}/${connectionKey}/mcp`
            : `${this.serverUrl}/mcp`
            
        const client = new MCPClient(mcpUrl)
        await client.connect()
        
        // Wrap client with connection management
        const connection = {
            client,
            lastUsed: Date.now(),
            isActive: () => client.isConnected(),
            close: () => {
                client.disconnect()
                this.activeConnections.delete(connectionKey)
                this.processQueue()
            }
        }
        
        this.activeConnections.set(connectionKey, connection)
        
        // Auto-cleanup after inactivity
        setTimeout(() => {
            if (Date.now() - connection.lastUsed > 300000) { // 5 minutes
                connection.close()
            }
        }, 300000)
        
        return connection
    }

    processQueue() {
        if (this.connectionQueue.length > 0 && 
            this.activeConnections.size < this.maxConnections) {
            const { resolve, connectionKey } = this.connectionQueue.shift()
            this.createConnection(connectionKey).then(resolve)
        }
    }
}
```

#### Caching Strategies

**Tool Response Caching**:
```javascript
class MCPResponseCache {
    constructor(ttl = 300000) { // 5 minutes default TTL
        this.cache = new Map()
        this.ttl = ttl
    }

    getCacheKey(toolName, args, trackingId) {
        return `${toolName}:${JSON.stringify(args)}:${trackingId || 'anonymous'}`
    }

    get(toolName, args, trackingId) {
        const key = this.getCacheKey(toolName, args, trackingId)
        const cached = this.cache.get(key)
        
        if (cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.response
        }
        
        if (cached) {
            this.cache.delete(key) // Remove expired entry
        }
        
        return null
    }

    set(toolName, args, trackingId, response) {
        const key = this.getCacheKey(toolName, args, trackingId)
        
        this.cache.set(key, {
            response,
            timestamp: Date.now()
        })
    }

    // Smart caching - only cache certain tool types
    shouldCache(toolName, args) {
        // Cache walkthrough lists (change infrequently)
        if (toolName === 'start_walkthrough' && !args.name) {
            return true
        }
        
        // Don't cache support tickets (always unique)
        if (toolName === 'get_support') {
            return false
        }
        
        // Cache step content (same step always returns same content)
        if (toolName === 'get_next_step') {
            return true
        }
        
        return false
    }
}

// Usage with caching wrapper
class CachedMCPClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl
        this.cache = new MCPResponseCache()
        this.connectionPool = new MCPConnectionPool(serverUrl)
    }

    async callTool(toolName, args, trackingId = null) {
        // Check cache first
        if (this.cache.shouldCache(toolName, args)) {
            const cached = this.cache.get(toolName, args, trackingId)
            if (cached) {
                return cached
            }
        }

        // Make actual call
        const connection = await this.connectionPool.getConnection(trackingId)
        const response = await connection.client.callTool(toolName, args)
        
        // Update last used timestamp
        connection.lastUsed = Date.now()
        
        // Cache if appropriate
        if (this.cache.shouldCache(toolName, args)) {
            this.cache.set(toolName, args, trackingId, response)
        }
        
        return response
    }
}
```

---

## Related Documentation

- [VHost Routing System](../02-architecture/vhost-routing.md) - Server resolution and DNS setup
- [Dual Authentication System](../03-authentication/dual-auth-system.md) - Platform vs MCP user authentication
- [Database Schema](../04-database/schema-design.md) - Data relationships and patterns
- [oRPC API Reference](../09-api-reference/orpc-reference.md) - Internal API for managing servers
- [Testing Guide](../07-testing/testing-guide.md) - MCP server testing patterns
- [SST Deployment](../08-deployment/sst-deployment.md) - Infrastructure and environment setup

## Implementation Notes

### Performance Considerations

- **Server Lookup**: Single database query for VHost resolution with planned Redis caching
- **Tool Registration**: Conditional registration based on server config to minimize memory usage
- **Session Tracking**: Efficient upserting with tracking ID/email combination
- **Query Optimization**: Strategic use of JOINs and subqueries for analytics data
- **Connection Pooling**: Redis integration for scalable session management

### Security Architecture

- **Organization Isolation**: All data scoped to customer organization with database-level enforcement
- **Anonymous Access**: Supports tracking without requiring authentication while maintaining privacy
- **OAuth Integration**: Optional OAuth for enhanced user identification with secure token handling
- **Input Validation**: All tool inputs validated with Zod schemas and length limits
- **VHost Security**: Strict subdomain validation prevents cross-organization access

### Monitoring & Analytics

- **Tool Usage Tracking**: All tool calls recorded with input/output for analytics and debugging
- **Session Analytics**: Connection patterns and user behavior tracking across sessions
- **Error Tracking**: Comprehensive error logging with planned database storage
- **Performance Metrics**: Request/response timing in logs with planned structured metrics
- **User Journey**: Complete walkthrough progress tracking for engagement analysis