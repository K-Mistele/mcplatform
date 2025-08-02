import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { bm25SearchTurboPuffer, vectorSearchTurboPuffer, hybridSearchTurboPuffer, turboPuffer, upsertIntoTurboPuffer } from '../../src/turbopuffer'
import { embedMany } from 'ai'
import { geminiEmbedding } from '../../src/inference'
import { chunkDocument } from '../../src/documents/preprocessing'

describe('Query TurboPuffer Direct', () => {
    let organizationId: string
    let namespaceId: string
    let testFileContent: string
    const testDocPath = 'test/test_file.md'

    beforeAll(async () => {
        // Generate unique IDs for this test run
        organizationId = `org_test_${randomUUID().substring(0, 8)}`
        namespaceId = `ns_test_${randomUUID().substring(0, 8)}`

        // Load test file
        testFileContent = await fs.readFile(path.join(__dirname, 'test_file.md'), 'utf-8')

        // Create test organization
        await db
            .insert(schema.organization)
            .values({
                id: organizationId,
                name: 'Test Organization for Direct Query Tests',
                createdAt: new Date()
            })
            .onConflictDoNothing()

        // Create test namespace
        await db
            .insert(schema.retrievalNamespace)
            .values({
                id: namespaceId,
                name: 'Test Namespace for Direct Query Tests',
                organizationId,
                createdAt: Date.now()
            })
            .onConflictDoNothing()
    })

    afterAll(async () => {
        // Clean up namespace
        await db.delete(schema.retrievalNamespace).where(eq(schema.retrievalNamespace.id, namespaceId))

        // Clean up organization
        await db.delete(schema.organization).where(eq(schema.organization.id, organizationId))

        // Clean up TurboPuffer namespace
        try {
            const ns = turboPuffer.namespace(`${organizationId}-${namespaceId}`)
            await ns.deleteAll()
        } catch {
            // Namespace might not exist, that's okay
        }
    })

    test('should insert chunks directly and query them', async () => {
        // Step 1: Chunk the document
        const chunks = chunkDocument(testFileContent)
        expect(chunks).toBeDefined()
        expect(chunks.length).toBeGreaterThan(0)
        console.log(`Created ${chunks.length} chunks from document`)

        // Take first 10 chunks for testing (to avoid rate limits)
        const testChunks = chunks.slice(0, 10)

        // Step 2: Generate embeddings for the chunks
        const embeddingsResult = await embedMany({
            model: geminiEmbedding,
            values: testChunks,
            providerOptions: {
                google: {
                    taskType: 'RETRIEVAL_DOCUMENT'
                }
            }
        })

        // Step 3: Insert chunks into TurboPuffer
        const chunksToInsert = testChunks.map((chunk, index) => ({
            chunkIndex: index,
            embedding: embeddingsResult.embeddings[index],
            documentPath: testDocPath,
            content: chunk,
            contextualizedContent: chunk, // In real pipeline this would be contextualized
            metadata: {
                title: '12-Factor Agents - Principles for building reliable LLM applications',
                description: 'The 12 factor agents manifesto'
            }
        }))

        await upsertIntoTurboPuffer({
            organizationId,
            namespaceId,
            chunks: chunksToInsert
        })

        // Wait a bit for TurboPuffer to index
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Step 4: Query the data

        // Query 1: Search for "context window" content
        const contextWindowQuery = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'context window',
            topK: 5
        })

        console.log('Context window query results:', contextWindowQuery.length)
        expect(contextWindowQuery).toBeDefined()
        expect(contextWindowQuery.length).toBeGreaterThan(0)
        
        // Should find content about Factor 3: Own your context window
        const contextWindowResult = contextWindowQuery.find((result: any) => 
            result.content?.toLowerCase().includes('context') || 
            result.contextualized_content?.toLowerCase().includes('context')
        )
        expect(contextWindowResult).toBeDefined()

        // Query 2: Search for "directed graphs" content
        const graphQuery = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'directed graphs',
            topK: 5
        })

        console.log('Graph query results:', graphQuery.length)
        expect(graphQuery).toBeDefined()
        
        // May or may not find graphs in first 10 chunks
        if (graphQuery.length > 0) {
            console.log('Found directed graphs content')
        }

        // Query 3: Vector search for "12 factor principles" 
        const vectorSearchResults = await vectorSearchTurboPuffer({
            organizationId,
            namespaceId,
            query: '12 factor principles for building agents',
            topK: 5
        })

        console.log('Vector search results:', vectorSearchResults.length)
        expect(vectorSearchResults).toBeDefined()
        expect(vectorSearchResults.length).toBeGreaterThan(0)
        
        // Should find chunks related to 12-factor agents principles
        const principlesResult = vectorSearchResults.find((result: any) => 
            result.content?.includes('12') || 
            result.content?.includes('factor') ||
            result.content?.includes('principles')
        )
        console.log('Found principles result:', !!principlesResult)

        // Query 4: Hybrid search (text + vector)
        const hybridResults = await hybridSearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'agents',
            topK: 5
        })

        console.log('Hybrid search results:', hybridResults)
        expect(hybridResults).toBeDefined()
        
        // With hybrid search, we should get results from both queries
        // The multiQuery returns an object with results from each query type
        if ('results' in hybridResults) {
            expect(hybridResults.results).toBeDefined()
            console.log('Hybrid search returned combined results')
        }
    }, 60000) // 1 minute timeout

    test('should handle empty namespace queries gracefully', async () => {
        const emptyNamespaceId = `ns_empty_${randomUUID().substring(0, 8)}`

        // Query an empty namespace
        const emptyQuery = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId: emptyNamespaceId,
            query: 'anything',
            topK: 5
        })

        expect(emptyQuery).toBeDefined()
        if (Array.isArray(emptyQuery)) {
            expect(emptyQuery.length).toBe(0)
        }
    })

    test('should respect topK parameter', async () => {
        // Query with topK=2
        const topK2Results = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'agents factors',
            topK: 2
        })

        if (Array.isArray(topK2Results)) {
            expect(topK2Results.length).toBeLessThanOrEqual(2)
        }

        // Query with topK=5
        const topK5Results = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'agents factors',
            topK: 5
        })

        if (Array.isArray(topK5Results)) {
            expect(topK5Results.length).toBeLessThanOrEqual(5)
            // Should have more results than topK=2 if there are enough matches
            if (topK2Results.length === 2) {
                expect(topK5Results.length).toBeGreaterThanOrEqual(topK2Results.length)
            }
        }
    })
})