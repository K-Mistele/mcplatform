---
date: 2025-07-30T15:41:14-05:00
researcher: Claude
git_commit: a68ca878810ada5917ff4cfdb69017b3c06a9d0c
branch: master
repository: mcplatform
topic: "Documentation Retrieval Feature Specification"
tags: [feature, requirements, specification, documentation-retrieval, mcp-tools, search]
status: implemented
last_updated: 2025-08-02
last_updated_by: Claude
type: feature
---

# Documentation Retrieval Feature

## Overview
The Documentation Retrieval feature enables MCPlatform customers to provide their tool's documentation directly to AI coding agents through MCP servers. This solves the critical problem that coding agents like Claude and Cursor lack access to documentation for newer or niche tools not in their training data, enabling more effective assistance for end-users.

## Business Value

### For MCPlatform Customers
- **Enhanced User Support**: AI agents can provide accurate, documentation-based assistance for their tools
- **Reduced Support Burden**: Users find answers through AI rather than creating support tickets
- **Usage Analytics**: Understand what documentation users search for and where they struggle
- **Content Gap Identification**: Discover missing documentation based on failed searches
- **Walkthrough Effectiveness**: Correlate documentation searches with walkthrough completion rates

### For End-Users
- **Contextual Help**: Get documentation directly in their IDE while working
- **AI-Powered Answers**: Agents can reference actual documentation instead of guessing
- **Seamless Integration**: No context switching to external documentation sites
- **Faster Problem Resolution**: Find specific answers without reading extensive docs

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
- MCP server infrastructure exists with tool implementation patterns
- Walkthrough system provides context for when documentation is needed
- Session tracking (`mcpServerSessionId`) enables correlation between activities
- Organization-scoped data model ensures proper multi-tenancy

### Composition Pattern
Standard MCPlatform patterns:
- Async server components fetch data and pass promises to client components
- oRPC server actions for mutations (creating namespaces, configuring servers)
- MCP tools for the actual documentation search functionality
- Inngest for durable execution of ingestion pipeline

### Data Model
New tables required:
- `documentation_namespaces`: Organization-scoped namespace definitions
- `mcp_server_documentation_namespaces`: Junction table for server-namespace assignments
- `documentation_files`: Metadata for ingested documentation files
- `documentation_search_queries`: Analytics tracking for searches
- `ingestion_jobs`: Track status and errors for documentation ingestion
- `ingestion_alerts`: Error reporting for failed ingestions

## User Stories
(in given/when/then format)

### Dashboard Users (Customers)
1. **Namespace Management**: **Given** I have documentation in a GitHub repo, **when** I create a documentation namespace, **then** I can configure it to ingest from my repo with specific paths and see ingestion status

2. **MCP Server Configuration**: **Given** I have multiple documentation namespaces, **when** I configure my MCP server, **then** I can select which namespaces should be searchable through that server

3. **Ingestion Monitoring**: **Given** documentation ingestion is running, **when** errors occur during processing, **then** I see alerts in my dashboard with specific error details

4. **Search Analytics**: **Given** users are searching documentation, **when** I view analytics, **then** I can see what they search for, which documents are accessed, and correlation with walkthrough success

### End-Users (MCP Tool Users)
1. **Basic Search**: **Given** I need help with a tool, **when** my AI agent searches documentation, **then** it retrieves relevant content to answer my question

2. **Contextual Search**: **Given** I'm following a walkthrough, **when** I need additional information, **then** documentation search understands my current context and prioritizes relevant results

3. **Multi-namespace Search**: **Given** multiple documentation sets are available, **when** searching, **then** the agent can search across all namespaces or specify particular ones

## Core Functionality

### Documentation Namespace Management
- **Namespace Creation**: Define namespaces with unique identifiers within an organization
- **Embedding Configuration**: Specify embedding model (provider, model slug, dimensions)
- **Source Configuration**: Connect to GitHub repositories with path specifications
- **Ingestion Triggers**: GitHub Actions detect changes and trigger updates
- **Status Monitoring**: Track ingestion progress and view error alerts

### Documentation Ingestion Pipeline
- **Change Detection**: GitHub Action identifies modified documentation files
- **API Upload**: Secure endpoint accepts documentation updates with authentication
- **Inngest Processing**: Durable execution for parsing, chunking, and embedding
- **Metadata Extraction**: Parse frontmatter and file hierarchy for searchable metadata
- **Object Storage**: Store original files preserving hierarchy
- **Vector Storage**: Index in Turbo Puffer with embeddings and BM25

### MCP Server Integration
- **Namespace Assignment**: Configure which namespaces each MCP server can access
- **Dynamic Tool Parameters**: Single namespace = no parameter; multiple = optional namespace selection
- **Search Tool**: New MCP tool for documentation retrieval
- **Context Awareness**: Pass current walkthrough/step context with searches

### Search Capabilities
- **Hybrid Retrieval**: Combine semantic search (embeddings) with keyword search (BM25)
- **Metadata Filtering**: Search/filter by frontmatter fields and document properties
- **Contextual Ranking**: Boost results based on current walkthrough context
- **Chunk Retrieval**: Return relevant snippets with option for full document access

### Analytics Integration
- **Query Tracking**: Store all searches with session, user, and context information
- **Embedding Storage**: Save query embeddings for clustering analysis
- **Walkthrough Correlation**: Link searches to active walkthrough and step
- **Success Metrics**: Analyze search patterns in successful vs. abandoned walkthroughs

## Requirements

### Functional Requirements
- Support Markdown documentation format with frontmatter parsing
- Handle incremental updates (only changed files) during ingestion
- Provide namespace-level access control for MCP servers
- Track stable walkthrough step IDs for accurate analytics correlation
- Support multiple embedding models per namespace
- Enable full-text and semantic search with metadata filtering
- Maintain file hierarchy metadata while storing in flat structure

### Non-Functional Requirements

#### Performance
- Ingestion pipeline must handle large documentation sets (1000+ files)
- Search latency under 200ms for 95th percentile
- Support concurrent ingestion jobs across organizations

#### Security & Permissions
- API authentication via organization-scoped keys
- Namespace access limited to assigned MCP servers
- No cross-organization data access
- Secure storage of documentation content

#### User Experience
- Clear ingestion status indicators in dashboard
- Intuitive namespace management interface
- Actionable error messages for failed ingestions

#### Mobile Support
- Dashboard namespace management responsive on mobile
- Analytics views optimized for smaller screens

## Design Considerations

### Layout & UI
- **Namespace Management**: New section in dashboard sidebar
- **Server Configuration**: Additional tab in MCP server settings
- **Ingestion Status**: Real-time progress indicators with error details
- **Analytics Integration**: Documentation search metrics in unified journey view

### Responsive Behavior
- Table-based views collapse to cards on mobile
- Search configuration forms stack vertically on small screens
- Analytics charts resize appropriately

### State Management
- URL state for namespace filters and search parameters
- Optimistic updates for configuration changes
- Real-time ingestion status via polling or SSE

## Implementation Considerations

### Technical Architecture
- **Ingestion Service**: Inngest functions for durable processing
- **Search Service**: Turbo Puffer for hybrid retrieval
- **Storage Layer**: Object storage for documents, PostgreSQL for metadata
- **Analytics Pipeline**: Process search queries for insights

### Dependencies
- Turbo Puffer for vector search and BM25
- Inngest for durable execution
- Object storage provider (S3-compatible)
- Embedding model API (OpenAI, Anthropic, etc.)
- GitHub Actions for change detection

## Success Criteria

### Core Functionality
- Documentation successfully ingested from GitHub repositories
- Search returns relevant results for user queries
- Analytics accurately track search behavior

### Technical Implementation
- All operations properly scoped to organizations
- Ingestion errors reported clearly to users
- Search performance meets latency requirements

### Engagement Metrics
- Increased walkthrough completion rates with documentation access
- Reduced support tickets for documentation-covered topics
- High search result relevance scores

### Business Impact
- Customer satisfaction with AI agent effectiveness
- Measurable reduction in user friction
- Data-driven documentation improvements

## Scope Boundaries

### Definitely In Scope
- Markdown documentation ingestion from GitHub
- Namespace-based organization of documentation
- MCP tool for documentation search
- Basic search analytics and correlation
- Error reporting for ingestion failures

### Definitely Out of Scope
- Non-Markdown formats (initially)
- Documentation versioning/history
- User feedback on search results (future enhancement)
- Direct documentation editing in dashboard
- Automatic documentation generation

### Future Considerations
- Support for additional documentation formats (RST, AsciiDoc)
- Advanced analytics with search result quality metrics
- Documentation versioning and rollback
- AI-powered documentation gap analysis
- Collaborative documentation feedback system

## Open Questions & Risks

### Questions Needing Resolution
- How to handle deleted documentation files? (Remove from index or mark as archived?)
- Best approach for user feedback on search quality?
- Optimal chunk size for different types of documentation?
- How to handle very large documentation sets?

### Identified Risks
- **Ingestion Complexity**: Parsing varied Markdown formats and frontmatter schemas
- **Search Relevance**: Ensuring hybrid retrieval provides high-quality results
- **Performance at Scale**: Managing large documentation sets across many organizations
- **Analytics Accuracy**: Maintaining correlation integrity with reorderable walkthrough steps

## Implementation Status

### Completed (August 2, 2025)

The documentation retrieval feature has been fully implemented with the following components:

#### Core Infrastructure ✅
- **Database Schema**: All tables created with proper migrations
  - `retrieval_namespaces`: Organization-scoped namespace definitions
  - `retrieval_documents`: Document metadata tracking
  - `retrieval_chunks`: Chunked document content for search
  - `retrieval_ingestion_job`: Job tracking for batch ingestion
  - `retrieval_ingestion_event`: Individual document event tracking

#### Ingestion Pipeline ✅
- **Inngest Functions**: Complete workflow implementation
  - `upload-document`: S3 document storage
  - `ingest-document`: Main orchestration function
  - `contextualize-chunk`: AI-powered chunk enrichment
  - `process-chunk`: Individual chunk processing
  - `embed-chunk-aggregator`: Batch embedding aggregation
  - `embed-chunks`: Embedding generation via Gemini
- **Document Processing**: Markdown parsing with frontmatter extraction
- **Chunking Strategy**: Smart text splitting with overlap
- **Caching Layer**: Redis caching for performance optimization

#### Vector Search ✅
- **Turbopuffer Integration**: Fully configured for hybrid search
- **Namespace Isolation**: Multi-tenant search with organization scoping
- **Search Functions**: Both simple and comprehensive search APIs
- **Metadata Support**: Full-text and metadata filtering capabilities

#### Testing Coverage ✅
- **Unit Tests**: Core function validation
  - Document ingestion workflow
  - Chunk contextualization
  - Text preprocessing
  - Direct Turbopuffer operations
- **Integration Tests**: End-to-end scenarios
  - Complete document upload and ingestion
  - Search query execution
  - Comprehensive retrieval testing
- **Test Data**: Sample markdown documentation included

### Remaining Work
- **Dashboard UI**: Management interface for namespaces (separate feature)
- **MCP Tool Integration**: Search tool for MCP servers (separate feature)
- **Analytics Dashboard**: Search analytics and insights (separate feature)
- **GitHub Action**: Automated ingestion trigger (deployment task)

### Technical Decisions
- Using Gemini Flash 1.5 for contextualization (cost-effective)
- Text-embedding-3-small for embeddings (1536 dimensions)
- S3 for document storage with hierarchical keys
- Redis for intermediate caching (24-hour retention)
- Turbopuffer for vector search (hybrid retrieval)

## Next Steps
- Implement dashboard UI for namespace management
- Create MCP tool for documentation search
- Set up GitHub Action for automated ingestion
- Deploy to production environment
- Monitor performance and optimize as needed