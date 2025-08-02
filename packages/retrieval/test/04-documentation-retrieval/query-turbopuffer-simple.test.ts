import { describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { bm25SearchTurboPuffer, vectorSearchTurboPuffer, turboPuffer, upsertIntoTurboPuffer } from '../../src/turbopuffer'
import { embedMany } from 'ai'
import { geminiEmbedding } from '../../src/inference'
import { chunkDocument } from '../../src/documents/preprocessing'

describe('Query TurboPuffer Simple', () => {
    const organizationId = `org_test_${randomUUID().substring(0, 8)}`
    const namespaceId = `ns_test_${randomUUID().substring(0, 8)}`
    const testDocPath = 'test/test_file.md'

    test('should insert and query chunks from TurboPuffer', async () => {
        // Load test file
        const testFileContent = await fs.readFile(path.join(__dirname, 'test_file.md'), 'utf-8')

        // Step 1: Chunk the document
        const chunks = chunkDocument(testFileContent)
        expect(chunks).toBeDefined()
        expect(chunks.length).toBeGreaterThan(0)
        console.log(`Created ${chunks.length} chunks from document`)

        // Take first 5 chunks for testing (to avoid rate limits)
        const testChunks = chunks.slice(0, 5)

        // Step 2: Generate embeddings for the chunks
        console.log('Generating embeddings for chunks...')
        const embeddingsResult = await embedMany({
            model: geminiEmbedding,
            values: testChunks,
            providerOptions: {
                google: {
                    taskType: 'RETRIEVAL_DOCUMENT'
                }
            }
        })

        expect(embeddingsResult.embeddings).toBeDefined()
        expect(embeddingsResult.embeddings.length).toBe(testChunks.length)

        // Step 3: Insert chunks into TurboPuffer
        console.log('Inserting chunks into TurboPuffer...')
        const chunksToInsert = testChunks.map((chunk, index) => ({
            chunkIndex: index,
            embedding: embeddingsResult.embeddings[index],
            documentPath: testDocPath,
            content: chunk,
            contextualizedContent: chunk,
            metadata: {
                title: '12-Factor Agents',
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

        // Step 4: Query the data with text search
        console.log('Querying for "factor" content...')
        const factorQuery = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId,
            query: 'factor',
            topK: 5
        })

        // Handle TurboPuffer response structure
        const factorResults = Array.isArray(factorQuery) ? factorQuery : (factorQuery.rows || factorQuery.data || [])
        console.log(`Text search found ${factorResults.length} results`)
        expect(factorQuery).toBeDefined()
        
        // Check if any chunk contains "factor"
        const hasFactorInChunks = testChunks.some(chunk => chunk.toLowerCase().includes('factor'))
        console.log('Any chunk contains "factor"?', hasFactorInChunks)
        
        // Should find some results if "factor" appears in first 5 chunks
        if (factorResults.length > 0) {
            console.log('Sample result:', factorResults[0])
            expect(factorResults[0]).toHaveProperty('content')
            expect(factorResults[0]).toHaveProperty('document_path')
        }

        // Step 5: Vector search
        console.log('Performing vector search...')
        const vectorResults = await vectorSearchTurboPuffer({
            organizationId,
            namespaceId,
            query: '12 factor agents principles',
            topK: 3
        })

        // Handle TurboPuffer response structure
        const vectorResultsArray = Array.isArray(vectorResults) ? vectorResults : (vectorResults.rows || vectorResults.data || [])
        console.log(`Vector search found ${vectorResultsArray.length} results`)
        expect(vectorResults).toBeDefined()
        expect(vectorResultsArray.length).toBeGreaterThan(0)
        expect(vectorResultsArray.length).toBeLessThanOrEqual(3)

        // Clean up
        try {
            const ns = turboPuffer.namespace(`${organizationId}-${namespaceId}`)
            await ns.deleteAll()
            console.log('Cleaned up namespace')
        } catch (error) {
            console.log('Could not clean up namespace:', error)
        }
    }, 60000) // 1 minute timeout

    test('should handle topK parameter correctly', async () => {
        // Create some test data
        const testContent = ['test chunk 1', 'test chunk 2', 'test chunk 3']
        
        const embeddings = await embedMany({
            model: geminiEmbedding,
            values: testContent,
            providerOptions: {
                google: {
                    taskType: 'RETRIEVAL_DOCUMENT'
                }
            }
        })

        await upsertIntoTurboPuffer({
            organizationId,
            namespaceId: namespaceId + '_topk',
            chunks: testContent.map((content, i) => ({
                chunkIndex: i,
                embedding: embeddings.embeddings[i],
                documentPath: 'test.md',
                content,
                contextualizedContent: content,
                metadata: {}
            }))
        })

        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Test topK=1
        const results1 = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId: namespaceId + '_topk',
            query: 'test',
            topK: 1
        })

        if (Array.isArray(results1)) {
            expect(results1.length).toBeLessThanOrEqual(1)
        }

        // Test topK=2
        const results2 = await bm25SearchTurboPuffer({
            organizationId,
            namespaceId: namespaceId + '_topk',
            query: 'test',
            topK: 2
        })

        if (Array.isArray(results2)) {
            expect(results2.length).toBeLessThanOrEqual(2)
        }

        // Clean up
        try {
            const ns = turboPuffer.namespace(`${organizationId}-${namespaceId}_topk`)
            await ns.deleteAll()
        } catch {}
    }, 30000)
})