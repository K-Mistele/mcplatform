# Better Session Support - Implementation Plan

## Overview

This plan outlines the implementation of session-based user activity tracking with a modern three-pane UI interface. The goal is to provide a hierarchical view: User → Sessions → Tool Calls/Support Tickets → Details.

**Database Status**: ✅ Schema changes have been completed. The database now includes:
- `supportRequests.mcpServerSessionId` field (optional, references mcpServerSession)
- `mcpServerSession.title` field (currently null)
- All changes implemented through Drizzle ORM

## 1. UI Architecture - Three-Pane Design

### 1.1 Component Structure

```
UserDetailPage
├── UserHeader (user info, back button)
├── SessionsPane (left pane - 30% width)
│   ├── SessionsList
│   └── SessionCard (clickable)
├── SessionDetailPane (middle pane - 40% width)
│   ├── SessionHeader
│   ├── ToolCallsList
│   └── SupportTicketsList
└── DetailPane (right pane - 30% width)
    ├── ToolCallDetail
    └── SupportTicketDetail
```

### 1.2 State Management

```typescript
interface SessionViewState {
    selectedSessionId: string | null
    selectedToolCallId: string | null
    selectedSupportTicketId: string | null
    viewMode: 'tool_call' | 'support_ticket' | null
}
```

### 1.3 Responsive Design

- **Desktop (≥1200px)**: Three-pane layout
- **Tablet (768px-1199px)**: Two-pane with collapsible detail
- **Mobile (<768px)**: Single pane with navigation stack

## 2. Data Layer Updates

### 2.1 New Data Fetching Functions

**File**: `packages/dashboard/src/app/dashboard/users/[identifier]/data.ts`

```typescript
/**
 * Get user's sessions with aggregated metadata using Drizzle ORM
 */
export async function getUserSessions(userId: string) {
    // Use subqueries to get fresh counts instead of stored values
    const toolCallCounts = db
        .select({
            sessionId: schema.toolCalls.mcpServerSessionId,
            count: count(schema.toolCalls.id).as('toolCallCount')
        })
        .from(schema.toolCalls)
        .groupBy(schema.toolCalls.mcpServerSessionId)
        .as('toolCallCounts')

    const supportTicketCounts = db
        .select({
            sessionId: schema.supportRequests.mcpServerSessionId,
            count: count(schema.supportRequests.id).as('supportTicketCount')
        })
        .from(schema.supportRequests)
        .where(isNotNull(schema.supportRequests.mcpServerSessionId))
        .groupBy(schema.supportRequests.mcpServerSessionId)
        .as('supportTicketCounts')

    return await db
        .select({
            sessionId: schema.mcpServerSession.mcpServerSessionId,
            title: schema.mcpServerSession.title,
            connectionDate: schema.mcpServerSession.connectionDate,
            connectionTimestamp: schema.mcpServerSession.connectionTimestamp,
            serverName: schema.mcpServers.name,
            serverSlug: schema.mcpServers.slug,
            serverId: schema.mcpServers.id,
            toolCallCount: coalesce(toolCallCounts.count, 0).as('toolCallCount'),
            supportTicketCount: coalesce(supportTicketCounts.count, 0).as('supportTicketCount')
        })
        .from(schema.mcpServerSession)
        .leftJoin(schema.mcpServers, eq(schema.mcpServerSession.mcpServerSlug, schema.mcpServers.slug))
        .leftJoin(toolCallCounts, eq(schema.mcpServerSession.mcpServerSessionId, toolCallCounts.sessionId))
        .leftJoin(supportTicketCounts, eq(schema.mcpServerSession.mcpServerSessionId, supportTicketCounts.sessionId))
        .where(eq(schema.mcpServerSession.mcpServerUserId, userId))
        .orderBy(desc(schema.mcpServerSession.connectionTimestamp))
}

/**
 * Get tool calls for a specific session
 */
export async function getSessionToolCalls(sessionId: string) {
    return await db
        .select({
            id: schema.toolCalls.id,
            createdAt: schema.toolCalls.createdAt,
            toolName: schema.toolCalls.toolName,
            input: schema.toolCalls.input,
            output: schema.toolCalls.output
        })
        .from(schema.toolCalls)
        .where(eq(schema.toolCalls.mcpServerSessionId, sessionId))
        .orderBy(desc(schema.toolCalls.createdAt))
}

/**
 * Get support tickets for a specific session
 */
export async function getSessionSupportTickets(sessionId: string) {
    return await db
        .select({
            id: schema.supportRequests.id,
            createdAt: schema.supportRequests.createdAt,
            title: schema.supportRequests.title,
            conciseSummary: schema.supportRequests.conciseSummary,
            context: schema.supportRequests.context,
            status: schema.supportRequests.status,
            resolvedAt: schema.supportRequests.resolvedAt
        })
        .from(schema.supportRequests)
        .where(eq(schema.supportRequests.mcpServerSessionId, sessionId))
        .orderBy(desc(schema.supportRequests.createdAt))
}

/**
 * Get detailed tool call information
 */
export async function getToolCallDetail(toolCallId: string) {
    const [toolCall] = await db
        .select()
        .from(schema.toolCalls)
        .where(eq(schema.toolCalls.id, toolCallId))
        .limit(1)
    
    return toolCall
}

/**
 * Get support ticket detail information
 */
export async function getSupportTicketDetail(ticketId: string) {
    const [ticket] = await db
        .select()
        .from(schema.supportRequests)
        .where(eq(schema.supportRequests.id, ticketId))
        .limit(1)
    
    return ticket
}
```

## 3. Component Implementation

### 3.1 Main Page Component

**File**: `packages/dashboard/src/app/dashboard/users/[identifier]/page.tsx`

```typescript
export default async function UserDetailsPage(props: UserDetailsPageProps) {
    const params = await props.params
    const identifier = decodeURIComponent(params.identifier)

    const user = await getUserData(identifier)
    if (!user) {
        notFound()
    }

    // Create promises for data fetching
    const userPromise = Promise.resolve(user)
    const sessionsPromise = getUserSessions(user.id || '')

    return (
        <div className="flex flex-col h-screen">
            <UserHeader user={user} />
            
            <ErrorBoundary fallback={<div>Error loading user sessions</div>}>
                <Suspense fallback={<SessionViewSkeleton />}>
                    <SessionView
                        userPromise={userPromise}
                        sessionsPromise={sessionsPromise}
                    />
                </Suspense>
            </ErrorBoundary>
        </div>
    )
}
```

### 3.2 Session View Component

**File**: `packages/dashboard/src/app/dashboard/users/[identifier]/session-view.tsx`

```typescript
'use client'

interface SessionViewProps {
    userPromise: Promise<any>
    sessionsPromise: Promise<any[]>
}

export function SessionView({ userPromise, sessionsPromise }: SessionViewProps) {
    const user = use(userPromise)
    const sessions = use(sessionsPromise)
    
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const [selectedItemType, setSelectedItemType] = useState<'tool_call' | 'support_ticket' | null>(null)

    return (
        <div className="flex flex-1 overflow-hidden">
            {/* Sessions Pane */}
            <div className="w-1/3 border-r bg-muted/10 overflow-y-auto">
                <SessionsPane
                    sessions={sessions}
                    selectedSessionId={selectedSessionId}
                    onSessionSelect={setSelectedSessionId}
                />
            </div>

            {/* Session Detail Pane */}
            <div className="w-2/5 border-r overflow-y-auto">
                {selectedSessionId ? (
                    <SessionDetailPane
                        sessionId={selectedSessionId}
                        selectedItemId={selectedItemId}
                        selectedItemType={selectedItemType}
                        onItemSelect={(id, type) => {
                            setSelectedItemId(id)
                            setSelectedItemType(type)
                        }}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        Select a session to view details
                    </div>
                )}
            </div>

            {/* Detail Pane */}
            <div className="w-1/3 overflow-y-auto">
                {selectedItemId && selectedItemType ? (
                    <DetailPane
                        itemId={selectedItemId}
                        itemType={selectedItemType}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        Select an item to view details
                    </div>
                )}
            </div>
        </div>
    )
}
```

### 3.3 Sessions Pane Component

```typescript
interface SessionsPaneProps {
    sessions: any[]
    selectedSessionId: string | null
    onSessionSelect: (sessionId: string) => void
}

export function SessionsPane({ sessions, selectedSessionId, onSessionSelect }: SessionsPaneProps) {
    return (
        <div className="p-4">
            <h3 className="font-semibold mb-4">Sessions ({sessions.length})</h3>
            <div className="space-y-2">
                {sessions.map((session) => (
                    <Card
                        key={session.sessionId}
                        className={cn(
                            "cursor-pointer transition-colors hover:bg-muted/50",
                            selectedSessionId === session.sessionId && "ring-2 ring-primary"
                        )}
                        onClick={() => onSessionSelect(session.sessionId)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-sm">
                                    {session.title || session.serverName}
                                </h4>
                                <Badge variant="outline" className="text-xs">
                                    {formatRelativeTime(session.connectionTimestamp)}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                    <WrenchIcon className="h-3 w-3" />
                                    {session.toolCallCount}
                                </span>
                                <span className="flex items-center gap-1">
                                    <TicketIcon className="h-3 w-3" />
                                    {session.supportTicketCount}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                                {session.serverName}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
```

### 3.4 Session Detail Pane Component

```typescript
interface SessionDetailPaneProps {
    sessionId: string
    selectedItemId: string | null
    selectedItemType: 'tool_call' | 'support_ticket' | null
    onItemSelect: (id: string, type: 'tool_call' | 'support_ticket') => void
}

export function SessionDetailPane({ 
    sessionId, 
    selectedItemId, 
    selectedItemType, 
    onItemSelect 
}: SessionDetailPaneProps) {
    const toolCallsPromise = useMemo(() => getSessionToolCalls(sessionId), [sessionId])
    const supportTicketsPromise = useMemo(() => getSessionSupportTickets(sessionId), [sessionId])

    return (
        <div className="p-4">
            <Suspense fallback={<div>Loading session details...</div>}>
                <SessionDetailContent
                    toolCallsPromise={toolCallsPromise}
                    supportTicketsPromise={supportTicketsPromise}
                    selectedItemId={selectedItemId}
                    selectedItemType={selectedItemType}
                    onItemSelect={onItemSelect}
                />
            </Suspense>
        </div>
    )
}

function SessionDetailContent({ 
    toolCallsPromise, 
    supportTicketsPromise, 
    selectedItemId, 
    selectedItemType, 
    onItemSelect 
}: {
    toolCallsPromise: Promise<any[]>
    supportTicketsPromise: Promise<any[]>
    selectedItemId: string | null
    selectedItemType: 'tool_call' | 'support_ticket' | null
    onItemSelect: (id: string, type: 'tool_call' | 'support_ticket') => void
}) {
    const toolCalls = use(toolCallsPromise)
    const supportTickets = use(supportTicketsPromise)

    return (
        <div className="space-y-6">
            {/* Tool Calls Section */}
            <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <WrenchIcon className="h-4 w-4" />
                    Tool Calls ({toolCalls.length})
                </h4>
                <div className="space-y-2">
                    {toolCalls.map((toolCall) => (
                        <Card
                            key={toolCall.id}
                            className={cn(
                                "cursor-pointer transition-colors hover:bg-muted/50",
                                selectedItemId === toolCall.id && selectedItemType === 'tool_call' && 
                                "ring-2 ring-primary"
                            )}
                            onClick={() => onItemSelect(toolCall.id, 'tool_call')}
                        >
                            <CardContent className="p-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{toolCall.toolName}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatRelativeTime(toolCall.createdAt)}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Support Tickets Section */}
            <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TicketIcon className="h-4 w-4" />
                    Support Tickets ({supportTickets.length})
                </h4>
                <div className="space-y-2">
                    {supportTickets.map((ticket) => (
                        <Card
                            key={ticket.id}
                            className={cn(
                                "cursor-pointer transition-colors hover:bg-muted/50",
                                selectedItemId === ticket.id && selectedItemType === 'support_ticket' && 
                                "ring-2 ring-primary"
                            )}
                            onClick={() => onItemSelect(ticket.id, 'support_ticket')}
                        >
                            <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-sm">{ticket.title}</span>
                                    <Badge variant={ticket.status === 'resolved' ? 'default' : 'secondary'}>
                                        {ticket.status}
                                    </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {formatRelativeTime(ticket.createdAt)}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}
```

### 3.5 Detail Pane Component

```typescript
interface DetailPaneProps {
    itemId: string
    itemType: 'tool_call' | 'support_ticket'
}

export function DetailPane({ itemId, itemType }: DetailPaneProps) {
    if (itemType === 'tool_call') {
        return <ToolCallDetail toolCallId={itemId} />
    } else {
        return <SupportTicketDetail ticketId={itemId} />
    }
}

function ToolCallDetail({ toolCallId }: { toolCallId: string }) {
    const toolCallPromise = useMemo(() => getToolCallDetail(toolCallId), [toolCallId])

    return (
        <div className="p-4">
            <Suspense fallback={<div>Loading tool call details...</div>}>
                <ToolCallDetailContent toolCallPromise={toolCallPromise} />
            </Suspense>
        </div>
    )
}

function ToolCallDetailContent({ toolCallPromise }: { toolCallPromise: Promise<any> }) {
    const toolCall = use(toolCallPromise)

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold mb-2">{toolCall.toolName}</h3>
                <p className="text-sm text-muted-foreground">
                    {formatDate(toolCall.createdAt)}
                </p>
            </div>

            <div>
                <h4 className="font-medium mb-2">Input</h4>
                <Card>
                    <CardContent className="p-3">
                        <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(toolCall.input, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            </div>

            <div>
                <h4 className="font-medium mb-2">Output</h4>
                <Card>
                    <CardContent className="p-3">
                        <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(toolCall.output, null, 2)}
                        </pre>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

function SupportTicketDetail({ ticketId }: { ticketId: string }) {
    const ticketPromise = useMemo(() => getSupportTicketDetail(ticketId), [ticketId])

    return (
        <div className="p-4">
            <Suspense fallback={<div>Loading support ticket details...</div>}>
                <SupportTicketDetailContent ticketPromise={ticketPromise} />
            </Suspense>
        </div>
    )
}

function SupportTicketDetailContent({ ticketPromise }: { ticketPromise: Promise<any> }) {
    const ticket = use(ticketPromise)

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-semibold mb-2">{ticket.title}</h3>
                <div className="flex items-center gap-2 mb-2">
                    <Badge variant={ticket.status === 'resolved' ? 'default' : 'secondary'}>
                        {ticket.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                        {formatDate(ticket.createdAt)}
                    </p>
                </div>
            </div>

            {ticket.conciseSummary && (
                <div>
                    <h4 className="font-medium mb-2">Summary</h4>
                    <Card>
                        <CardContent className="p-3">
                            <p className="text-sm">{ticket.conciseSummary}</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {ticket.context && (
                <div>
                    <h4 className="font-medium mb-2">Context</h4>
                    <Card>
                        <CardContent className="p-3">
                            <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                {ticket.context}
                            </pre>
                        </CardContent>
                    </Card>
                </div>
            )}

            {ticket.resolvedAt && (
                <div>
                    <h4 className="font-medium mb-2">Resolved</h4>
                    <p className="text-sm text-muted-foreground">
                        {formatDate(ticket.resolvedAt)}
                    </p>
                </div>
            )}
        </div>
    )
}
```

## 4. Implementation Steps

### Phase 1: Data Layer Implementation ⏳
1. **Create data fetching functions with Drizzle ORM aggregations**
   - Implement `getUserSessions()` with count subqueries
   - Add `getSessionToolCalls()` and `getSessionSupportTickets()`
   - Create detail fetching functions for tool calls and support tickets
2. **Test data layer with existing data**
   - Verify aggregated counts match actual data
   - Test performance of complex queries

### Phase 2: UI Components Implementation ⏳
1. **Create new component files**
   - `session-view.tsx` - Main three-pane layout
   - `sessions-pane.tsx` - Left pane with session list
   - `session-detail-pane.tsx` - Middle pane with tool calls/tickets
   - `detail-pane.tsx` - Right pane with item details
2. **Implement three-pane layout with responsive design**
3. **Add state management for selection tracking**

### Phase 3: Integration & Testing ⏳
1. **Update main user detail page component**
2. **Test with real data and various screen sizes**
3. **Add error boundaries and loading states**
4. **Performance optimization and accessibility**

### Phase 4: Polish & Deployment ⏳
1. **Add advanced features (search, filtering)**
2. **Improve keyboard navigation**
3. **Add export functionality**
4. **Deploy and monitor performance**

## 5. Technical Considerations

### 5.1 Performance
- **Drizzle ORM Optimization**: Use efficient joins and subqueries for aggregations
- **Pagination**: Implement for large session lists
- **Virtual scrolling**: For sessions with many tool calls
- **Query optimization**: Ensure proper indexing on session and user relationships

### 5.2 Data Consistency
- **Fresh data approach**: Always query live data instead of stored counts
- **Aggregation queries**: Use Drizzle's `count()` and `coalesce()` for reliable metrics
- **Null handling**: Properly handle sessions without associated tool calls or tickets

### 5.3 User Experience
- **Keyboard shortcuts**: Navigate between panes
- **Search/filter**: Find specific sessions or tool calls
- **Export functionality**: Download session data
- **Real-time updates**: Consider WebSocket for live data

### 5.4 Error Handling
- **Graceful degradation**: Handle missing data and null session titles
- **Error boundaries**: Prevent crashes in each pane
- **Loading states**: Proper suspense boundaries for async data
- **User feedback**: Clear error messages

## 6. Future Enhancements

### 6.1 Advanced Features
- **Session search and filtering**
- **Session title editing** (utilize the existing `title` field)
- **Bulk operations on sessions**
- **Session comparison view**
- **Export to various formats (JSON, CSV)**

### 6.2 Analytics Integration
- **Session duration tracking** (calculate from connection timestamp and last activity)
- **Tool usage patterns**
- **Error rate monitoring**
- **Performance metrics dashboard**

### 6.3 Data Optimization
- **Implement session activity tracking** (update last activity on tool calls/tickets)
- **Add session metadata** (user agent, connection source, etc.)
- **Optimize query performance** with materialized views if needed

This implementation plan provides a comprehensive roadmap for building a modern, scalable session-based user interface that leverages the existing database schema and focuses on efficient data fetching through Drizzle ORM aggregations.