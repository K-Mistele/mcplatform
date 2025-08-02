import { InngestTestEngine } from '@inngest/test'
import { embed } from 'ai'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { geminiEmbedding } from '../../src/inference'
import { type IngestDocumentEvent, type UploadDocumentEvent, ingestDocument, uploadDocument } from '../../src/inngest'
import { searchTurboPuffer, turboPuffer } from '../../src/turbopuffer'

const inngestClient = new Inngest({
    id: 'test-inngest-query',
    baseUrl: process.env.INNGEST_BASE_URL!
})

const testUploadFunction = new InngestTestEngine({
    function: uploadDocument(inngestClient)
})

const testIngestFunction = new InngestTestEngine({
    function: ingestDocument(inngestClient)
})

describe('Query Ingested Document', async () => {
    let organizationId: string
    let namespaceId: string = 'query-ingested-document-test-ns'
    let batchId: string = randomUUID()
    const testFileContent: Buffer = await fs.readFile(path.join(__dirname, 'test_file.md'))
    const testDocPath = 'test/test_file.md'

    const getDocumentsInNamespace = async () =>
        await db
            .select()
            .from(schema.documents)
            .where(
                and(eq(schema.documents.organizationId, organizationId), eq(schema.documents.namespaceId, namespaceId))
            )

    const getChunksInNamespace = async () =>
        await db
            .select()
            .from(schema.chunks)
            .where(and(eq(schema.chunks.namespaceId, namespaceId), eq(schema.chunks.organizationId, organizationId)))

    beforeAll(async () => {
        // Wait for inngest connection
        console.log('Waiting for inngest connection...')
        await inngestClient.ready
        console.log('Inngest connection established')

        // Generate unique IDs for this test run
        organizationId = `org_test_${randomUUID().substring(0, 8)}`
        namespaceId = `ns_test_${randomUUID().substring(0, 8)}`
        batchId = randomUUID()

        // Create test organization
        await db
            .insert(schema.organization)
            .values({
                id: organizationId,
                name: 'Test Organization for Query Tests',
                createdAt: new Date()
            })
            .onConflictDoNothing()

        // Create test namespace
        await db
            .insert(schema.retrievalNamespace)
            .values({
                id: namespaceId,
                name: 'Test Namespace for Query Tests',
                organizationId,
                createdAt: Date.now()
            })
            .onConflictDoNothing()

        // Create ingestion job
        await db
            .insert(schema.ingestionJob)
            .values({
                id: batchId,
                organizationId,
                namespaceId,
                createdAt: Date.now()
            })
            .onConflictDoNothing()
    })

    afterAll(async () => {
        // Clean up chunks
        await db
            .delete(schema.chunks)
            .where(and(eq(schema.chunks.organizationId, organizationId), eq(schema.chunks.namespaceId, namespaceId)))

        // Clean up documents
        await db
            .delete(schema.documents)
            .where(
                and(eq(schema.documents.organizationId, organizationId), eq(schema.documents.namespaceId, namespaceId))
            )

        // Clean up ingestion job
        await db.delete(schema.ingestionJob).where(eq(schema.ingestionJob.id, batchId))

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

    test('should upload, ingest, and query the test document', async () => {
        expect(await getDocumentsInNamespace()).toHaveLength(0)
        expect(await getChunksInNamespace()).toHaveLength(0)
        // Step 1: Upload the document
        const uploadResult = await testUploadFunction.execute({
            events: [
                {
                    name: 'retrieval/upload-document',
                    data: {
                        organizationId,
                        namespaceId,
                        documentPath: testDocPath,
                        documentBufferBase64: testFileContent.toString('base64')
                    } satisfies UploadDocumentEvent
                }
            ]
        })

        expect(await getDocumentsInNamespace()).toHaveLength(1)
        expect(uploadResult).not.toHaveProperty('error')

        // Step 2: Ingest the document
        const ingestResult = await testIngestFunction.execute({
            events: [
                {
                    name: 'retrieval/ingest-document',
                    data: {
                        namespaceId,
                        documentPath: testDocPath,
                        organizationId,
                        batchId
                    } satisfies IngestDocumentEvent
                }
            ]
        })

        expect(ingestResult).not.toHaveProperty('error')
        expect((await getChunksInNamespace()).length).toBeGreaterThan(0)
        expect((await getDocumentsInNamespace()).length).toBe(1)

        // Step 3: Query the ingested document

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

        // Should find content about Factor 3: Own your context window
        const contextWindowResult = contextWindowQuery.find(
            (result: any) =>
                result.content?.includes('context window') || result.contextualized_content?.includes('context window')
        )
        expect(contextWindowResult).toBeDefined()

        // Query 2: Search for "directed graphs DAGs" content
        const graphQuery = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'directed graphs DAGs'
            },
            topK: 5
        })

        expect(graphQuery).toBeDefined()
        expect(graphQuery.length).toBeGreaterThan(0)

        // Should find content about directed graphs
        const graphResult = graphQuery.find(
            (result: any) =>
                result.content?.includes('Directed Graphs') ||
                result.contextualized_content?.includes('Directed Graphs')
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
        const principlesResult = vectorSearchResults.find(
            (result: any) =>
                result.content?.includes('12-factor') ||
                result.content?.includes('principles') ||
                result.contextualized_content?.includes('12-factor') ||
                result.contextualized_content?.includes('principles')
        )
        expect(principlesResult).toBeDefined()

        // Query 4: Hybrid search (text + vector)
        const hybridEmbeddingResult = await embed({
            model: geminiEmbedding,
            value: 'modular concepts agent building',
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
    }, 120000) // 2 minute timeout for this test

    test('should handle queries with no results gracefully', async () => {
        // Query for something that shouldn't exist in the document
        const noResultsQuery = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'quantum blockchain cryptocurrency NFT metaverse'
            },
            topK: 5
        })

        expect(noResultsQuery).toBeDefined()
        // Should return empty array or have very few/no relevant results
        if (Array.isArray(noResultsQuery)) {
            // If results exist, they should not be relevant to the nonsense query
            noResultsQuery.forEach((result: any) => {
                expect(result.content).not.toContain('quantum blockchain cryptocurrency')
            })
        }
    })

    test('should respect topK parameter in queries', async () => {
        // Query with topK=3
        const topK3Results = await searchTurboPuffer({
            organizationId,
            namespaceId,
            query: {
                textQuery: 'agents'
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
                textQuery: 'agents'
            },
            topK: 7
        })

        if (Array.isArray(topK7Results)) {
            expect(topK7Results.length).toBeLessThanOrEqual(7)
            // Should have more results than topK=3
            expect(topK7Results.length).toBeGreaterThanOrEqual(topK3Results.length)
        }
    })
})
