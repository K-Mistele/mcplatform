# oRPC API Reference

This document provides comprehensive reference for all oRPC endpoints in MCPlatform. The API uses [oRPC](https://orpc.unnoq.com/) for type-safe client-server communication with automatic error handling and validation.

## Overview

MCPlatform's API is built with oRPC and provides two types of endpoints:
- **Client RPC Calls**: For data fetching from client components (defined in `router.ts`)
- **Server Actions**: For data mutations from forms (defined in `actions.ts`, see [Server Actions Guide](../01-getting-started/development-workflow.md#server-actions))

This document covers the client RPC endpoints. All endpoints require authentication via the platform authentication system.

## Base Configuration

**Location**: `packages/dashboard/src/lib/orpc/router.ts:8-13`

```typescript
export const base = os.errors({
    UNAUTHORIZED: {},
    RESOURCE_NOT_FOUND: {},
    INVALID_SUBDOMAIN: {},
    SUBDOMAIN_ALREADY_EXISTS: {}
})
```

### Error Handling

All endpoints can return these standardized errors:
- `UNAUTHORIZED`: User not authenticated or lacks permissions
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist or user can't access it
- `INVALID_SUBDOMAIN`: Subdomain format or routing issue
- `SUBDOMAIN_ALREADY_EXISTS`: Conflict with existing subdomain

## Authentication

All endpoints require platform authentication. The `requireSession()` function validates the user session and returns organization context.

```typescript
const session = await requireSession()
// session.session.activeOrganizationId - Current organization
```

## API Endpoints

### Example Endpoint

**Namespace**: `example.execute`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:15-28`

Simple example endpoint for testing oRPC functionality.

#### Input Schema
```typescript
{
    name: string,
    age: number
}
```

#### Response Schema
```typescript
{
    name: string,
    age: number,
    message: string
}
```

#### Usage Example
```typescript
import { client } from '@/lib/orpc/client'

const result = await client.example.execute({
    name: "John",
    age: 30
})
// Returns: { name: "John", age: 30, message: "hello, John!" }
```

---

### Tool Calls Analytics

**Namespace**: `toolCalls.getChart`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:30-148`

Retrieves time-series analytics data for tool calls and MCP connections within the authenticated user's organization.

#### Input Schema
```typescript
{
    timeRange: '1h' | '1d' | '1w' | '1m'
}
```

#### Response Schema
```typescript
{
    data: Array<{
        date: number,           // Timestamp for this data point
        [toolName: string]: number,  // Count for each tool
        mcp_connections: number      // Unique user connections
    }>,
    toolNames: string[],        // List of all tool names found
    connectionTypes: ['mcp_connections']
}
```

#### Functionality
- **Organization Scoped**: Only returns data for user's active organization
- **Time Bucketing**: Groups data into intervals based on time range:
  - `1h`: 5-minute intervals (12 buckets)
  - `1d`: 1-hour intervals (24 buckets) 
  - `1w`: Daily intervals (7 buckets)
  - `1m`: Daily intervals (30 buckets)
- **User Deduplication**: Connections are deduplicated per user per time period
- **Tool Filtering**: Only includes tools from organization's MCP servers

#### Database Relationships
- **Tool Calls**: `toolCalls` → `mcpServers` → `organizationId`
- **Connections**: `mcpServerSession` → `mcpServers` → `organizationId`
- **User Tracking**: Uses `mcpServerUser.trackingId` or `email` for deduplication

#### Usage Example
```typescript
import { client } from '@/lib/orpc/client'

const analytics = await client.toolCalls.getChart({
    timeRange: '1d'
})

// Process time-series data
analytics.data.forEach(point => {
    console.log(`At ${new Date(point.date)}:`)
    analytics.toolNames.forEach(tool => {
        console.log(`  ${tool}: ${point[tool]} calls`)
    })
    console.log(`  Connections: ${point.mcp_connections}`)
})
```

---

### Session Management

#### Get Session Tool Calls

**Namespace**: `sessions.getToolCalls`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:312-342`

Retrieves all tool calls for a specific MCP session.

##### Input Schema
```typescript
{
    sessionId: string
}
```

##### Response Schema
```typescript
Array<{
    id: string,
    toolName: string,
    input: any,           // Tool input parameters
    output: any,          // Tool execution result
    createdAt: number,    // Timestamp
    serverName: string,   // MCP server name
    serverSlug: string    // MCP server slug
}>
```

##### Authorization
- Verifies session belongs to user's organization
- Only returns tool calls from organization's MCP servers

#### Get Session Support Tickets

**Namespace**: `sessions.getSupportTickets`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:344-374`

Retrieves support tickets submitted during a specific MCP session.

##### Input Schema
```typescript
{
    sessionId: string
}
```

##### Response Schema
```typescript
Array<{
    id: string,
    title: string,
    conciseSummary: string,
    status: string,
    createdAt: number,
    serverName: string,
    serverSlug: string
}>
```

---

### Support Tickets

#### Get Support Ticket Activities

**Namespace**: `supportTickets.getActivities`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:376-423`

Retrieves activity timeline for a specific support ticket with pagination.

##### Input Schema
```typescript
{
    ticketId: string,
    limit?: number,     // Default: 50
    offset?: number     // Default: 0
}
```

##### Response Schema
```typescript
Array<{
    id: string,
    createdAt: number,
    activityType: string,
    content: string,
    contentType: string,
    metadata: any,
    userName: string | null,    // Platform user who created activity
    userEmail: string | null
}>
```

##### Security
- Verifies ticket belongs to user's organization before returning activities
- Returns `RESOURCE_NOT_FOUND` if ticket doesn't exist or user lacks access

#### Get Support Ticket with MCP User

**Namespace**: `supportTickets.getWithMcpUser`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:442-486`

Retrieves a support ticket with associated end-user information from the MCP authentication system.

##### Input Schema
```typescript
{
    ticketId: string
}
```

##### Response Schema
```typescript
{
    // Support ticket fields
    ticketId: string,
    title: string,
    status: string,
    createdAt: number,
    
    // End-user information (from MCP auth system)
    mcpUserTrackingId: string | null,
    mcpUserEmail: string | null,
    mcpUserFirstSeen: number | null,
    
    // MCP server context
    mcpServerName: string,
    mcpServerSlug: string
}
```

##### Database Relationships
Complex join across authentication boundaries:
- `supportRequests` → `mcpServerSession` → `mcpServerUser` (end-user data)
- `supportRequests` → `mcpServers` (server context)

---

### Organization Management

#### Get Organization Members

**Namespace**: `organization.getMembers`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:425-440`

Retrieves all members of the authenticated user's active organization.

##### Input Schema
No input parameters required.

##### Response Schema
```typescript
Array<{
    id: string,
    name: string | null,
    email: string,
    image: string | null
}>
```

##### Database Relationships
- `user` → `member` → `organizationId` (filters to active organization)

---

### Walkthrough System

#### Render Walkthrough Step

**Namespace**: `walkthrough.renderStep`  
**Location**: `packages/dashboard/src/lib/orpc/router.ts:488-506`

Renders a walkthrough step using the template engine system.

##### Input Schema
```typescript
{
    walkthrough: {
        title: string,
        description: string | null,
        type: string | null
    },
    step: {
        id: string,
        title: string,
        displayOrder: number,
        contentFields: any
    }
}
```

##### Response Schema
```typescript
string  // Rendered HTML content
```

##### Functionality
- Uses `renderWalkthroughStep()` from `@/lib/template-engine`
- Processes step content fields into displayable HTML
- Handles dynamic content based on step type

## Client Usage Patterns

### Basic Client Setup

```typescript
import { client } from '@/lib/orpc/client'
import { useQuery } from '@tanstack/react-query'
import { onError, onSuccess } from '@orpc/client'

function MyComponent() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['toolCalls', 'chart', '1d'],
        queryFn: () => client.toolCalls.getChart({ timeRange: '1d' })
    })
    
    if (isLoading) return <div>Loading...</div>
    if (error) return <div>Error: {error.message}</div>
    
    return <div>{/* Render analytics */}</div>
}
```

### Error Handling with Interceptors

```typescript
import { isDefinedError } from '@orpc/shared'

const result = await client.supportTickets.getWithMcpUser(
    { ticketId: 'ticket_123' },
    {
        interceptors: [
            onSuccess((data) => {
                console.log('Ticket loaded:', data.title)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    switch (error.code) {
                        case 'RESOURCE_NOT_FOUND':
                            toast.error('Ticket not found')
                            break
                        case 'UNAUTHORIZED':
                            redirect('/login')
                            break
                    }
                }
            })
        ]
    }
)
```

### Pagination Pattern

```typescript
async function loadActivities(ticketId: string, page = 0) {
    const limit = 25
    const offset = page * limit
    
    return client.supportTickets.getActivities({
        ticketId,
        limit,
        offset
    })
}
```

## Implementation Notes

### Time Series Data Processing

The `getToolCallsChart` endpoint includes sophisticated time-series processing:

1. **Bucket Creation**: Creates time buckets based on range and current time
2. **Data Rounding**: Rounds timestamps to nearest bucket for consistent grouping
3. **User Deduplication**: Prevents counting multiple connections from same user
4. **Metric Initialization**: Ensures all time buckets have consistent structure

### Multi-Tenant Security

All endpoints enforce organization-level security:
- Use `session.session.activeOrganizationId` for filtering
- Join queries through organization relationships
- Validate ownership before returning sensitive data

### Database Query Patterns

**Efficient Joins**:
```typescript
// Pattern: Always join through organization relationship
.leftJoin(schema.mcpServers, eq(schema.toolCalls.mcpServerId, schema.mcpServers.id))
.where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))
```

**Null Handling**:
```typescript
// Filter out null timestamps before processing
const validToolCalls = toolCallsResult.filter((r) => r.createdAt !== null)
```

## Server Actions Reference

Server actions are created with oRPC and handle data mutations from forms. They are defined in separate files under `packages/dashboard/src/lib/orpc/actions/` and use the `.actionable({})` method to convert oRPC functions into server actions.

### Organization Management Actions

**Location**: `packages/dashboard/src/lib/orpc/actions/organization.ts`

#### Get Organization Members (Paginated)

**Action**: `getOrganizationMembersAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/organization.ts:11-61`

Retrieves paginated list of organization members with user details.

##### Input Schema
```typescript
{
    page?: number,        // Default: 1, minimum: 1
    pageSize?: number     // Default: 20, range: 1-100
}
```

##### Response Schema
```typescript
{
    members: Array<{
        id: string,
        userId: string,
        role: 'owner' | 'admin' | 'member',
        createdAt: Date,
        name: string | null,
        email: string,
        image: string | null
    }>,
    totalCount: number,
    page: number,
    pageSize: number,
    totalPages: number
}
```

##### Usage Example
```typescript
import { useServerAction } from '@orpc/react/hooks'
import { getOrganizationMembersAction } from '@/lib/orpc/actions/organization'

const { execute, status, data } = useServerAction(getOrganizationMembersAction)

// Load members for page 2 with 10 per page
const loadMembers = () => execute({ page: 2, pageSize: 10 })
```

---

#### Update Member Role

**Action**: `updateMemberRoleAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/organization.ts:115-206`

Updates a member's role with proper authorization checks.

##### Input Schema
```typescript
{
    memberId: string,
    role: 'owner' | 'admin' | 'member'
}
```

##### Authorization Requirements
- Current user must be owner or admin
- Cannot demote the last owner
- Uses Better Auth API internally

##### Revalidation Paths
- `/dashboard/team/members`

---

#### Invite User to Organization

**Action**: `inviteUserToOrganizationAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/organization.ts:208-301`

Invites a user to the organization with email validation.

##### Input Schema
```typescript
{
    email: string,        // Must be valid email format
    role: 'owner' | 'admin' | 'member'
}
```

##### Business Logic
- Checks if user is already a member
- Prevents duplicate pending invitations
- Sets 48-hour expiration automatically
- Creates UUID for invitation ID

##### Error Conditions
- Email already a member: `RESOURCE_NOT_FOUND`
- Pending invitation exists: `RESOURCE_NOT_FOUND`
- Insufficient permissions: `UNAUTHORIZED`

---

#### Accept Invitation

**Action**: `acceptInvitationAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/organization.ts:542-648`

Accepts an organization invitation for the authenticated user.

##### Input Schema
```typescript
{
    invitationId: string
}
```

##### Validation Logic
- Verifies invitation status is 'pending'
- Checks expiration date
- Matches user email to invitation email
- Prevents duplicate memberships
- Sets organization as active after acceptance

##### Security Features
- Email must match logged-in user
- Cannot accept expired invitations
- Cannot accept already-used invitations
- Automatically activates organization for user

---

### MCP Server Management Actions

**Location**: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts`

#### Create MCP Server

**Action**: `createMcpServerAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:10-26`

Creates a new MCP server in the user's organization.

##### Input Schema
```typescript
// Defined by createMcpServerSchema from schemas.isometric
{
    name: string,
    slug: string,        // Must be globally unique subdomain
    authType?: 'platform_oauth' | 'custom_oauth' | 'none' | 'collect_email',
    supportTicketType?: 'slack' | 'linear' | 'dashboard' | 'none',
    walkthroughToolsEnabled?: boolean
}
```

##### Automatic Fields
- `organizationId`: Set to user's active organization
- `id`: Generated automatically
- `createdAt`: Set to current timestamp

---

#### Validate Subdomain

**Action**: `validateSubdomainAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:56-84`

Validates subdomain format and availability.

##### Input Schema
```typescript
{
    subdomain: string
}
```

##### Validation Rules
- Must contain only letters, numbers, and hyphens
- Length between 6-36 characters
- Must be globally unique across all organizations
- Automatically sanitizes to lowercase

##### Error Types
- `INVALID_SUBDOMAIN`: Format or length issues
- `SUBDOMAIN_ALREADY_EXISTS`: Uniqueness violation

---

#### Update Server Configuration

**Action**: `updateMcpServerConfiguration`  
**Location**: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:86-121`

Updates MCP server authentication and support settings.

##### Input Schema
```typescript
{
    serverId: string,
    authType: 'platform_oauth' | 'custom_oauth' | 'none' | 'collect_email',
    supportTicketType: 'slack' | 'linear' | 'dashboard' | 'none'
}
```

##### Revalidation Paths
- `/dashboard/mcp-servers/${serverId}`

---

### Walkthrough Management Actions

**Location**: `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts`

#### Create Walkthrough

**Action**: `createWalkthroughAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:11-37`

Creates a new walkthrough in the user's organization.

##### Input Schema
```typescript
{
    title: string,        // 1-100 characters
    description?: string, // Max 500 characters
    type: 'course' | 'installer' | 'troubleshooting' | 'integration' | 'quickstart',
    isPublished?: boolean // Default: false
}
```

##### Status Logic
- `isPublished: true` → `status: 'published'`
- `isPublished: false` → `status: 'draft'`

---

#### Create Walkthrough Step

**Action**: `createWalkthroughStepAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:114-169`

Adds a new step to an existing walkthrough.

##### Input Schema
```typescript
{
    walkthroughId: string,
    title: string         // 1-200 characters
}
```

##### Automatic Behavior
- Calculates next display order automatically
- Initializes contentFields with v1 template structure
- Verifies walkthrough ownership before creation

##### contentFields Structure
```typescript
{
    version: 'v1',
    introductionForAgent: '',
    contextForAgent: '',
    contentForUser: '',
    operationsForAgent: ''
}
```

---

#### Update Walkthrough Step

**Action**: `updateWalkthroughStepAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:171-237`

Updates step title and content fields.

##### Input Schema
```typescript
{
    stepId: string,
    title?: string,       // 1-200 characters
    contentFields?: {
        version: 'v1',
        introductionForAgent?: string,
        contextForAgent?: string,
        contentForUser?: string,
        operationsForAgent?: string
    }
}
```

##### Merge Behavior
- contentFields are merged with existing data
- Partial updates supported
- Preserves existing fields when not specified

---

#### Reorder Walkthrough Steps

**Action**: `reorderWalkthroughStepsAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/walkthroughs.ts:275-321`

Reorders steps by updating display order.

##### Input Schema
```typescript
{
    walkthroughId: string,
    stepIds: string[]     // Ordered array of step IDs
}
```

##### Implementation
- Updates displayOrder field based on array position
- All steps updated in parallel with Promise.all
- Validates walkthrough ownership first

---

### Support Ticket Actions

**Location**: `packages/dashboard/src/lib/orpc/actions/support-tickets.ts`

#### Update Support Ticket Status

**Action**: `updateSupportTicketStatus`  
**Location**: `packages/dashboard/src/lib/orpc/actions/support-tickets.ts:9-50`

Updates ticket status and creates activity record.

##### Input Schema
```typescript
{
    ticketId: string,
    status: 'needs_email' | 'pending' | 'in_progress' | 'resolved' | 'closed',
    comment?: string
}
```

##### Automatic Behavior
- Sets resolvedAt timestamp for resolved/closed status
- Creates activity entry tracking status change
- Verifies ticket ownership before update

---

### User Management Actions

#### Delete MCP Users

**Action**: `deleteMcpUsersAction`  
**Location**: `packages/dashboard/src/lib/orpc/actions/mcp-servers.ts:123-168`

Deletes multiple MCP users with organization scoping.

##### Input Schema
```typescript
{
    userIds: string[]     // Array of MCP user IDs to delete
}
```

##### Security Implementation
- Uses subquery to ensure users belong to organization
- Complex join through sessions and servers
- Returns count of actually deleted users
- Filters out users outside organization scope

##### Database Relationships
```typescript
// Security filter chain:
mcpServerUser → mcpServerSession → mcpServers → organization
```

---

## Server Action Usage Patterns

### Basic Form Integration

```typescript
import { useServerAction } from '@orpc/react/hooks'
import { onSuccess, onError } from '@orpc/client'
import { createMcpServerAction } from '@/lib/orpc/actions/mcp-servers'

function CreateServerForm() {
    const { execute, status } = useServerAction(createMcpServerAction, {
        interceptors: [
            onSuccess((data) => {
                toast.success(`Server ${data.name} created successfully`)
                router.push(`/dashboard/mcp-servers/${data.id}`)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    if (error.code === 'SUBDOMAIN_ALREADY_EXISTS') {
                        setFieldError('slug', error.message)
                    }
                }
            })
        ]
    })

    const handleSubmit = (formData: FormData) => {
        execute({
            name: formData.get('name') as string,
            slug: formData.get('slug') as string,
            authType: formData.get('authType') as AuthType
        })
    }

    return (
        <form action={handleSubmit}>
            {/* Form fields */}
            <button type="submit" disabled={status === 'executing'}>
                {status === 'executing' ? 'Creating...' : 'Create Server'}
            </button>
        </form>
    )
}
```

### Error Handling Patterns

```typescript
import { isDefinedError } from '@orpc/shared'

// Comprehensive error handling
const handleError = (error: any) => {
    if (isDefinedError(error)) {
        switch (error.code) {
            case 'UNAUTHORIZED':
                toast.error('You do not have permission to perform this action')
                router.push('/dashboard/team')
                break
            case 'RESOURCE_NOT_FOUND':
                toast.error('The requested resource was not found')
                break
            case 'SUBDOMAIN_ALREADY_EXISTS':
                setFieldError('subdomain', 'This subdomain is already taken')
                break
            case 'INVALID_SUBDOMAIN':
                setFieldError('subdomain', error.message)
                break
            default:
                toast.error('An unexpected error occurred')
        }
    } else {
        toast.error('Network error. Please try again.')
    }
}
```

### Optimistic Updates

```typescript
import { useServerAction } from '@orpc/react/hooks'
import { updateMemberRoleAction } from '@/lib/orpc/actions/organization'

function MemberRoleSelector({ member, onOptimisticUpdate }) {
    const { execute, status } = useServerAction(updateMemberRoleAction, {
        interceptors: [
            onSuccess((result) => {
                // Confirm optimistic update worked
                toast.success('Role updated successfully')
            }),
            onError((error) => {
                // Rollback optimistic update
                onOptimisticUpdate(member.id, member.role) // revert
                handleError(error)
            })
        ]
    })

    const handleRoleChange = (newRole: Role) => {
        // Optimistic update
        onOptimisticUpdate(member.id, newRole)
        
        // Execute server action
        execute({ memberId: member.id, role: newRole })
    }

    return (
        <Select 
            value={member.role} 
            onValueChange={handleRoleChange}
            disabled={status === 'executing'}
        >
            {/* Options */}
        </Select>
    )
}
```

### Bulk Operations

```typescript
import { deleteMcpUsersAction } from '@/lib/orpc/actions/mcp-servers'

function BulkUserManager({ selectedUserIds }) {
    const { execute, status } = useServerAction(deleteMcpUsersAction)

    const handleBulkDelete = async () => {
        const result = await execute({ userIds: selectedUserIds })
        
        if (result) {
            toast.success(`Deleted ${result.deletedCount} users`)
            // Clear selection
            setSelectedUserIds([])
        }
    }

    return (
        <button 
            onClick={handleBulkDelete}
            disabled={selectedUserIds.length === 0 || status === 'executing'}
        >
            Delete Selected ({selectedUserIds.length})
        </button>
    )
}
```

### Pagination with Server Actions

```typescript
import { getOrganizationMembersAction } from '@/lib/orpc/actions/organization'

function MembersTable() {
    const [page, setPage] = useState(1)
    const { execute, status, data } = useServerAction(getOrganizationMembersAction)

    useEffect(() => {
        execute({ page, pageSize: 20 })
    }, [page])

    if (!data) return <div>Loading...</div>

    return (
        <div>
            <table>
                {data.members.map(member => (
                    <MemberRow key={member.id} member={member} />
                ))}
            </table>
            
            <Pagination 
                currentPage={data.page}
                totalPages={data.totalPages}
                onPageChange={setPage}
            />
        </div>
    )
}
```

## Advanced Server Action Patterns

### Multi-Step Forms with Server Actions

```typescript
// Multi-step walkthrough creation
function WalkthroughWizard() {
    const [step, setStep] = useState(1)
    const [walkthroughId, setWalkthroughId] = useState<string>()
    
    const { execute: createWalkthrough } = useServerAction(createWalkthroughAction, {
        interceptors: [
            onSuccess((result) => {
                setWalkthroughId(result.id)
                setStep(2) // Move to step creation
            })
        ]
    })
    
    const { execute: createStep } = useServerAction(createWalkthroughStepAction, {
        interceptors: [
            onSuccess(() => {
                setStep(3) // Move to content editing
            })
        ]
    })

    // Handle wizard progression
    const handleStep1Submit = (data) => {
        createWalkthrough(data)
    }
    
    const handleStep2Submit = (data) => {
        createStep({ walkthroughId, ...data })
    }

    return (
        <WizardContainer>
            {step === 1 && <WalkthroughBasicsForm onSubmit={handleStep1Submit} />}
            {step === 2 && <StepCreationForm onSubmit={handleStep2Submit} />}
            {step === 3 && <ContentEditor walkthroughId={walkthroughId} />}
        </WizardContainer>
    )
}
```

### Conditional Server Actions

```typescript
// Different actions based on user role
function ConditionalMemberActions({ member, currentUserRole }) {
    const { execute: updateRole } = useServerAction(updateMemberRoleAction)
    const { execute: removeMember } = useServerAction(removeMemberFromOrganizationAction)
    
    const canManageMembers = currentUserRole === 'owner' || currentUserRole === 'admin'
    const canRemoveThisMember = canManageMembers && member.role !== 'owner'
    
    return (
        <div>
            {canManageMembers && (
                <RoleSelector 
                    value={member.role}
                    onChange={(role) => updateRole({ memberId: member.id, role })}
                />
            )}
            
            {canRemoveThisMember && (
                <button 
                    onClick={() => removeMember({ memberId: member.id })}
                    className="text-red-600"
                >
                    Remove Member
                </button>
            )}
        </div>
    )
}
```

### Real-time Updates with Server Actions

```typescript
// Combining server actions with real-time updates
function LiveSupportTickets() {
    const [tickets, setTickets] = useState([])
    const { execute: updateStatus } = useServerAction(updateSupportTicketStatus, {
        interceptors: [
            onSuccess((result) => {
                // Optimistically update local state
                setTickets(prev => prev.map(ticket => 
                    ticket.id === result.id ? result : ticket
                ))
            })
        ]
    })
    
    // WebSocket or polling for real-time updates
    useEffect(() => {
        const ws = new WebSocket('/api/support-tickets/live')
        ws.onmessage = (event) => {
            const updatedTicket = JSON.parse(event.data)
            setTickets(prev => prev.map(ticket => 
                ticket.id === updatedTicket.id ? updatedTicket : ticket
            ))
        }
        return () => ws.close()
    }, [])
    
    return (
        <div>
            {tickets.map(ticket => (
                <TicketCard 
                    key={ticket.id}
                    ticket={ticket}
                    onStatusChange={(status) => 
                        updateStatus({ ticketId: ticket.id, status })
                    }
                />
            ))}
        </div>
    )
}
```

## Security Considerations for Server Actions

### Authorization Patterns

All server actions follow these security principles:

1. **Session Validation**: Every action calls `requireSession()` first
2. **Organization Scoping**: Resources are filtered by `activeOrganizationId`
3. **Role-Based Access**: Admin/owner roles required for sensitive operations
4. **Resource Ownership**: Verify user owns resource before modification
5. **Input Validation**: Zod schemas validate all inputs

### Example Authorization Implementation

```typescript
// Typical server action security pattern
export const sensitiveAction = base
    .input(inputSchema)
    .handler(async ({ input, errors }) => {
        // 1. Validate session and get organization
        const session = await requireSession()
        
        // 2. Check user role if needed
        const [userRole] = await db
            .select({ role: schema.member.role })
            .from(schema.member)
            .where(and(
                eq(schema.member.userId, session.user.id),
                eq(schema.member.organizationId, session.session.activeOrganizationId)
            ))
        
        if (!userRole || userRole.role === 'member') {
            throw errors.UNAUTHORIZED({ message: 'Admin role required' })
        }
        
        // 3. Verify resource ownership
        const [resource] = await db
            .select()
            .from(schema.someTable)
            .where(and(
                eq(schema.someTable.id, input.resourceId),
                eq(schema.someTable.organizationId, session.session.activeOrganizationId)
            ))
        
        if (!resource) {
            throw errors.RESOURCE_NOT_FOUND({ message: 'Resource not found' })
        }
        
        // 4. Perform authorized operation
        const result = await db.update(schema.someTable)...
        
        // 5. Revalidate affected paths
        revalidatePath('/affected/path')
        
        return result
    })
    .actionable({})
```

## Performance Optimization

### Database Query Optimization

1. **Efficient Joins**: Always join through organization relationships
2. **Index Usage**: Leverage organization and user ID indexes
3. **Pagination**: Use offset/limit for large datasets
4. **Selective Fields**: Only select needed columns

### Caching Strategies

1. **Path Revalidation**: Strategic `revalidatePath()` usage
2. **Granular Updates**: Revalidate specific resource paths
3. **Batch Operations**: Group related updates together

### Client-Side Optimization

1. **Optimistic Updates**: Immediate UI feedback
2. **Error Boundaries**: Graceful error handling
3. **Loading States**: Clear user feedback during execution
4. **Debouncing**: Prevent duplicate submissions

---

## Related Documentation

- [Development Workflow](../01-getting-started/development-workflow.md#server-actions) - Server actions and form handling
- [Database Schema](../04-database/schema-design.md) - Database relationships and patterns
- [Dual Authentication System](../03-authentication/dual-auth-system.md) - Understanding platform vs MCP user context
- [Better Auth Integration](../03-authentication/better-auth-guide.md) - Role management and organization APIs

## Router Configuration

**Complete Router Export** (`packages/dashboard/src/lib/orpc/router.ts:508-529`):

```typescript
export const router = {
    example: {
        execute: executeExample
    },
    toolCalls: {
        getChart: getToolCallsChart
    },
    sessions: {
        getToolCalls: getSessionToolCalls,
        getSupportTickets: getSessionSupportTickets
    },
    supportTickets: {
        getActivities: getSupportTicketActivities,
        getWithMcpUser: getSupportTicketWithMcpUser
    },
    organization: {
        getMembers: getOrganizationMembers
    },
    walkthrough: {
        renderStep: renderWalkthroughStepRPC
    }
}
```

**Server Actions Architecture**:

```
packages/dashboard/src/lib/orpc/actions/
├── organization.ts        # Team and member management
├── mcp-servers.ts        # MCP server CRUD operations  
├── walkthroughs.ts       # Walkthrough content management
├── support-tickets.ts    # Support ticket status updates
├── walkthrough-assignment.ts  # Step assignments and tracking
└── ingestion.ts          # Content processing and indexing
```

Each action file exports multiple server actions using the `.actionable({})` pattern, providing type-safe form handling with automatic validation, error handling, and path revalidation.