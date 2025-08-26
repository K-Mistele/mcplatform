---
date: 2025-08-03T22:07:28-07:00
researcher: Kyle
git_commit: da229a6fbb3775776a04d150ad5205b8e9b917bc
branch: master
repository: mcplatform
topic: "Documentation Retrieval UI Feature Specification"
tags: [feature, requirements, specification, documentation-retrieval, dashboard-ui, namespace-management, job-monitoring]
status: complete
last_updated: 2025-08-03
last_updated_by: Kyle
type: feature
---

# Documentation Retrieval UI Feature

## Overview
The Documentation Retrieval UI provides MCPlatform customers with a comprehensive dashboard interface to manage documentation namespaces, monitor ingestion jobs, test search functionality, and view document contents. This feature completes the documentation retrieval system by adding the missing user-facing components to the already-complete backend infrastructure.

## Business Value

### For MCPlatform Customers
- **Complete Documentation Control**: Full lifecycle management of documentation ingestion and search
- **Quality Assurance**: Ability to test and validate search functionality before deploying to end-users
- **Operational Visibility**: Real-time monitoring of document processing and ingestion jobs
- **Seamless Integration**: Bidirectional assignment of documentation namespaces to MCP servers

### For End-Users
- **Enhanced AI Assistance**: More accurate and contextual documentation search through MCP tools
- **Improved Developer Experience**: AI agents with access to up-to-date, well-organized documentation
- **Faster Problem Resolution**: Better search results lead to quicker answers and solutions

## Important Context
Note: all paths provided in this document are relative to `packages/dashboard`, the dashboard package in this monorepo.
Exceptions: 
* All database-related paths such as `schema.ts`, `auth-schema.ts` and `mcp-auth-schema.ts` are under `packages/database/src`, and are exported under `packages/database/index.ts`
* Any paths beginning with `specification/` are at the top level of the repository and NOT under `packages/`; the `specification/` directory is at the SAME LEVEL as the `packages/` directory.

### Current Implementation
The backend infrastructure is **100% complete and production-ready** with comprehensive test coverage:
- Database schema with 5 retrieval tables (`packages/database/src/schema.ts:299-430`)
- Inngest pipeline with 5 workflow functions (`packages/retrieval/src/inngest/functions/`)
- Vector search with Turbopuffer integration (`packages/retrieval/src/turbopuffer.ts`)
- Document storage with S3 + Redis caching
- Comprehensive test suite (`packages/retrieval/test/04-documentation-retrieval/`)

**Missing**: All user-facing components (0% implemented)
- Dashboard pages for namespace management
- Server actions for CRUD operations (`packages/dashboard/src/lib/orpc/actions/ingestion.ts` - currently empty)
- MCP tool integration (`packages/dashboard/src/lib/mcp/tools/documentation.ts` - missing)

### Composition Pattern
Standard MCPlatform async server component pattern with promises passed to client components; oRPC server actions for mutations; non-server-action oRPC calls for client-side data fetches with polling intervals for real-time updates.

### Data Model
Existing schema in `packages/database/src/schema.ts:299-430` includes:
- `retrieval_namespace`: Core namespace configuration
- `retrieval_document`: Individual document metadata
- `retrieval_chunk`: Document chunks for vector search
- `ingestion_job`: Job tracking for document processing
- `ingestion_job_document`: Junction table for job-document relationships

**Required Additions**:
- Junction table for MCP server-namespace associations
- Analytics table for search query tracking
- Ingestion failures tracking table

## User Stories
(in given/when/then format)

### MCPlatform Customers (Dashboard Users)
1. **Documentation Manager**: **Given** I need to provide AI-powered documentation assistance to my users, **when** I create a documentation namespace with GitHub Action integration, **then** I can automatically ingest and update my documentation for AI search - Must include namespace name, description, and display (disabled) embedding configuration

2. **Documentation Manager**: **Given** I have ingested documentation, **when** I assign namespaces to my MCP servers through the bidirectional assignment interface, **then** end-users of those servers get access to documentation search tools - Assignment must work from both namespace and MCP server management pages

3. **Operations Team**: **Given** I've triggered document ingestion via GitHub Action, **when** I monitor the ingestion jobs page, **then** I can see real-time progress, success/failure status, and detailed processing information - Must show job ID, namespace, status, progress (X/Y documents), and start time

4. **Documentation Manager**: **Given** I want to validate search quality, **when** I use the search testing interface, **then** I can query my namespace with configurable parameters and see retrieved chunks with source links - Must support namespace selection, hybrid search, top-K configuration, and result display with scores

5. **Content Reviewer**: **Given** I need to verify document ingestion quality, **when** I browse the document views, **then** I can see all ingested documents and view their full content - Must show file paths, chunk counts, processing status, and clickable document content

### System Integration
6. **GitHub Action**: **Given** a customer configures our GitHub Action with proper credentials, **when** documents change in their repository, **then** the action uploads files to S3 and triggers batch ingestion jobs - Requires new Next.js API route for file upload workflow

7. **MCP End-User**: **Given** a customer has assigned documentation namespaces to an MCP server, **when** an AI agent uses the documentation search tools, **then** relevant document chunks are retrieved and provided as context - Integration with existing MCP tool infrastructure

## Core Functionality

### Namespace Management
- Create/edit/delete documentation namespaces with simplified configuration
- GitHub Action integration focus (no direct repository connection UI)
- Display embedding configuration as read-only (provider/model/dimensions not user-configurable)
- Bidirectional MCP server assignment (many-to-many relationship like walkthroughs)
- Status indicators: Active, Ingesting, Error, Disabled

### Job Monitoring
- Real-time ingestion job tracking with polling-based updates
- Job list view with filterable status, progress, and timing information
- Detailed job view with document processing timeline
- Failure tracking and error display (requires new database schema)
- Status calculation derived from processed/total documents (currently hardcoded)

### Search Testing
- Interactive search interface with namespace selection
- Configurable search parameters (hybrid search, top-K results)
- Results display with chunk content, scores, and source document links
- Optional metadata filtering capabilities (low priority enhancement)
- No usage data collection (testing remains private)

### Document Views
- Browsable document lists within namespaces with virtual scrolling (TanStack Virtual)
- Individual document content viewer with markdown rendering
- Document metadata display (file path, chunks, processing status)
- Content retrieval via server action → presigned S3 URL → client-side fetch

## Requirements

### Functional Requirements
- **CRUD Operations**: Complete namespace lifecycle management with proper organization scoping
- **Real-time Monitoring**: Polling-based job status updates (NO server-sent events)
- **File Upload Integration**: API endpoints for GitHub Action workflow
- **Search Validation**: Testing interface using existing Turbopuffer infrastructure
- **Content Access**: Secure document viewing through presigned URLs
- **Assignment Management**: Bidirectional namespace-MCP server relationships

### Non-Functional Requirements

#### Performance
- Virtual scrolling for 1000+ document lists using TanStack Virtual
- Debounced search queries for responsive testing interface
- Efficient polling intervals for job monitoring
- Lazy loading of document content through presigned URLs

#### Security & Permissions
- Organization-scoped access control for all operations
- Standard dashboard authentication (no additional security layers needed)
- Secure document access through presigned S3 URLs
- Proper cleanup of resources on namespace deletion

#### User Experience
- Desktop-optimized interface (no mobile responsiveness required)
- Real-time feedback on long-running operations
- Clear error messaging for ingestion failures
- Intuitive navigation following existing dashboard patterns

## Design Considerations

### Layout & UI
- **Navigation Integration**: Add "Documentation" section to dashboard sidebar with sub-sections
- **Table-Based Interfaces**: Consistent with existing dashboard patterns for listings
- **Modal Dialogs**: Create/edit operations follow existing modal patterns
- **Status Indicators**: Color-coded status with appropriate icons (Active=green, Ingesting=yellow, Error=red)

### Responsive Behavior
- Desktop-only design (no mobile/tablet optimization required)
- Standard dashboard breakpoints for different desktop screen sizes
- Flexible table layouts that work across desktop resolutions

### State Management
- **Server Components**: Async data fetching with promises passed to client components
- **Client Components**: Use React 19 `use()` hook with proper Suspense/ErrorBoundary wrapping
- **Real-time Updates**: Managed polling intervals with useEffect cleanup
- **NO Optimistic Updates**: Considered anti-pattern, wait for server confirmation

## Implementation Considerations

### Technical Architecture
- **Sub-Feature Structure**: Broken into 4 sub-features for manageable implementation
  - Namespace Management (High Priority)
  - Job Monitoring (High Priority) 
  - Search Testing (Medium Priority)
  - Document Views (Medium Priority)
- **Database Extensions**: New tables for failures, server associations, and analytics
- **API Integration**: New endpoints for GitHub Action file upload workflow

### Dependencies
- **Backend Infrastructure**: Already complete (Inngest pipeline, Turbopuffer, S3 storage)
- **Existing Patterns**: Follow walkthrough assignment UI for namespace-server relationships
- **MCP Tool Schema Fix**: Critical bug affecting all existing tools must be resolved first

### Critical Technical Unknowns
- **Drag-and-Drop Support**: Research web API capabilities for folder upload
- **Status Calculation**: Implement Drizzle generated columns for derived status
- **Failure Tracking**: Design database schema for processing failures
- **GitHub Action Integration**: Plan secure file upload API architecture

## Success Criteria

### Core Functionality
- **Namespace Operations**: Customers can create, edit, and delete namespaces with proper organization scoping
- **Job Monitoring**: Real-time visibility into ingestion progress with failure handling
- **Search Validation**: Customers can test and validate documentation search quality
- **MCP Integration**: Seamless assignment of namespaces to MCP servers with bidirectional management

### Technical Implementation
- **Database Operations**: All operations properly scoped to organizations with efficient queries
- **Real-time Updates**: Polling-based job monitoring works reliably without performance issues
- **Integration Compliance**: Follows existing MCPlatform patterns and architecture
- **Error Handling**: Graceful failure handling with clear user feedback

### Business Impact
- **Customer Adoption**: Documentation feature becomes a key differentiator for MCPlatform
- **User Engagement**: End-users of customer products receive higher-quality AI assistance
- **Operational Efficiency**: Customers can maintain and validate their documentation systems independently

## Scope Boundaries

### Definitely In Scope
- **Complete Dashboard UI**: All user-facing components for namespace and job management
- **GitHub Action Integration**: API endpoints and workflow for automated ingestion
- **Search Testing**: Validation interface for customers to test documentation quality
- **MCP Server Assignment**: Bidirectional relationship management
- **Document Browsing**: Content viewing and quality verification

### Definitely Out of Scope
- **GitHub App Integration**: Use GitHub Actions instead of complex OAuth app
- **Mobile Responsiveness**: Dashboard is desktop-only
- **Advanced Security**: Standard org-scoped access control is sufficient
- **Bulk Operations**: Keep UI simple with individual operations
- **Usage Analytics**: No tracking of search testing activities
- **Export Functionality**: Customers already have source documents

### Future Considerations
- **Metadata Filtering**: Advanced search filters based on document metadata
- **Collaboration Features**: Team-based namespace management
- **Performance Analytics**: Search performance monitoring and optimization
- **Additional File Types**: PDF and image processing support

## Open Questions & Risks

### Questions Needing Resolution
- **Drag-and-Drop Implementation**: Is folder drag-and-drop technically feasible with current web APIs?
- **Status Calculation**: Best approach for derived status using Drizzle generated columns?
- **Failure Schema Design**: Optimal database structure for tracking ingestion failures?
- **GitHub Action Security**: Secure authentication method for API endpoints?

### Identified Risks
- **Real-time Performance**: Polling frequency balance between responsiveness and server load
- **Large Document Sets**: Virtual scrolling implementation complexity with TanStack Virtual
- **Integration Complexity**: Bidirectional MCP server relationships following walkthrough patterns
- **Critical Bug Impact**: MCP tool schema registration bug affects entire system

## Next Steps
- ✅ Sub-feature directories and high-level specifications created
- ✅ Technical unknowns documented for research
- **Address Critical Bug**: Fix MCP tool schema registration across all existing tools
- **Research Technical Unknowns**: Investigate drag-and-drop, status calculation, and failure tracking
- **Plan Database Migrations**: Design new tables for failures and server associations
- **Begin Implementation**: Start with namespace management (highest priority)
- Ready for detailed sub-feature specification development