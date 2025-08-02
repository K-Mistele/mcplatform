---
date: 2025-08-01T00:00:00Z
researcher: Claude
topic: "Retrieval Package Troubleshooting Guide"
tags: [retrieval, troubleshooting, debugging, operations]
status: complete
last_updated: 2025-08-01
last_updated_by: Claude
type: troubleshooting-guide
---

# Retrieval Package Troubleshooting Guide

## Overview

This guide provides systematic approaches to diagnose and resolve common issues with the retrieval package. It's organized by symptoms and includes specific debugging steps, queries, and solutions.

## Common Issues and Solutions

### 1. Document Ingestion Failures

#### Symptom: Documents not appearing in search results

**Diagnostic Steps:**

1. Check ingestion job status:
```sql
SELECT id, status, total_documents, documents_processed, documents_failed
FROM retrieval_ingestion_job
WHERE organization_id = ? 
  AND namespace_id = ?
ORDER BY created_at DESC
LIMIT 10;
```

2. Verify document existence in S3:
```typescript
// Check S3 directly
const key = `${organizationId}/${namespaceId}/${documentPath}`;
const command = new HeadObjectCommand({
    Bucket: Resource.McpPlatformBucket.name
    Key: key
});
```

3. Check Inngest function status:
- Navigate to Inngest dashboard
- Filter by function: `ingest-document`
- Look for failed runs with your document path

**Common Causes & Solutions:**

- **Unsupported file type**: Only `.md`, `.mdx`, `.markdown`, `.txt` supported
- **Missing S3 object**: Ensure upload completed successfully
- **Invalid batch ID**: Verify ingestion job exists in database
- **Rate limiting**: Check API quota usage

#### Symptom: Ingestion stuck at "in_progress"

**Diagnostic Steps:**

1. Check for long-running Inngest functions:
```bash
# In Inngest dashboard, look for functions running > 30 minutes
```

2. Verify chunk processing:
```sql
SELECT document_path, COUNT(*) as chunk_count
FROM retrieval_chunks
WHERE namespace_id = ?
GROUP BY document_path
ORDER BY chunk_count DESC;
```

3. Check Redis for stale cache:
```typescript
const keys = await redisClient.keys(`document:${orgId}:${nsId}:*`);
console.log('Cached documents:', keys.length);
```

**Solutions:**
- Clear stale Redis cache
- Cancel stuck Inngest functions
- Restart ingestion with new batch ID

### 2. Embedding Generation Issues

#### Symptom: Chunks without embeddings

**Diagnostic Steps:**

1. Check for contextualized chunks without embeddings:
```sql
SELECT COUNT(*) 
FROM retrieval_chunks
WHERE namespace_id = ?
  AND contextualized_content IS NOT NULL
  AND created_at < NOW() - INTERVAL '1 hour';
```

2. Verify API key configuration:
```bash
# Check environment variables
echo $GOOGLE_API_KEY | head -c 10
```

3. Monitor embedding function logs:
```typescript
// Look for these patterns in Inngest logs
"embedding chunks"
"Number of embeddings does not match"
"throttle limit reached"
```

**Common Causes:**
- **API rate limits**: 3000 embeddings/minute limit
- **Invalid API key**: Verify Google AI credentials
- **Batch size issues**: Chunks may exceed batch limits

**Solutions:**
```typescript
// Manually trigger re-embedding
await inngest.send({
    name: 'retrieval/embed-chunk',
    data: {
        [correlationId]: contextualizedContent
    }
});
```

### 3. Search Not Returning Results

#### Symptom: Empty search results despite indexed documents

**Diagnostic Steps:**

1. Verify Turbopuffer namespace exists:
```typescript
const ns = turboPuffer.namespace(`${orgId}-${nsId}`);
// Try a simple query
const result = await ns.query({
    rank_by: ['content', 'BM25', 'test'],
    top_k: 1
});
```

2. Check chunk indexing:
```sql
SELECT COUNT(*) as total_chunks,
       COUNT(contextualized_content) as contextualized,
       COUNT(DISTINCT document_path) as documents
FROM retrieval_chunks
WHERE namespace_id = ?;
```

3. Test search with known content:
```typescript
// Use exact text from a chunk
const testResult = await searchTurboPuffer({
    organizationId,
    namespaceId,
    query: { textQuery: "exact chunk content" },
    topK: 1
});
```

**Solutions:**
- Verify Turbopuffer API key
- Check namespace naming: `${orgId}-${nsId}`
- Ensure chunks were uploaded to Turbopuffer
- Verify metadata schema matches

### 4. Performance Issues

#### Symptom: Slow ingestion processing

**Diagnostic Steps:**

1. Identify bottlenecks:
```sql
-- Check processing times
SELECT 
    document_path,
    (updated_at - created_at) as processing_time_ms,
    COUNT(*) as chunk_count
FROM retrieval_chunks
WHERE namespace_id = ?
GROUP BY document_path, updated_at, created_at
ORDER BY processing_time_ms DESC;
```

2. Monitor cache performance:
```typescript
// Add timing to cache operations
const start = Date.now();
const cached = await getDocumentFromCache(org, ns, path);
console.log(`Cache lookup: ${Date.now() - start}ms`);
```

3. Check concurrent operations:
```sql
-- Active ingestion jobs
SELECT COUNT(*) as active_jobs
FROM retrieval_ingestion_job
WHERE status = 'in_progress';
```

**Optimization Steps:**
- Increase batch sizes (up to 100)
- Optimize chunk sizes (reduce from 4096 if needed)
- Enable Redis pipeline for bulk operations
- Scale Inngest workers

### 5. Data Integrity Issues

#### Symptom: Duplicate or missing chunks

**Diagnostic Steps:**

1. Check for duplicates:
```sql
SELECT document_path, order_in_document, COUNT(*)
FROM retrieval_chunks
WHERE namespace_id = ?
GROUP BY document_path, order_in_document
HAVING COUNT(*) > 1;
```

2. Verify chunk ordering:
```sql
SELECT document_path, 
       array_agg(order_in_document ORDER BY order_in_document) as orders
FROM retrieval_chunks
WHERE namespace_id = ?
GROUP BY document_path;
```

3. Compare with source:
```typescript
// Re-chunk document and compare
const sourceChunks = chunkDocument(documentContent);
// Compare with database chunk count
```

**Solutions:**
- Use unique constraints properly
- Implement idempotency keys
- Clean duplicate data:
```sql
DELETE FROM retrieval_chunks
WHERE id NOT IN (
    SELECT MIN(id)
    FROM retrieval_chunks
    GROUP BY document_path, order_in_document, namespace_id
);
```

## Debugging Tools

### 1. Logging Queries

Add detailed logging to track issues:

```typescript
// Enhanced logging function
function logOperation(operation: string, data: any, duration?: number) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        operation,
        duration,
        ...data
    }));
}

// Usage
const start = Date.now();
const result = await operation();
logOperation('embed_chunks', {
    count: chunks.length,
    namespace: namespaceId
}, Date.now() - start);
```

### 2. Health Check Script

```typescript
async function healthCheck(orgId: string, nsId: string) {
    const checks = {
        database: false,
        redis: false,
        s3: false,
        turbopuffer: false,
        inngest: false
    };

    // Database check
    try {
        await db.select().from(schema.retrievalNamespace).limit(1);
        checks.database = true;
    } catch (e) {
        console.error('Database check failed:', e);
    }

    // Redis check
    try {
        await redisClient.ping();
        checks.redis = true;
    } catch (e) {
        console.error('Redis check failed:', e);
    }

    // Continue for other services...
    
    return checks;
}
```

### 3. Data Validation Script

```typescript
async function validateNamespaceData(namespaceId: string) {
    const issues = [];

    // Check for orphaned chunks
    const orphanedChunks = await db.query.chunks.findMany({
        where: (chunks, { and, eq, notExists }) => and(
            eq(chunks.namespaceId, namespaceId),
            notExists(
                db.select().from(schema.documents)
                    .where(eq(schema.documents.filePath, chunks.documentPath))
            )
        )
    });

    if (orphanedChunks.length > 0) {
        issues.push({
            type: 'orphaned_chunks',
            count: orphanedChunks.length,
            documents: [...new Set(orphanedChunks.map(c => c.documentPath))]
        });
    }

    // Check for incomplete processing
    const incompleteChunks = await db.query.chunks.findMany({
        where: (chunks, { and, eq, isNull }) => and(
            eq(chunks.namespaceId, namespaceId),
            isNull(chunks.contextualizedContent)
        )
    });

    if (incompleteChunks.length > 0) {
        issues.push({
            type: 'incomplete_chunks',
            count: incompleteChunks.length
        });
    }

    return issues;
}
```

## Emergency Procedures

### 1. Stop All Processing

```typescript
// Cancel all active Inngest functions
async function emergencyStop(organizationId: string) {
    // Mark all jobs as failed
    await db
        .update(schema.ingestionJob)
        .set({ status: 'failed' })
        .where(and(
            eq(schema.ingestionJob.organizationId, organizationId),
            eq(schema.ingestionJob.status, 'in_progress')
        ));

    // Clear Redis cache
    const pattern = `document:${organizationId}:*`;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
        await redisClient.del(...keys);
    }

    // Log emergency stop
    console.error('Emergency stop executed for org:', organizationId);
}
```

### 2. Reset Namespace

```typescript
async function resetNamespace(namespaceId: string) {
    // WARNING: This deletes all data!
    
    // Delete from Turbopuffer
    const ns = turboPuffer.namespace(`${orgId}-${namespaceId}`);
    await ns.deleteAll();

    // Delete from database
    await db.transaction(async (tx) => {
        await tx.delete(schema.chunks)
            .where(eq(schema.chunks.namespaceId, namespaceId));
        
        await tx.delete(schema.documents)
            .where(eq(schema.documents.namespaceId, namespaceId));
        
        await tx.delete(schema.ingestionJob)
            .where(eq(schema.ingestionJob.namespaceId, namespaceId));
    });

    // Clear cache
    const keys = await redisClient.keys(`document:*:${namespaceId}:*`);
    if (keys.length > 0) {
        await redisClient.del(...keys);
    }
}
```

### 3. Manual Recovery

For partial failures, manually process remaining documents:

```typescript
async function recoverFailedDocuments(batchId: string) {
    // Get failed documents
    const job = await db.query.ingestionJob.findFirst({
        where: eq(schema.ingestionJob.id, batchId)
    });

    if (!job) throw new Error('Job not found');

    // Find unprocessed documents
    const processed = await db.query.documents.findMany({
        where: eq(schema.documents.namespaceId, job.namespaceId),
        columns: { filePath: true }
    });

    const processedPaths = new Set(processed.map(d => d.filePath));

    // Re-trigger ingestion for missing documents
    // Implementation depends on document source
}
```

## Monitoring Recommendations

### Key Metrics to Track

1. **Ingestion Pipeline**
   - Documents per minute
   - Average processing time
   - Failure rate
   - Queue depth

2. **API Usage**
   - Embedding API calls/minute
   - Context generation calls/minute
   - Rate limit proximity
   - Error rates

3. **Storage**
   - S3 request rate
   - Redis memory usage
   - Cache hit rate
   - Database connection pool

4. **Search Performance**
   - Query latency (p50, p95, p99)
   - Result count distribution
   - Empty result rate
   - Turbopuffer API errors

### Alert Conditions

Set up alerts for:
- Ingestion job stuck > 1 hour
- API rate limit > 80% of quota
- Redis memory > 80% of limit
- Search latency p95 > 500ms
- Failed ingestion rate > 5%

## Best Practices for Prevention

1. **Pre-ingestion Validation**
   - Validate file formats before upload
   - Check document size limits
   - Verify namespace exists

2. **Graceful Degradation**
   - Implement circuit breakers for external APIs
   - Use exponential backoff for retries
   - Cache fallbacks for read operations

3. **Regular Maintenance**
   - Clean up orphaned data weekly
   - Monitor and rotate logs
   - Update API keys before expiration
   - Review and optimize slow queries

4. **Testing in Production**
   - Use canary namespaces for testing
   - Implement feature flags for new code
   - Monitor test namespaces separately

This guide should help diagnose and resolve most issues with the retrieval package. For issues not covered here, check the Inngest dashboard for detailed function logs and contact the platform team for assistance.