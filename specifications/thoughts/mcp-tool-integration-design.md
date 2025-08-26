---
date: 2025-08-03T13:05:00-07:00
researcher: Claude
git_commit: dee9229505e7a7358d4b2b4f3280e328f497c50e
branch: master
repository: mcplatform
topic: "Documentation Retrieval MCP Tool Integration Design"
tags: [thoughts, mcp-tools, documentation-retrieval, search, tool-design]
status: draft
last_updated: 2025-08-03
last_updated_by: Claude
type: thoughts
---

# Documentation Retrieval MCP Tool Integration - Design Thoughts

## Overview

The documentation retrieval backend is fully implemented with comprehensive search capabilities, but there are no MCP tools to expose this functionality to end-users through their AI coding assistants. This document outlines the design for MCP tool integration to make documentation searchable within coding environments.

## Current State Analysis

### What Exists
- Complete search infrastructure (vector, BM25, hybrid)
- Multi-tenant namespace isolation via Turbopuffer
- Organization-scoped database schema
- Existing MCP tool patterns in codebase
- Session tracking and analytics infrastructure

### What's Missing
- MCP server-namespace association table
- Documentation search MCP tools
- Tool registration with proper schemas
- Analytics integration for search queries
- Contextual search based on walkthrough state

## MCP Tool Design

### 1. Core Search Tool: `search_documentation`

#### Tool Schema
```typescript
const searchDocumentationSchema = z.object({
    query: z.string().describe("Search query for documentation"),
    namespace: z.string().optional().describe("Specific namespace to search in (optional if only one namespace)"),
    search_type: z.enum(["vector", "bm25", "hybrid"]).default("hybrid").describe("Search algorithm to use"),
    max_results: z.number().min(1).max(20).default(10).describe("Maximum number of results to return"),
    include_content: z.boolean().default(true).describe("Whether to include full content or just summaries")
})
```

#### Tool Implementation Logic
```typescript
export const searchDocumentation = base
    .input(searchDocumentationSchema)
    .handler(async ({ input, context }) => {
        const { mcpServerUserId, serverSessionId, serverConfig } = context
        
        // Get accessible namespaces for this MCP server
        const namespaces = await getServerNamespaces(serverConfig.id)
        
        if (namespaces.length === 0) {
            throw new OrpcError('NO_NAMESPACES_CONFIGURED', 'No documentation namespaces configured for this server')
        }
        
        // Determine target namespace
        const targetNamespace = input.namespace || 
            (namespaces.length === 1 ? namespaces[0].id : null)
            
        if (!targetNamespace) {
            throw new OrpcError('NAMESPACE_REQUIRED', `Multiple namespaces available: ${namespaces.map(n => n.name).join(', ')}`)
        }
        
        // Get current walkthrough context for enhanced search
        const walkthroughContext = await getCurrentWalkthroughContext(serverSessionId)
        
        // Perform search with context
        const results = await searchTurboPuffer({
            organizationId: serverConfig.organizationId,
            namespaceId: targetNamespace,
            query: {
                textQuery: input.query,
                searchType: input.search_type,
                walkthroughContext
            },
            topK: input.max_results
        })
        
        // Track search query for analytics
        await trackSearchQuery({
            mcpServerUserId,
            serverSessionId,
            namespaceId: targetNamespace,
            query: input.query,
            searchType: input.search_type,
            resultCount: results.length,
            walkthroughContext
        })
        
        // Format results for AI agent
        return formatSearchResults(results, input.include_content)
    })
```

### 2. Namespace Listing Tool: `list_documentation_sources`

#### Tool Schema
```typescript
const listDocumentationSourcesSchema = z.object({
    include_stats: z.boolean().default(false).describe("Include document counts and last update info")
})
```

#### Purpose
- Let AI agents know what documentation is available
- Provide context for namespace-specific searches
- Display statistics to help users understand coverage

#### Sample Output
```typescript
{
    namespaces: [
        {
            name: "api-reference",
            description: "Complete API documentation and guides",
            document_count: 45,
            last_updated: "2025-08-03T10:30:00Z"
        },
        {
            name: "tutorials", 
            description: "Step-by-step tutorials and examples",
            document_count: 23,
            last_updated: "2025-08-03T09:15:00Z"
        }
    ]
}
```

### 3. Contextual Search Tool: `search_documentation_contextual`

#### Tool Schema
```typescript
const searchDocumentationContextualSchema = z.object({
    query: z.string().describe("Search query for documentation"),
    context: z.object({
        current_file: z.string().optional(),
        current_function: z.string().optional(),
        error_message: z.string().optional(),
        task_description: z.string().optional()
    }).optional().describe("Additional context to improve search relevance"),
    namespace: z.string().optional(),
    max_results: z.number().min(1).max(20).default(5)
})
```

#### Enhanced Context Logic
```typescript
// Combine user query with contextual information
const enhancedQuery = buildContextualQuery({
    userQuery: input.query,
    currentFile: input.context?.current_file,
    walkthroughStep: walkthroughContext?.currentStep,
    errorMessage: input.context?.error_message
})

// Boost results based on context
const results = await searchWithContextualBoosting({
    query: enhancedQuery,
    namespace: targetNamespace,
    contextBoosts: {
        walkthrough_relevance: 1.2,
        current_technology: 1.1,
        error_category: 1.3
    }
})
```

## Database Schema Requirements

### 1. MCP Server-Namespace Association Table

```sql
CREATE TABLE mcp_server_documentation_namespaces (
    id TEXT PRIMARY KEY DEFAULT ('msdn_' || nanoid(8)),
    mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    namespace_id TEXT NOT NULL REFERENCES retrieval_namespace(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    created_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000,
    
    UNIQUE(mcp_server_id, namespace_id),
    
    -- Ensure cross-references stay within same organization
    CONSTRAINT same_org_server CHECK (
        organization_id IN (
            SELECT organization_id FROM mcp_servers WHERE id = mcp_server_id
        )
    ),
    CONSTRAINT same_org_namespace CHECK (
        organization_id IN (
            SELECT organization_id FROM retrieval_namespace WHERE id = namespace_id
        )
    )
);

CREATE INDEX mcp_server_documentation_namespaces_server_idx 
    ON mcp_server_documentation_namespaces(mcp_server_id);
CREATE INDEX mcp_server_documentation_namespaces_namespace_idx 
    ON mcp_server_documentation_namespaces(namespace_id);
```

### 2. Search Query Analytics Table

```sql
CREATE TABLE documentation_search_queries (
    id TEXT PRIMARY KEY DEFAULT ('dsq_' || nanoid(12)),
    mcp_server_id TEXT NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    mcp_server_user_id TEXT REFERENCES mcp_server_users(id),
    mcp_server_session_id TEXT REFERENCES mcp_server_sessions(id),
    namespace_id TEXT NOT NULL REFERENCES retrieval_namespace(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    
    query_text TEXT NOT NULL,
    search_type TEXT NOT NULL CHECK (search_type IN ('vector', 'bm25', 'hybrid')),
    result_count INTEGER NOT NULL DEFAULT 0,
    
    -- Walkthrough context
    walkthrough_id TEXT REFERENCES walkthroughs(id),
    walkthrough_step_id TEXT,
    
    -- Query performance
    response_time_ms INTEGER,
    
    -- For query clustering analysis
    query_embedding VECTOR(1536),
    
    created_at BIGINT NOT NULL DEFAULT extract(epoch from now()) * 1000
);

CREATE INDEX documentation_search_queries_namespace_idx 
    ON documentation_search_queries(namespace_id, created_at);
CREATE INDEX documentation_search_queries_walkthrough_idx 
    ON documentation_search_queries(walkthrough_id, walkthrough_step_id);
CREATE INDEX documentation_search_queries_session_idx 
    ON documentation_search_queries(mcp_server_session_id);
```

## Tool Registration Architecture

### 1. Dynamic Tool Registration Pattern

```typescript
// In packages/dashboard/src/lib/mcp/index.ts
export async function getMcpServerConfiguration(hostHeader: string) {
    const serverConfig = await getServerBySlug(slug)
    if (!serverConfig) return null
    
    // Get available namespaces for this server
    const namespaces = await getServerNamespaces(serverConfig.id)
    
    const tools: Record<string, ToolDefinition> = {
        // Always available tools
        list_walkthroughs: walkthrough.listWalkthroughs,
        start_walkthrough: walkthrough.startWalkthrough,
        get_next_step: walkthrough.getNextStep
    }
    
    // Add documentation tools if namespaces are configured
    if (namespaces.length > 0) {
        tools.search_documentation = documentation.searchDocumentation
        tools.list_documentation_sources = documentation.listDocumentationSources
        
        // Add contextual search for advanced configurations
        if (serverConfig.features?.contextual_search) {
            tools.search_documentation_contextual = documentation.searchDocumentationContextual
        }
    }
    
    return {
        serverConfig,
        tools,
        resources: []
    }
}
```

### 2. Schema Registration Fix

**Critical Bug Found**: Current MCP tools register with empty schemas causing "random_string" parameter errors.

```typescript
// WRONG (current implementation)
export const searchDocumentation = base
    .input(searchDocumentationSchema)
    .handler(async ({ input }) => { /* ... */ })
    .toolable({
        name: 'search_documentation',
        description: 'Search documentation',
        inputSchema: z.object({}).shape  // ❌ This creates empty schema!
    })

// CORRECT (required fix)
export const searchDocumentation = base
    .input(searchDocumentationSchema)
    .handler(async ({ input }) => { /* ... */ })
    .toolable({
        name: 'search_documentation',
        description: 'Search documentation for relevant information',
        inputSchema: searchDocumentationSchema.shape  // ✅ Use actual schema
    })
```

## Search Result Formatting

### 1. Standard Format for AI Agents

```typescript
function formatSearchResults(results: SearchResult[], includeContent: boolean) {
    return {
        query_processed: true,
        result_count: results.length,
        sources: results.map(result => ({
            document: result.document_path,
            relevance_score: result.score,
            title: extractTitleFromPath(result.document_path),
            summary: includeContent ? 
                truncateContent(result.contextualized_content, 200) :
                generateSummary(result.content),
            content: includeContent ? result.content : undefined,
            url: generateDocumentUrl(result.document_path),
            chunk_index: extractChunkIndex(result.id)
        }))
    }
}
```

### 2. Context-Aware Result Enhancement

```typescript
function enhanceResultsWithContext(results: SearchResult[], context: WalkthroughContext) {
    return results.map(result => ({
        ...result,
        walkthrough_relevance: calculateWalkthroughRelevance(result, context),
        suggested_follow_up: generateFollowUpQuestions(result, context),
        related_walkthrough_steps: findRelatedSteps(result, context)
    }))
}
```

## Integration with Existing Systems

### 1. Analytics Correlation

```typescript
async function trackSearchQuery(params: {
    mcpServerUserId: string,
    serverSessionId: string,
    namespaceId: string,
    query: string,
    searchType: string,
    resultCount: number,
    walkthroughContext?: WalkthroughContext
}) {
    // Track in both existing and new analytics
    await Promise.all([
        // Existing tool call tracking
        trackToolCall({
            mcpServerUserId: params.mcpServerUserId,
            serverSessionId: params.serverSessionId,
            toolName: 'search_documentation',
            inputData: { query: params.query, search_type: params.searchType },
            outputData: { result_count: params.resultCount }
        }),
        
        // New documentation search analytics
        db.insert(schema.documentationSearchQueries).values({
            mcpServerUserId: params.mcpServerUserId,
            mcpServerSessionId: params.serverSessionId,
            namespaceId: params.namespaceId,
            queryText: params.query,
            searchType: params.searchType,
            resultCount: params.resultCount,
            walkthroughId: params.walkthroughContext?.walkthroughId,
            walkthroughStepId: params.walkthroughContext?.currentStepId
        })
    ])
}
```

### 2. Walkthrough Context Integration

```typescript
async function getCurrentWalkthroughContext(sessionId: string): Promise<WalkthroughContext | null> {
    const session = await db.query.mcpServerSessions.findFirst({
        where: eq(schema.mcpServerSessions.id, sessionId),
        with: {
            currentWalkthrough: {
                with: {
                    steps: true
                }
            }
        }
    })
    
    if (!session?.currentWalkthrough) return null
    
    return {
        walkthroughId: session.currentWalkthrough.id,
        currentStepId: session.progressData?.currentStep,
        completedSteps: session.progressData?.completedSteps || [],
        currentStepContent: getCurrentStepData(session),
        technology: session.currentWalkthrough.metadata?.technology
    }
}
```

## Testing Strategy

### 1. Unit Tests for Tools
```typescript
// Test search tool with mocked dependencies
describe('searchDocumentation tool', () => {
    it('should search single namespace without namespace parameter', async () => {
        mockGetServerNamespaces.mockResolvedValue([{ id: 'ns1', name: 'docs' }])
        mockSearchTurboPuffer.mockResolvedValue([{ content: 'test result' }])
        
        const result = await searchDocumentation.handler({
            input: { query: 'test query' },
            context: mockContext
        })
        
        expect(result.sources).toHaveLength(1)
        expect(mockSearchTurboPuffer).toHaveBeenCalledWith({
            organizationId: 'org1',
            namespaceId: 'ns1',
            query: expect.objectContaining({ textQuery: 'test query' })
        })
    })
})
```

### 2. Integration Tests
```typescript
// Test full MCP tool integration
describe('MCP Documentation Tools Integration', () => {
    it('should register tools only when namespaces exist', async () => {
        // Test with no namespaces
        const configEmpty = await getMcpServerConfiguration('empty.test.com')
        expect(configEmpty.tools).not.toHaveProperty('search_documentation')
        
        // Test with namespaces
        await createTestNamespace('test-docs')
        const configWithDocs = await getMcpServerConfiguration('docs.test.com')
        expect(configWithDocs.tools).toHaveProperty('search_documentation')
    })
})
```

## Performance Considerations

### 1. Search Optimization
- Cache frequently searched queries
- Implement query suggestion/autocomplete
- Batch multiple searches when possible
- Use connection pooling for Turbopuffer

### 2. Analytics Efficiency
- Async tracking to avoid blocking search responses
- Batch analytics writes
- Use database indexes for common query patterns
- Consider analytics data retention policies

## Security Considerations

### 1. Access Control
- Validate namespace access per MCP server
- Ensure organization isolation
- Rate limit search queries per session
- Audit sensitive search queries

### 2. Data Privacy
- Hash or encrypt sensitive query content
- Respect user opt-out preferences
- Comply with data retention policies
- Anonymize analytics data when possible

## Open Questions

1. **Tool Naming**: Should tools be prefixed? (`docs_search` vs `search_documentation`)
2. **Result Limits**: What are reasonable min/max result limits?
3. **Caching Strategy**: Should we cache search results at the MCP level?
4. **Error Handling**: How detailed should error messages be for end-users?
5. **Versioning**: How do we handle backward compatibility for tool schema changes?

## Next Steps

1. Implement database schema additions
2. Create MCP tool implementations following existing patterns
3. Fix schema registration bug across all tools
4. Add server action for namespace-server associations
5. Implement analytics tracking
6. Create comprehensive test suite
7. Update MCP server configuration UI to include namespace selection

This design will bridge the gap between the robust documentation retrieval backend and end-user accessibility through AI coding assistants.