---
date: 2025-08-01T00:00:00Z
researcher: Claude
topic: "Retrieval Package Workflow Diagrams"
tags: [retrieval, workflow, architecture, diagrams]
status: complete
last_updated: 2025-08-01
last_updated_by: Claude
type: architecture-diagram
---

# Retrieval Package Workflow Diagrams

## High-Level Architecture

```mermaid
graph TB
    subgraph "External Sources"
        GH[GitHub Repository]
        API[Upload API]
    end

    subgraph "Ingestion Layer"
        S3[S3 Storage]
        ING[Inngest Orchestrator]
        REDIS[Redis Cache]
    end

    subgraph "Processing Layer"
        CHUNK[Document Chunker]
        CTX[Contextualizer]
        EMB[Embedder]
    end

    subgraph "Storage Layer"
        PG[(PostgreSQL)]
        TP[Turbopuffer]
    end

    subgraph "Search Layer"
        MCP[MCP Server]
        SEARCH[Search Service]
    end

    GH -->|GitHub Action| API
    API -->|Upload| S3
    S3 -->|Trigger| ING
    ING -->|Fetch| S3
    ING -->|Cache| REDIS
    ING -->|Process| CHUNK
    CHUNK -->|Chunks| CTX
    CTX -->|Context| EMB
    EMB -->|Embeddings| TP
    EMB -->|Metadata| PG
    MCP -->|Query| SEARCH
    SEARCH -->|Hybrid Search| TP
    SEARCH -->|Metadata| PG
```

## Inngest Function Flow

```mermaid
sequenceDiagram
    participant Client
    participant Upload as upload-document
    participant Ingest as ingest-document
    participant Process as process-chunk
    participant Context as contextualize-chunk
    participant Batch as embed-chunk-aggregator
    participant Embed as embed-chunks
    participant Storage as Turbopuffer

    Client->>Upload: Document + Metadata
    Upload->>Upload: Store in S3
    Upload-->>Client: Success

    Client->>Ingest: Trigger Ingestion
    Ingest->>Ingest: Get from S3/Cache
    Ingest->>Ingest: Chunk Document
    
    loop For Each Chunk
        Ingest->>Process: Process Chunk Event
        Process->>Context: Contextualize Request
        Context->>Context: Add AI Context
        Context-->>Process: Contextualized Chunk
        Process->>Batch: Batch Embed Event
    end

    Batch->>Batch: Gather Chunks (5s window)
    Batch->>Embed: Batch Embedding Request
    Embed->>Embed: Generate Embeddings
    Embed-->>Batch: Embedding Results
    Batch->>Storage: Upsert Vectors
    Batch-->>Process: Correlation Response
```

## Document Processing Pipeline

```mermaid
graph LR
    subgraph "Input"
        MD[Markdown File]
    end

    subgraph "Preprocessing"
        FM[Extract Frontmatter]
        SPLIT[Chunk Document]
        IMG[Extract Images]
    end

    subgraph "Enhancement"
        CACHE{In Cache?}
        S3GET[Get from S3]
        CTX[Add Context]
    end

    subgraph "Embedding"
        BATCH[Batch Chunks]
        EMBED[Generate Embeddings]
    end

    subgraph "Storage"
        META[(Metadata DB)]
        VEC[(Vector DB)]
    end

    MD --> FM
    FM --> SPLIT
    SPLIT --> IMG
    SPLIT --> CACHE
    CACHE -->|No| S3GET
    CACHE -->|Yes| CTX
    S3GET --> CTX
    CTX --> BATCH
    BATCH --> EMBED
    EMBED --> META
    EMBED --> VEC
```

## Search Flow

```mermaid
graph TB
    subgraph "Search Request"
        QUERY[User Query]
        CTX_Q[Query Context]
    end

    subgraph "Search Processing"
        PARSE[Parse Query]
        EMBED_Q[Embed Query]
        
        subgraph "Hybrid Search"
            BM25[BM25 Search]
            VEC_S[Vector Search]
            MERGE[Merge Results]
        end
    end

    subgraph "Results"
        RANK[Rank by Relevance]
        BOOST[Context Boost]
        RETURN[Return Chunks]
    end

    QUERY --> PARSE
    CTX_Q --> PARSE
    PARSE --> EMBED_Q
    PARSE --> BM25
    EMBED_Q --> VEC_S
    BM25 --> MERGE
    VEC_S --> MERGE
    MERGE --> RANK
    CTX_Q --> BOOST
    RANK --> BOOST
    BOOST --> RETURN
```

## State Management

```mermaid
stateDiagram-v2
    [*] --> Pending: Create Ingestion Job
    
    Pending --> InProgress: Start Processing
    InProgress --> Chunking: Fetch Document
    
    Chunking --> Contextualizing: Split Complete
    Contextualizing --> Embedding: Context Added
    Embedding --> Storing: Embeddings Generated
    
    Storing --> Completed: All Chunks Stored
    
    InProgress --> Failed: Error
    Chunking --> Failed: Error
    Contextualizing --> Failed: Error
    Embedding --> Failed: Error
    Storing --> Failed: Error
    
    Failed --> [*]
    Completed --> [*]
```

## Data Model Relationships

```mermaid
erDiagram
    Organization ||--o{ RetrievalNamespace : has
    RetrievalNamespace ||--o{ Document : contains
    RetrievalNamespace ||--o{ Chunk : contains
    RetrievalNamespace ||--o{ IngestionJob : tracks
    Document ||--o{ Chunk : "split into"
    
    Organization {
        string id PK
        string name
        timestamp created_at
    }
    
    RetrievalNamespace {
        string id PK
        string organization_id FK
        string name
        json settings
        bigint created_at
    }
    
    Document {
        string id PK
        string organization_id FK
        string namespace_id FK
        string file_path
        string content_hash
        json metadata
        bigint created_at
        bigint updated_at
    }
    
    Chunk {
        string id PK
        string organization_id FK
        string namespace_id FK
        string document_path FK
        integer order_in_document
        text original_content
        text contextualized_content
        json metadata
        bigint created_at
        bigint updated_at
    }
    
    IngestionJob {
        string id PK
        string organization_id FK
        string namespace_id FK
        enum status
        integer total_documents
        integer documents_processed
        integer documents_failed
        bigint created_at
    }
```

## Error Handling Flow

```mermaid
graph TD
    subgraph "Error Detection"
        ERR[Error Occurs]
        TYPE{Error Type?}
    end

    subgraph "Non-Retriable"
        VAL[Validation Error]
        FORMAT[Unsupported Format]
        MISSING[Missing Resource]
        THROW_NR[Throw NonRetriableError]
    end

    subgraph "Retriable"
        NET[Network Error]
        RATE[Rate Limit]
        TEMP[Temporary Failure]
        THROW_R[Throw Error]
    end

    subgraph "Handling"
        LOG[Log Error]
        ALERT[Send Alert]
        RETRY{Retry?}
        FAIL[Mark Failed]
        DONE[Complete]
    end

    ERR --> TYPE
    TYPE -->|Permanent| VAL
    TYPE -->|Permanent| FORMAT
    TYPE -->|Permanent| MISSING
    TYPE -->|Temporary| NET
    TYPE -->|Temporary| RATE
    TYPE -->|Temporary| TEMP
    
    VAL --> THROW_NR
    FORMAT --> THROW_NR
    MISSING --> THROW_NR
    NET --> THROW_R
    RATE --> THROW_R
    TEMP --> THROW_R
    
    THROW_NR --> LOG
    THROW_R --> LOG
    LOG --> RETRY
    RETRY -->|No| FAIL
    RETRY -->|Yes| ERR
    FAIL --> ALERT
    ALERT --> DONE
```

## Caching Strategy

```mermaid
graph LR
    subgraph "Read Path"
        REQ[Request Document]
        CHECK{In Cache?}
        REDIS_GET[Get from Redis]
        S3_GET[Get from S3]
        REDIS_SET[Store in Redis]
        USE[Use Document]
    end

    subgraph "Write Path"
        PROCESS[Process Document]
        CLEAR[Clear from Cache]
        UPDATE[Update Complete]
    end

    REQ --> CHECK
    CHECK -->|Yes| REDIS_GET
    CHECK -->|No| S3_GET
    REDIS_GET --> USE
    S3_GET --> REDIS_SET
    REDIS_SET --> USE
    
    PROCESS --> CLEAR
    CLEAR --> UPDATE
```

## Deployment Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Dashboard]
        GHA[GitHub Actions]
        MCP_CLIENT[MCP Clients]
    end

    subgraph "API Gateway"
        LB[Load Balancer]
        AUTH[Auth Service]
    end

    subgraph "Application Layer"
        API1[API Server 1]
        API2[API Server 2]
        WORKER1[Inngest Worker 1]
        WORKER2[Inngest Worker 2]
    end

    subgraph "Data Layer"
        REDIS_CLUSTER[Redis Cluster]
        PG_PRIMARY[(PostgreSQL Primary)]
        PG_REPLICA[(PostgreSQL Replica)]
        S3_BUCKET[S3 Bucket]
    end

    subgraph "External Services"
        INNGEST[Inngest Cloud]
        TURBO[Turbopuffer]
        GEMINI[Google AI]
    end

    WEB --> LB
    GHA --> LB
    MCP_CLIENT --> LB
    LB --> AUTH
    AUTH --> API1
    AUTH --> API2
    API1 --> REDIS_CLUSTER
    API2 --> REDIS_CLUSTER
    API1 --> PG_PRIMARY
    API2 --> PG_PRIMARY
    API1 --> S3_BUCKET
    API2 --> S3_BUCKET
    WORKER1 --> INNGEST
    WORKER2 --> INNGEST
    WORKER1 --> TURBO
    WORKER2 --> TURBO
    WORKER1 --> GEMINI
    WORKER2 --> GEMINI
    PG_PRIMARY --> PG_REPLICA
```

## Performance Optimization Points

```mermaid
graph TD
    subgraph "Optimization Areas"
        BATCH[Batch Processing]
        CACHE[Caching Layer]
        PARALLEL[Parallel Execution]
        INDEX[Database Indexes]
    end

    subgraph "Batch Processing"
        B1[100 chunks per embedding batch]
        B2[5 second gathering window]
        B3[Organization-based batching]
    end

    subgraph "Caching"
        C1[24-hour document cache]
        C2[Skip S3 on cache hit]
        C3[Clear after processing]
    end

    subgraph "Parallelization"
        P1[Concurrent chunk processing]
        P2[Multiple Inngest workers]
        P3[Async S3 operations]
    end

    subgraph "Indexing"
        I1[namespace_id index]
        I2[document_path index]
        I3[Composite unique constraints]
    end

    BATCH --> B1
    BATCH --> B2
    BATCH --> B3
    CACHE --> C1
    CACHE --> C2
    CACHE --> C3
    PARALLEL --> P1
    PARALLEL --> P2
    PARALLEL --> P3
    INDEX --> I1
    INDEX --> I2
    INDEX --> I3
```

These diagrams provide a comprehensive visual representation of the retrieval package's architecture, workflows, and key design decisions. They can be rendered using any Mermaid-compatible viewer or documentation system.