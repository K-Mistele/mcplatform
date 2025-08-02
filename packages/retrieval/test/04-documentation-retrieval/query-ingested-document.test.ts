import { describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { searchTurboPuffer, turboPuffer, upsertIntoTurboPuffer } from '../../src/turbopuffer'
import { geminiEmbedding } from '../../src/inference'
import { embed } from 'ai'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const { documents: documentsTable, embeddings: embeddingsTable } = schema

describe('Query Ingested Document', () => {
    const organizationId = nanoid()
    const namespaceId = nanoid()
    const documentId = nanoid()
    const testDocPath = 'test/test_file.md'
    const fullTestDocPath = join(__dirname, 'test_file.md')

    // Helper to clean up test data
    async function cleanup() {
        await db.delete(embeddingsTable).where(eq(embeddingsTable.documentId, documentId))
        await db.delete(documentsTable).where(eq(documentsTable.id, documentId))
        
        // Clean up TurboPuffer namespace
        try {
            const ns = turboPuffer.namespace(`${organizationId}-${namespaceId}`)
            await ns.deleteAll()
        } catch (error) {
            // Namespace might not exist, that's okay
        }
    }

    test('should ingest test document and query for specific content', async () => {
        await cleanup()

        // Read the test document
        const documentContent = await readFile(fullTestDocPath, 'utf-8')

        // Create document record
        const [document] = await db.insert(documentsTable).values({
            id: documentId,
            organizationId,
            namespaceId,
            path: testDocPath,
            content: documentContent,
            metadata: {
                title: '12-Factor Agents - Principles for building reliable LLM applications',
                description: 'The 12 factor agents manifesto',
                updatedAt: '02/15/2023'
            },
            createdAt: BigInt(Date.now())
        }).returning()

        // Simulate chunk processing (similar to what the ingestion pipeline would do)
        // For this test, we'll create a few key chunks manually
        const chunks = [
            {
                content: 'The promise of agents. We\'re gonna talk a lot about Directed Graphs (DGs) and their Acyclic friends, DAGs. I\'ll start by pointing out that...well...software is a directed graph. There\'s a reason we used to represent programs as flow charts.',
                chunkIndex: 0
            },
            {
                content: 'Factor 3: Own your context window. Own your context building. Context Engineering? Jump straight to factor 3',
                chunkIndex: 1
            },
            {
                content: 'What are the principles we can use to build LLM-powered software that is actually good enough to put in the hands of production customers? Welcome to 12-factor agents.',
                chunkIndex: 2
            },
            {
                content: 'The fastest way I\'ve seen for builders to get good AI software in the hands of customers is to take small, modular concepts from agent building, and incorporate them into their existing product',
                chunkIndex: 3
            },
            {
                content: 'Factor 8: Own your control flow. Factor 9: Compact Errors into Context Window. Factor 10: Small, Focused Agents',
                chunkIndex: 4
            }
        ]

        // Generate embeddings and insert into TurboPuffer
        const chunksWithEmbeddings = await Promise.all(
            chunks.map(async (chunk) => {
                const embeddingResult = await embed({
                    model: geminiEmbedding,
                    value: chunk.content,
                    providerOptions: {
                        google: {
                            taskType: 'RETRIEVAL_DOCUMENT'
                        }
                    }
                })

                return {
                    chunkIndex: chunk.chunkIndex,
                    embedding: embeddingResult.embedding,
                    documentPath: testDocPath,
                    content: chunk.content,
                    contextualizedContent: chunk.content, // In real pipeline this would be contextualized
                    metadata: document.metadata
                }
            })
        )

        await upsertIntoTurboPuffer({
            organizationId,
            namespaceId,
            chunks: chunksWithEmbeddings
        })

        // Query 1: Search for "context window" content
        const contextWindowQuery = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'context window'
            },
            topK: 5
        })

        expect(contextWindowQuery).toBeDefined()
        expect(contextWindowQuery.length).toBeGreaterThan(0)
        
        // Should find the chunk about Factor 3: Own your context window
        const contextWindowResult = contextWindowQuery.find((result: any) => 
            result.content.includes('Factor 3: Own your context window')
        )
        expect(contextWindowResult).toBeDefined()

        // Query 2: Search for "directed graphs DAGs" content
        const graphQuery = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'directed graphs DAGs software'
            },
            topK: 5
        })

        expect(graphQuery).toBeDefined()
        expect(graphQuery.length).toBeGreaterThan(0)
        
        // Should find the chunk about directed graphs
        const graphResult = graphQuery.find((result: any) => 
            result.content.includes('Directed Graphs (DGs) and their Acyclic friends, DAGs')
        )
        expect(graphResult).toBeDefined()

        // Query 3: Vector search for "12 factor principles" 
        const vectorQueryResult = await embed({
            model: geminiEmbedding,
            value: '12 factor principles for building agents',
            providerOptions: {
                google: {
                    taskType: 'RETRIEVAL_QUERY'
                }
            }
        })

        const vectorSearchResults = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                vectorQuery: vectorQueryResult.embedding
            },
            topK: 5
        })

        expect(vectorSearchResults).toBeDefined()
        expect(vectorSearchResults.length).toBeGreaterThan(0)
        
        // Should find chunks related to 12-factor agents principles
        const principlesResult = vectorSearchResults.find((result: any) => 
            result.content.includes('principles we can use to build LLM-powered software')
        )
        expect(principlesResult).toBeDefined()

        // Query 4: Hybrid search (text + vector)
        const hybridEmbeddingResult = await embed({
            model: geminiEmbedding,
            value: 'small modular concepts',
            providerOptions: {
                google: {
                    taskType: 'RETRIEVAL_QUERY'
                }
            }
        })

        const hybridResults = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'modular concepts',
                vectorQuery: hybridEmbeddingResult.embedding
            },
            topK: 5
        })

        expect(hybridResults).toBeDefined()
        
        // With hybrid search, we should get results from both queries
        // The multiQuery returns an object with results from each query type
        if ('results' in hybridResults) {
            expect(hybridResults.results).toBeDefined()
            expect(hybridResults.results.length).toBeGreaterThan(0)
        }

        await cleanup()
    }, 60000) // 60 second timeout for this test

    test('should handle queries with no results gracefully', async () => {
        await cleanup()

        // Query for something that shouldn't exist
        const noResultsQuery = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'quantum blockchain cryptocurrency NFT metaverse'
            },
            topK: 5
        })

        expect(noResultsQuery).toBeDefined()
        // Should return empty array or have no results
        if (Array.isArray(noResultsQuery)) {
            expect(noResultsQuery.length).toBe(0)
        } else if ('results' in noResultsQuery) {
            expect(noResultsQuery.results.length).toBe(0)
        }

        await cleanup()
    })

    test('should respect topK parameter', async () => {
        await cleanup()

        // First, ingest some test data
        const chunks = Array.from({ length: 10 }, (_, i) => ({
            chunkIndex: i,
            embedding: Array(1536).fill(0).map(() => Math.random()),
            documentPath: testDocPath,
            content: `Test chunk ${i} with some content about agents and LLMs`,
            contextualizedContent: `Test chunk ${i} with some content about agents and LLMs`,
            metadata: { index: i }
        }))

        await upsertIntoTurboPuffer({
            organizationId,
            namespaceId,
            chunks
        })

        // Query with topK=3
        const topK3Results = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'agents LLMs'
            },
            topK: 3
        })

        if (Array.isArray(topK3Results)) {
            expect(topK3Results.length).toBeLessThanOrEqual(3)
        }

        // Query with topK=7
        const topK7Results = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'agents LLMs'
            },
            topK: 7
        })

        if (Array.isArray(topK7Results)) {
            expect(topK7Results.length).toBeLessThanOrEqual(7)
        }

        await cleanup()
    })
})