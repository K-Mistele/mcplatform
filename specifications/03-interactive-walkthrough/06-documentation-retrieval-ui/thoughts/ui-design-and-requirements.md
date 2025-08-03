---
date: 2025-08-03T12:55:00-07:00
researcher: Claude
git_commit: dee9229505e7a7358d4b2b4f3280e328f497c50e
branch: master
repository: mcplatform
topic: "Documentation Retrieval UI Design and Requirements"
tags: [thoughts, ui-design, documentation-retrieval, dashboard, namespace-management]
status: draft
last_updated: 2025-08-03
last_updated_by: Claude
type: thoughts
---

# Documentation Retrieval UI - Design Thoughts and Requirements

## Overview

The documentation retrieval feature has a fully implemented backend but lacks any dashboard UI for customers to manage their documentation namespaces, monitor ingestion jobs, and configure MCP servers. This document outlines design thoughts and requirements for the user interface components.

## Current State Analysis

### What Exists
- Complete backend infrastructure with Inngest pipeline
- Database schema with 5 retrieval tables
- Comprehensive test coverage
- Vector search with Turbopuffer
- S3 document storage with Redis caching

### What's Missing
- Dashboard pages for namespace management
- Forms for creating/editing namespaces
- Ingestion job monitoring interface
- Document browsing and search UI
- Error handling and alerts display
- MCP server-namespace assignment UI

## UI Design Thoughts

### 1. Navigation Integration
**Location**: Add "Documentation" section to dashboard sidebar
- Should follow existing pattern of MCP Servers, Walkthroughs, etc.
- Icon: Document or book icon to differentiate from other sections
- Expand to show sub-sections: Namespaces, Ingestion Jobs, Search Testing

### 2. Namespace Management Page (`/dashboard/namespaces`)

#### Main List View
```
Documentation Namespaces
[+ Create Namespace]                                    [Search: ___]

┌─────────────────────────────────────────────────────────────────┐
│ Name              │ Documents │ Status    │ Last Updated │ Actions │
├─────────────────────────────────────────────────────────────────┤
│ api-docs         │ 45        │ Active    │ 2 hours ago  │ Edit Delete │
│ tutorials        │ 23        │ Ingesting │ 5 min ago    │ Edit Delete │
│ troubleshooting  │ 12        │ Error     │ 1 day ago    │ Edit Delete │
└─────────────────────────────────────────────────────────────────┘
```

#### Features
- **Status Indicators**: Active (green), Ingesting (yellow/spinner), Error (red), Disabled (gray)
- **Document Count**: Live count from database
- **Last Updated**: From most recent ingestion job
- **Bulk Actions**: Select multiple namespaces for batch operations
- **Filtering**: By status, creation date, document count ranges

### 3. Create/Edit Namespace Modal

#### Basic Information Tab
```
Create Documentation Namespace
┌─────────────────────────────────────────────────────┐
│ Namespace Name* [api-documentation_____________]     │
│ Description     [API reference and guides_____]     │
│                                                     │
│ Embedding Configuration                             │
│ Provider*       [Google Gemini ▼]                  │
│ Model*          [text-embedding-3-small ▼]         │
│ Dimensions      [1536] (auto)                       │
└─────────────────────────────────────────────────────┘
```

#### Source Configuration Tab
```
Document Sources
┌─────────────────────────────────────────────────────┐
│ GitHub Repository*                                   │
│ Repository URL  [https://github.com/org/repo___]    │
│ Branch         [main ▼]                             │
│ Path Filter    [docs/**/*.md_______________]        │
│                                                     │
│ File Types                                          │
│ ☑ Markdown (.md, .mdx)                             │
│ ☐ Images (.png, .jpg, .gif)                        │
│ ☐ PDFs (.pdf) - Coming Soon                        │
└─────────────────────────────────────────────────────┘
```

#### Advanced Settings Tab
```
Advanced Configuration
┌─────────────────────────────────────────────────────┐
│ Chunking Strategy                                   │
│ Chunk Size      [4096] characters                   │
│ Overlap         [200] characters                    │
│                                                     │
│ Processing Options                                  │
│ ☑ AI Contextualization (Recommended)               │
│ ☑ Automatic re-ingestion on changes                │
│ ☐ Include frontmatter in search                    │
└─────────────────────────────────────────────────────┘
```

### 4. Namespace Detail Page (`/dashboard/namespaces/[id]`)

#### Overview Section
```
API Documentation Namespace
Status: Active │ 45 Documents │ 1,234 Chunks │ Last Updated: 2 hours ago

[Trigger Re-ingestion] [View Search Testing] [Configure MCP Servers]

Recent Activity
┌─────────────────────────────────────────────────────┐
│ ✓ Ingested api-reference.md (12 chunks)  2 hrs ago │
│ ✓ Ingested getting-started.md (8 chunks) 2 hrs ago │
│ ⚠ Failed to process image.png - Format   3 hrs ago │
│ ✓ Completed batch ingestion job          3 hrs ago │
└─────────────────────────────────────────────────────┘
```

#### Documents Tab
```
Documents (45)                           [Search: ___] [Filter: All ▼]

┌─────────────────────────────────────────────────────────────────┐
│ File Path                    │ Chunks │ Status │ Last Processed   │
├─────────────────────────────────────────────────────────────────┤
│ /api/authentication.md       │ 15     │ ✓      │ 2 hours ago     │
│ /api/webhooks.md            │ 12     │ ✓      │ 2 hours ago     │
│ /guides/quick-start.md      │ 8      │ ⚠      │ 1 day ago       │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Ingestion Jobs Page (`/dashboard/ingestion-jobs`)

#### Job List
```
Ingestion Jobs                                        [Refresh]

┌─────────────────────────────────────────────────────────────────┐
│ Job ID      │ Namespace      │ Status    │ Progress │ Started    │
├─────────────────────────────────────────────────────────────────┤
│ ij_abc123   │ api-docs      │ Running   │ 15/45    │ 5 min ago  │
│ ij_def456   │ tutorials     │ Complete  │ 23/23    │ 1 hour ago │
│ ij_ghi789   │ troubleshoot  │ Failed    │ 3/12     │ 1 day ago  │
└─────────────────────────────────────────────────────────────────┘
```

#### Job Detail View
```
Ingestion Job: ij_abc123
Namespace: API Documentation │ Status: Running │ Progress: 15/45 documents

Timeline
┌─────────────────────────────────────────────────────┐
│ ✓ Started ingestion job                  5 min ago  │
│ ✓ Processed /api/auth.md (12 chunks)     4 min ago  │
│ ✓ Processed /api/users.md (8 chunks)     3 min ago  │
│ 🔄 Processing /api/webhooks.md...         now       │
└─────────────────────────────────────────────────────┘

Failed Documents (0)
Warnings (1)
┌─────────────────────────────────────────────────────┐
│ ⚠ Large file detected: /guides/comprehensive.md    │
│   Consider splitting into smaller sections          │
└─────────────────────────────────────────────────────┘
```

### 6. Search Testing Interface (`/dashboard/namespaces/[id]/test`)

#### Search Testing Panel
```
Test Documentation Search
Namespace: api-docs

Query: [How do I authenticate API requests?_____________] [Search]

Search Type: ○ Vector ○ BM25 ● Hybrid    Results: [10 ▼]

Results (3 found)
┌─────────────────────────────────────────────────────┐
│ 📄 /api/authentication.md                  Score: 0.95 │
│ "To authenticate API requests, include the API key     │
│  in the Authorization header as a Bearer token..."     │
│                                                        │
│ 📄 /guides/quick-start.md                  Score: 0.82 │
│ "First, you'll need to generate an API key from       │
│  your dashboard settings..."                           │
└─────────────────────────────────────────────────────┘
```

### 7. MCP Server Assignment

#### In MCP Server Edit Modal (Enhancement)
```
Configure MCP Server
┌─────────────────────────────────────────────────────┐
│ Basic Settings │ Tools │ Documentation │ Analytics    │
└─────────────────────────────────────────────────────┘

Documentation Access
┌─────────────────────────────────────────────────────┐
│ Available Namespaces                                │
│ ☑ api-docs        45 documents                      │
│ ☑ tutorials       23 documents                      │
│ ☐ internal-wiki   12 documents                      │
│                                                     │
│ Search Configuration                                │
│ Default Results  [10 ▼]                            │
│ Max Results      [50 ▼]                            │
│ ☑ Enable hybrid search (recommended)               │
└─────────────────────────────────────────────────────┘
```

## Technical Implementation Considerations

### 1. State Management Patterns
Follow existing MCPlatform patterns:
- Async server components for data fetching
- Client components with `use()` hook for promises
- oRPC server actions for mutations
- Optimistic updates for better UX

### 2. Real-time Updates
For ingestion job monitoring:
- Server-sent events (SSE) for real-time progress
- Polling fallback for broader browser support
- WebSocket consideration for high-frequency updates

### 3. Data Loading Strategies
```typescript
// Page component pattern
export default async function NamespacesPage() {
    const namespacesPromise = getNamespaces()
    const jobsPromise = getActiveIngestionJobs()
    
    return (
        <Suspense fallback={<NamespacesSkeleton />}>
            <ErrorBoundary>
                <NamespacesClient 
                    namespacesPromise={namespacesPromise}
                    jobsPromise={jobsPromise}
                />
            </ErrorBoundary>
        </Suspense>
    )
}
```

### 4. Form Validation
- Zod schemas for client and server validation
- Real-time GitHub repository validation
- Path filter syntax validation
- Embedding model compatibility checks

### 5. Error Handling UI Patterns
```typescript
// Error display component
<ErrorAlert>
    <AlertTitle>Ingestion Failed</AlertTitle>
    <AlertDescription>
        Failed to process 3 out of 45 documents.
        <Link href="/ingestion-jobs/ij_123">View details</Link>
    </AlertDescription>
</ErrorAlert>
```

## Performance Considerations

### 1. Large Document Lists
- Virtual scrolling for 1000+ documents
- Server-side pagination with search
- Lazy loading of document content
- Efficient filtering and sorting

### 2. Real-time Monitoring
- Debounced search queries
- Efficient polling intervals
- Connection management for SSE
- Graceful degradation on connection loss

### 3. Mobile Responsiveness
- Collapsible sidebar on mobile
- Touch-friendly controls
- Responsive tables → cards transformation
- Optimized for tablet usage

## Security Considerations

### 1. Access Control
- Organization-scoped data access
- Role-based permissions for namespace management
- Audit logging for sensitive operations
- API rate limiting for search testing

### 2. Data Validation
- Server-side validation for all forms
- CSRF protection on state changes
- Input sanitization for search queries
- File upload security checks

## Open Questions

1. **GitHub Integration**: Should we support GitHub App installation for better permissions?
2. **Batch Operations**: What bulk operations are most valuable for namespaces?
3. **Search Analytics**: Should the testing interface collect usage data?
4. **Export Features**: Do customers need to export their processed documents?
5. **Collaboration**: Should multiple team members be able to manage namespaces?

## Next Steps

1. Create detailed wireframes for each page
2. Define server action interfaces for namespace CRUD
3. Plan database queries for efficient data loading
4. Design component hierarchy and reusable patterns
5. Consider integration points with existing dashboard

This UI will provide customers with complete control over their documentation retrieval system while maintaining the high-quality user experience expected from MCPlatform.