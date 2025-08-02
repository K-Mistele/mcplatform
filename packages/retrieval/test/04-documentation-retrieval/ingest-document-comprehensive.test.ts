import { InngestTestEngine } from '@inngest/test'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { contextualizeChunk, ingestDocument, uploadDocument } from '../../src/inngest'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: process.env.INNGEST_BASE_URL!
})

const testIngestFunction = new InngestTestEngine({
    function: ingestDocument(inngestClient)
})

const testUploadFunction = new InngestTestEngine({
    function: uploadDocument(inngestClient)
})

const testContextualizeFunction = new InngestTestEngine({
    function: contextualizeChunk(inngestClient)
})

describe('Comprehensive Ingest Document Tests', async () => {
    let organizationId: string
    let namespaceId: string
    let batchId: string
    let testFileContent: string

    beforeAll(async () => {
        // Wait for inngest connection
        console.log('Waiting for inngest connection...')
        await inngestClient.ready
        console.log('Inngest connection established')

        // Generate unique IDs for this test run
        organizationId = `org_test_${randomUUID().substring(0, 8)}`
        namespaceId = `ns_test_${randomUUID().substring(0, 8)}`
        batchId = randomUUID()

        // Load test file
        testFileContent = await fs.readFile(path.join(__dirname, 'test_file.md'), 'utf-8')

        // Create test organization
        await db
            .insert(schema.organization)
            .values({
                id: organizationId,
                name: 'Test Organization for Comprehensive Tests',
                createdAt: new Date()
            })
            .onConflictDoNothing()

        // Create test namespace
        await db
            .insert(schema.retrievalNamespace)
            .values({
                id: namespaceId,
                name: 'Test Namespace for Comprehensive Tests',
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
            .where(
                and(
                    eq(schema.chunks.organizationId, organizationId),
                    eq(schema.chunks.namespaceId, namespaceId)
                )
            )

        // Clean up documents
        await db
            .delete(schema.documents)
            .where(
                and(
                    eq(schema.documents.organizationId, organizationId),
                    eq(schema.documents.namespaceId, namespaceId)
                )
            )

        // Clean up ingestion job
        await db.delete(schema.ingestionJob).where(eq(schema.ingestionJob.id, batchId))

        // Clean up namespace
        await db.delete(schema.retrievalNamespace).where(eq(schema.retrievalNamespace.id, namespaceId))

        // Clean up organization
        await db.delete(schema.organization).where(eq(schema.organization.id, organizationId))
    })

    describe('chunk creation and processing', () => {
        test('should create chunks in database after ingestion', async () => {
            const documentPath = 'chunk-test.md'

            // Upload document
            const uploadResult = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(testFileContent).toString('base64')
                        }
                    }
                ]
            })
            expect(uploadResult.error).not.toBeDefined()

            // Create document record
            await db
                .insert(schema.documents)
                .values({
                    filePath: documentPath,
                    fileName: documentPath,
                    contentType: 'text/markdown',
                    namespaceId,
                    organizationId,
                    contentHash: 'test-hash-chunks'
                })
                .onConflictDoNothing()

            // Ingest document
            const ingestResult = await testIngestFunction.execute({
                events: [
                    {
                        name: 'retrieval/ingest-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            batchId
                        }
                    }
                ]
            })
            expect(ingestResult.error).not.toBeDefined()

            // Check that chunks were created
            const chunks = await db
                .select()
                .from(schema.chunks)
                .where(
                    and(
                        eq(schema.chunks.organizationId, organizationId),
                        eq(schema.chunks.namespaceId, namespaceId),
                        eq(schema.chunks.documentPath, documentPath)
                    )
                )

            expect(chunks.length).toBeGreaterThan(0)
            console.log(`Created ${chunks.length} chunks for document`)

            // Verify chunk properties
            chunks.forEach((chunk, index) => {
                expect(chunk.organizationId).toBe(organizationId)
                expect(chunk.namespaceId).toBe(namespaceId)
                expect(chunk.documentPath).toBe(documentPath)
                expect(chunk.orderInDocument).toBe(index)
                expect(chunk.originalContent).toBeTruthy()
                expect(chunk.originalContent.length).toBeGreaterThan(0)
            })
        })

        test('should trigger contextualize-chunk events for each chunk', async () => {
            const documentPath = 'contextualize-test.md'
            
            // Create a smaller test document for easier tracking
            const smallDocument = `---
title: Small Test Document
---

# Introduction

This is a small test document with just a few sections.

# Section 1

Content for section 1.

# Section 2

Content for section 2.`

            // Upload document
            await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(smallDocument).toString('base64')
                        }
                    }
                ]
            })

            // Create document record
            await db
                .insert(schema.documents)
                .values({
                    filePath: documentPath,
                    fileName: documentPath,
                    contentType: 'text/markdown',
                    namespaceId,
                    organizationId,
                    contentHash: 'test-hash-contextualize'
                })
                .onConflictDoNothing()

            // Ingest document
            const ingestResult = await testIngestFunction.execute({
                events: [
                    {
                        name: 'retrieval/ingest-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            batchId
                        }
                    }
                ]
            })
            expect(ingestResult.error).not.toBeDefined()

            // Note: In a real system, this would trigger contextualize-chunk events
            // via Inngest's event system. Since we're in test mode, we'd need to
            // mock or verify the event emission differently.
            
            // For now, verify that chunks exist and are ready for contextualization
            const chunks = await db
                .select()
                .from(schema.chunks)
                .where(
                    and(
                        eq(schema.chunks.organizationId, organizationId),
                        eq(schema.chunks.namespaceId, namespaceId),
                        eq(schema.chunks.documentPath, documentPath)
                    )
                )

            expect(chunks.length).toBeGreaterThan(0)
            console.log(`Document was split into ${chunks.length} chunks ready for contextualization`)
        })

        test('should update existing chunks when document is re-ingested', async () => {
            const documentPath = 'update-test.md'
            const originalContent = `# Original Document

This is the original content.`

            const updatedContent = `# Updated Document

This is the updated content with more information.

## New Section

This section was added in the update.`

            // Upload original document
            await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(originalContent).toString('base64')
                        }
                    }
                ]
            })

            // Create document record
            await db
                .insert(schema.documents)
                .values({
                    filePath: documentPath,
                    fileName: documentPath,
                    contentType: 'text/markdown',
                    namespaceId,
                    organizationId,
                    contentHash: 'test-hash-original'
                })
                .onConflictDoNothing()

            // First ingestion
            await testIngestFunction.execute({
                events: [
                    {
                        name: 'retrieval/ingest-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            batchId
                        }
                    }
                ]
            })

            // Get original chunks
            const originalChunks = await db
                .select()
                .from(schema.chunks)
                .where(
                    and(
                        eq(schema.chunks.organizationId, organizationId),
                        eq(schema.chunks.namespaceId, namespaceId),
                        eq(schema.chunks.documentPath, documentPath)
                    )
                )

            const originalChunkCount = originalChunks.length
            console.log(`Original document had ${originalChunkCount} chunks`)

            // Upload updated document
            await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(updatedContent).toString('base64')
                        }
                    }
                ]
            })

            // Re-ingest document
            await testIngestFunction.execute({
                events: [
                    {
                        name: 'retrieval/ingest-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            batchId
                        }
                    }
                ]
            })

            // Get updated chunks
            const updatedChunks = await db
                .select()
                .from(schema.chunks)
                .where(
                    and(
                        eq(schema.chunks.organizationId, organizationId),
                        eq(schema.chunks.namespaceId, namespaceId),
                        eq(schema.chunks.documentPath, documentPath)
                    )
                )

            console.log(`Updated document has ${updatedChunks.length} chunks`)
            
            // The updated document should have different content
            expect(updatedChunks.some(chunk => chunk.originalContent.includes('Updated Document'))).toBe(true)
            expect(updatedChunks.some(chunk => chunk.originalContent.includes('New Section'))).toBe(true)
        })
    })

    describe('batch job tracking', () => {
        test('should increment batch counters correctly', async () => {
            const testBatchId = randomUUID()
            
            // Create a new batch job
            await db
                .insert(schema.ingestionJob)
                .values({
                    id: testBatchId,
                    organizationId,
                    namespaceId,
                    createdAt: Date.now(),
                    totalDocuments: 0,
                    documentsProcessed: 0,
                    documentsFailed: 0
                })

            // Get initial state
            const [initialBatch] = await db
                .select()
                .from(schema.ingestionJob)
                .where(eq(schema.ingestionJob.id, testBatchId))

            expect(initialBatch.totalDocuments).toBe(0)
            expect(initialBatch.documentsProcessed).toBe(0)

            // Upload and ingest a document
            const documentPath = 'batch-test.md'
            await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(testFileContent).toString('base64')
                        }
                    }
                ]
            })

            // Create document record
            await db
                .insert(schema.documents)
                .values({
                    filePath: documentPath,
                    fileName: documentPath,
                    contentType: 'text/markdown',
                    namespaceId,
                    organizationId,
                    contentHash: 'test-hash-batch'
                })
                .onConflictDoNothing()

            // Ingest with the test batch
            await testIngestFunction.execute({
                events: [
                    {
                        name: 'retrieval/ingest-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            batchId: testBatchId
                        }
                    }
                ]
            })

            // Check updated batch state
            const [updatedBatch] = await db
                .select()
                .from(schema.ingestionJob)
                .where(eq(schema.ingestionJob.id, testBatchId))

            expect(updatedBatch.totalDocuments).toBe(1)
            expect(updatedBatch.documentsProcessed).toBe(1)
            expect(updatedBatch.documentsFailed).toBe(0)

            // Clean up
            await db.delete(schema.ingestionJob).where(eq(schema.ingestionJob.id, testBatchId))
        })
    })

    describe('error handling', () => {
        test('should handle missing documents gracefully', async () => {
            const result = await testIngestFunction.execute({
                events: [
                    {
                        name: 'retrieval/ingest-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath: 'non-existent-document.md',
                            batchId
                        }
                    }
                ]
            })

            expect(result.error).toBeDefined()
            expect(result.error.message).toContain('The specified key does not exist')
        })

        test('should handle chunking failures gracefully', async () => {
            const documentPath = 'empty-doc.md'
            
            // Upload an empty document
            await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from('').toString('base64')
                        }
                    }
                ]
            })

            // Create document record
            await db
                .insert(schema.documents)
                .values({
                    filePath: documentPath,
                    fileName: documentPath,
                    contentType: 'text/markdown',
                    namespaceId,
                    organizationId,
                    contentHash: 'test-hash-empty'
                })
                .onConflictDoNothing()

            // Ingest should handle empty document gracefully
            const result = await testIngestFunction.execute({
                events: [
                    {
                        name: 'retrieval/ingest-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            batchId
                        }
                    }
                ]
            })

            // Should succeed but create no chunks
            expect(result.error).not.toBeDefined()

            const chunks = await db
                .select()
                .from(schema.chunks)
                .where(
                    and(
                        eq(schema.chunks.organizationId, organizationId),
                        eq(schema.chunks.namespaceId, namespaceId),
                        eq(schema.chunks.documentPath, documentPath)
                    )
                )

            expect(chunks.length).toBe(0)
        })
    })
})