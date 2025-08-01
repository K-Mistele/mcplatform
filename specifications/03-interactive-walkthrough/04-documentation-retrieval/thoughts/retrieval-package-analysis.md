---
date: 2025-08-01T00:00:00Z
researcher: Claude
topic: "Retrieval Package Analysis and Documentation"
tags: [retrieval, documentation, inngest, embeddings, turbopuffer, redis]
status: complete
last_updated: 2025-08-01
last_updated_by: Claude
type: analysis
---

# Retrieval Package Analysis

## Overview

The retrieval package (`packages/retrieval/`) is a sophisticated document ingestion and search system built for MCPlatform. It enables organizations to ingest documentation from various sources (primarily GitHub repositories), process them through an AI-powered pipeline, and make them searchable through MCP servers. The system uses a combination of semantic embeddings and full-text search to provide relevant documentation to AI coding assistants.

## Architecture

### Core Components

1. **Document Management** (`src/documents.ts`)
   - Handles S3 storage for raw documents
   - Provides presigned URLs for uploads
   - Implements content-based change detection using SHA-1 hashes
   - Manages document retrieval from S3

2. **Preprocessing** (`src/preprocessing.ts`)
   - Extracts YAML frontmatter from Markdown documents
   - Chunks documents into smaller, searchable pieces
   - Extracts image URLs and categorizes them as local/remote
   - Uses `llm-text-splitter` library for intelligent chunking

3. **AI Inference** (`src/inference.ts`)
   - Configures Google AI (Gemini) models
   - Uses `gemini-2.5-flash` for text generation
   - Uses `gemini-embedding-001` for creating embeddings
   - Provides model abstraction for easy provider switching

4. **Vector Search** (`src/turbopuffer.ts`)
   - Integrates with Turbopuffer for hybrid search
   - Supports both vector (semantic) and BM25 (keyword) search
   - Handles namespace-based data isolation
   - Implements efficient bulk upserts with metadata

5. **Caching Layer** (`src/redis.ts`)
   - Caches documents during processing to reduce S3 calls
   - 24-hour expiration for cached documents
   - Supports both text and binary document types
   - Base64 encoding for reliable storage

6. **Configuration** (`src/config.ts`)
   - Rate limiting for AI APIs (1000 req/min for chat, 3000 req/min for embeddings)
   - Batch processing configuration (100 chunks per batch)
   - Gathering period for efficient API usage

### Inngest Functions (Durable Workflows)

The system uses Inngest for reliable, distributed processing:

1. **upload-document**: Stores raw documents in S3
2. **ingest-document**: Main orchestration function
3. **contextualize-chunk**: Adds AI-generated context to chunks
4. **process-chunk**: Coordinates contextualization and embedding
5. **embed-chunks**: Batch embeds multiple chunks
6. **embed-chunk-aggregator**: Batches embedding requests
7. **create-batch**: Creates ingestion job records

### Data Flow

```
1. Document Upload → S3 Storage
2. Ingestion Trigger → ingest-document function
3. Document Retrieval → Cache check → S3 fallback
4. Document Chunking → Split into processable pieces
5. Chunk Processing → Add contextual information
6. Embedding Generation → Batch processing for efficiency
7. Vector Storage → Turbopuffer with metadata
8. Search Ready → Hybrid retrieval available
```

## Key Features

### 1. Intelligent Document Processing

- **Frontmatter Extraction**: Parses YAML frontmatter for metadata
- **Title Extraction**: Falls back to first H1 if no title in frontmatter
- **Smart Chunking**: Respects Markdown structure while chunking
- **Overlap Support**: Configurable overlap between chunks for context

### 2. AI-Powered Contextualization

Each chunk is contextualized using Gemini Flash to:
- Provide surrounding document context
- Improve search relevance
- Enable better semantic understanding

### 3. Hybrid Search Capabilities

Turbopuffer integration provides:
- **Semantic Search**: Using embedding vectors
- **Keyword Search**: Using BM25 algorithm
- **Combined Ranking**: Merge results from both approaches
- **Metadata Filtering**: Search within specific metadata fields

### 4. Scalable Architecture

- **Batch Processing**: Efficient API usage through batching
- **Rate Limiting**: Prevents API quota exhaustion
- **Caching**: Reduces redundant S3 operations
- **Idempotency**: Safe to retry failed operations

### 5. Multi-tenancy Support

- **Organization Isolation**: Data strictly separated by organization
- **Namespace Segregation**: Further isolation within organizations
- **Secure Access**: No cross-tenant data leakage

## Database Schema

### Core Tables

1. **retrieval_namespace**
   - Stores namespace configurations
   - Links to organizations
   - Defines searchable document collections

2. **retrieval_documents**
   - Document metadata and content hashes
   - Tracks ingestion status
   - Maintains file paths and organization links

3. **retrieval_chunks**
   - Stores original and contextualized content
   - Maintains document ordering
   - Includes extracted metadata
   - Links to parent documents and namespaces

4. **retrieval_ingestion_job**
   - Tracks batch processing status
   - Monitors document counts
   - Records failures for debugging

## Testing Strategy

The package includes comprehensive tests:

### 1. Unit Tests
- Preprocessing functions (frontmatter, chunking, image extraction)
- Input validation
- Edge case handling

### 2. Integration Tests
- Inngest function workflows
- S3 operations
- Redis caching
- Database operations

### 3. Test Coverage
- Input validation failures
- File type restrictions
- Caching behavior
- Document updates and conflicts
- Metadata extraction

## Error Handling

### Non-Retriable Errors
- Invalid input parameters
- Unsupported file types
- Missing documents in S3
- Binary files for text processing

### Retriable Errors
- Temporary S3 failures
- API rate limits
- Database connection issues
- Network timeouts

## Performance Optimizations

1. **Batch Processing**: Groups embedding requests to minimize API calls
2. **Caching**: Redis cache reduces S3 bandwidth usage
3. **Throttling**: Prevents API quota exhaustion
4. **Parallel Processing**: Multiple chunks processed concurrently
5. **Incremental Updates**: Only processes changed documents

## Security Considerations

1. **Data Isolation**: Strict organization and namespace boundaries
2. **Access Control**: Documents only accessible to authorized namespaces
3. **Secure Storage**: S3 with proper IAM policies
4. **Input Validation**: Zod schemas prevent injection attacks

## Future Enhancements

Based on the code analysis, potential improvements include:

1. **PDF Support**: Currently only supports text-based formats
2. **Image Processing**: Image ingestion is stubbed but not implemented
3. **Version Control**: No document versioning currently
4. **Search Analytics**: Query tracking for improving relevance
5. **Real-time Updates**: Current system is batch-based

## Integration Points

### With MCPlatform
- Uses shared database schemas
- Integrates with organization management
- Follows platform authentication patterns

### External Services
- **S3**: Document storage
- **Redis**: Caching layer
- **Turbopuffer**: Vector search
- **Google AI**: Embeddings and contextualization
- **Inngest**: Workflow orchestration

## Development Guidelines

1. **Error Handling**: Always use NonRetriableError for permanent failures
2. **Validation**: Use Zod schemas for all external inputs
3. **Logging**: Include context in all log messages
4. **Testing**: Write tests for new Inngest functions
5. **Documentation**: Update this document when adding features

## Conclusion

The retrieval package is a well-architected system for document ingestion and search. It leverages modern AI capabilities while maintaining scalability, security, and reliability. The use of Inngest for orchestration and Turbopuffer for search provides a robust foundation for the documentation retrieval feature of MCPlatform.