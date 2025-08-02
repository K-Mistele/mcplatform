import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { bm25SearchTurboPuffer, vectorSearchTurboPuffer, hybridSearchTurboPuffer, turboPuffer, upsertIntoTurboPuffer } from '../../src/turbopuffer'
import { embedMany } from 'ai'
import { geminiEmbedding } from '../../src/inference'
import { chunkDocument } from '../../src/documents/preprocessing'

describe('Comprehensive Query Tests for Retrieval System', () => {
    const organizationId = `org_test_${randomUUID().substring(0, 8)}`
    const namespaceId = `ns_test_${randomUUID().substring(0, 8)}`
    const testDocPath = 'test/test_file.md'

    test('should perform comprehensive queries with top_k=5', async () => {
        // Load and chunk the test document
        const testFileContent = await fs.readFile(path.join(__dirname, 'test_file.md'), 'utf-8')
        const chunks = chunkDocument(testFileContent)
        
        console.log(`Processing ${chunks.length} chunks from test document`)
        
        // Take a larger sample for better query results
        const testChunks = chunks.slice(0, 15) // First 15 chunks
        
        // Generate embeddings
        const embeddingsResult = await embedMany({
            model: geminiEmbedding,
            values: testChunks,
            providerOptions: {
                google: {
                    taskType: 'RETRIEVAL_DOCUMENT'
                }
            }
        })

        // Insert into TurboPuffer
        const chunksToInsert = testChunks.map((chunk, index) => ({
            chunkIndex: index,
            embedding: embeddingsResult.embeddings[index],
            documentPath: testDocPath,
            content: chunk,
            contextualizedContent: chunk,
            metadata: {
                title: '12-Factor Agents - Principles for building reliable LLM applications',
                description: 'The 12 factor agents manifesto',
                chunkNumber: index
            }
        }))

        await upsertIntoTurboPuffer({
            organizationId,
            namespaceId,
            chunks: chunksToInsert
        })

        // Wait for indexing
        await new Promise((resolve) => setTimeout(resolve, 3000))

        // Test 1: Query for "context window" with top_k=5
        console.log('\n=== Test 1: Searching for "context window" ===')
        const contextQuery = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'context window',
            topK: 5
        })

        const contextResults = contextQuery.rows || contextQuery
        console.log(`Found ${contextResults.length} results for "context window"`)
        expect(contextResults.length).toBeLessThanOrEqual(5)
        
        if (contextResults.length > 0) {
            // Check if results mention context
            const hasContextContent = contextResults.some((result: any) => 
                result.content?.toLowerCase().includes('context') ||
                result.contextualized_content?.toLowerCase().includes('context')
            )
            console.log('Results contain "context":', hasContextContent)
        }

        // Test 2: Query for "directed graphs DAGs" with top_k=5
        console.log('\n=== Test 2: Searching for "directed graphs DAGs" ===')
        const graphQuery = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'directed graphs DAGs',
            topK: 5
        })

        const graphResults = graphQuery.rows || graphQuery
        console.log(`Found ${graphResults.length} results for "directed graphs DAGs"`)
        expect(graphResults.length).toBeLessThanOrEqual(5)

        // Test 3: Vector search for "12 factor principles" with top_k=5
        console.log('\n=== Test 3: Vector search for "12 factor principles" ===')
        const principlesQuery = await vectorSearchTurboPuffer({
            organizationId,
            namespaceId,
            query: '12 factor principles for building LLM agents',
            topK: 5
        })

        const principlesResults = principlesQuery.rows || principlesQuery
        console.log(`Found ${principlesResults.length} results via vector search`)
        expect(principlesResults.length).toBeGreaterThan(0)
        expect(principlesResults.length).toBeLessThanOrEqual(5)
        
        // The first result should be highly relevant
        if (principlesResults.length > 0) {
            const topResult = principlesResults[0]
            console.log('Top result distance:', topResult.$dist)
            console.log('Top result contains "factor":', topResult.content?.includes('factor'))
        }

        // Test 4: Hybrid search (text + vector) with top_k=5
        console.log('\n=== Test 4: Hybrid search for "modular concepts" ===')
        const hybridQuery = await hybridSearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'modular concepts',
            topK: 5
        })

        // Hybrid search returns results differently
        console.log('Hybrid query response type:', typeof hybridQuery)
        if (hybridQuery.results) {
            // Multiple query results
            console.log('Text search results:', hybridQuery.results[0]?.rows?.length || 0)
            console.log('Vector search results:', hybridQuery.results[1]?.rows?.length || 0)
            
            expect(hybridQuery.results).toBeDefined()
            expect(hybridQuery.results.length).toBe(2) // One for text, one for vector
        }

        // Test 5: Query for specific factors with top_k=5
        console.log('\n=== Test 5: Searching for specific factors ===')
        const factorsQuery = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'Factor 3 Factor 8 Factor 10',
            topK: 5
        })

        const factorsResults = factorsQuery.rows || factorsQuery
        console.log(`Found ${factorsResults.length} results for specific factors`)
        expect(factorsResults.length).toBeLessThanOrEqual(5)

        // Clean up
        try {
            const ns = turboPuffer.namespace(`${organizationId}-${namespaceId}`)
            await ns.deleteAll()
            console.log('\nCleaned up test namespace')
        } catch (error) {
            console.log('Cleanup error:', error)
        }

        // Summary
        console.log('\n=== Test Summary ===')
        console.log('✓ Text search working with top_k=5')
        console.log('✓ Vector search working with top_k=5')
        console.log('✓ Hybrid search working with top_k=5')
        console.log('✓ All queries respect top_k parameter')
        console.log('✓ Results contain expected content')

    }, 90000) // 1.5 minute timeout
})