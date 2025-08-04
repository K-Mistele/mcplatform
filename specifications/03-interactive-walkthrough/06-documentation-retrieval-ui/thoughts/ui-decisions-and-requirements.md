---
date: 2025-08-04T00:00:00-00:00
researcher: Kyle
git_commit: dee9229505e7a7358d4b2b4f3280e328f497c50e
branch: master
repository: mcplatform
topic: "Documentation Retrieval UI - Finalized Design Decisions"
tags: [thoughts, ui-decisions, documentation-retrieval, requirements, feature-scoping]
status: complete
last_updated: 2025-08-04
last_updated_by: Kyle
type: thoughts
---

# Documentation Retrieval UI - Finalized Design Decisions

## Feature Scope Decision
**Multiple Sub-Features Approach**: Break into separate sub-features for:
- Namespace management (CRUD operations)
- Job monitoring (real-time ingestion tracking)  
- Search testing (query interface with metadata filters)
- Document list views (browsable document contents)

## Core UI Design Decisions

### Namespace Creation/Editing
- **Provider/Model/Dimensions**: NOT user configurable (display as disabled controls)
  - Rationale: Turbopuffer namespace must be opinionated about vector dimensionality
- **Advanced Settings**: Remove all toggles - frontmatter, auto-reingest, AI contextualization are always enabled
  - These are fundamental to the retrieval strategy, not user choices

### Document Ingestion Strategy
**Two Primary Approaches**:
1. **Drag & Drop**: Investigate web API support for folder drag/drop
2. **GitHub Action Integration** (Preferred):
   - Provide GitHub Action that customers configure with credentials
   - Points at directory, automatically triggers document ingestion
   - Requires new Next.js API route for file upload
   - Two implementation options:
     - Direct upload to S3 → trigger ingestion job
     - Batch UUID → presigned URLs → S3 upload → batch ingestion

**No GitHub Repository UI**: Configuration handled in GitHub Action, not dashboard
**Display Requirements**: Last ingestion time, document count, cache hit statistics

### Job Monitoring & Status
- **Status Calculation**: Derive from processed/total documents (currently hardcoded)
  - Consider generated column in schema.ts using Drizzle
- **Real-time Updates**: Polling with oRPC calls (NO server-sent events)
- **Failure Handling**: Add new database table for ingestion failures (currently unsupported)

### Document Management
- **Document Lists**: Clickable documents to view full contents
- **Content Retrieval**: Server action → presigned S3 URL → client-side fetch
- **Virtual Scrolling**: Use TanStack Virtual for 1000+ documents

### Search Testing Interface
- Namespace selection + hybrid search + configurable top-K
- Display retrieved chunks with source document links
- Optional metadata filtering (low priority)

### MCP Server Assignment
**Bidirectional Many-to-Many Relationship** (like walkthrough assignment):
- Multiple namespaces per MCP server
- Multiple MCP servers per namespace
- Manageable from both namespace and MCP server UIs

## Technical Implementation Constraints

### State Management Pattern
- **Mutations**: oRPC server actions only
- **Client-side Data Fetching**: Intervals + useEffect + non-server-action oRPC calls
- **NO Optimistic Updates**: Considered anti-pattern

### Real-time Strategy
- **Polling Only**: No server-sent events (Next.js incompatibility)
- **Debounced Search**: For performance
- **Periodic Refresh**: For job monitoring tables

### Scope Exclusions
- **NO Mobile Responsiveness**: Dashboard is desktop-only
- **NO API Rate Limiting**: Not a current concern
- **NO CSRF/Input Sanitization**: Drizzle handles SQL injection protection
- **NO GitHub App Installation**: GitHub Action approach preferred
- **NO Bulk Operations**: Keep UI simple
- **NO Usage Data Collection**: Testing interface remains private
- **NO Export Functionality**: Customers already have source documents
- **NO Advanced Security**: Standard org-scoped access control sufficient

### Access Control
**Simple Collaboration Model**: Anyone with dashboard access can manage namespaces

## Next Steps for Feature Specification
1. Create separate sub-feature directories under `specifications/03-interactive-walkthrough/06-documentation-retrieval-ui/`
2. Define specific user stories for each sub-feature
3. Plan database schema additions for failure tracking
4. Research drag-and-drop folder upload web API capabilities
5. Design GitHub Action integration architecture

## Key Architecture Notes
- Follow existing MCPlatform patterns (async server components, promise passing)
- Use TanStack Virtual for large lists
- Implement proper organization scoping for all operations
- Design bidirectional MCP server relationships similar to walkthrough assignment