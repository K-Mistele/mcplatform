import { InngestTestEngine } from '@inngest/test'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'
import {
    type ContextualizeChunkResult,
    contextualizeChunk,
    ingestDocument,
    uploadDocument
} from '../../src/inngest-functions'
import { getDocumentFromCache, redisClient, setDocumentInCache } from '../../src/redis'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: process.env.INNGEST_BASE_URL!
})

// Track created resources for cleanup
const createdResources = {
    organizations: new Set<string>(),
    namespaces: new Set<string>(),
    chunks: new Set<{ organizationId: string; namespaceId: string; documentPath: string; orderInDocument: number }>()
}

describe('Inngest Functions', async () => {
    beforeAll(async () => {
        // Wait for inngest connection
        console.log('Waiting for inngest connection...')
        await inngestClient.ready
        console.log('Inngest connection established')
    })

    afterAll(async () => {
        console.log('Cleaning up chunks...')
        // Clean up chunks first (they reference organizations and namespaces)
        for (const chunk of createdResources.chunks.values()) {
            await db
                .delete(schema.chunks)
                .where(
                    and(
                        eq(schema.chunks.organizationId, chunk.organizationId),
                        eq(schema.chunks.namespaceId, chunk.namespaceId),
                        eq(schema.chunks.documentPath, chunk.documentPath),
                        eq(schema.chunks.orderInDocument, chunk.orderInDocument)
                    )
                )
        }

        console.log('Cleaning up namespaces...')

        // Clean up namespaces
        for (const namespaceId of createdResources.namespaces) {
            await db.delete(schema.retrievalNamespace).where(eq(schema.retrievalNamespace.id, namespaceId))
        }

        console.log('Cleaning up organizations...')

        // Clean up organizations
        for (const orgId of createdResources.organizations) {
            await db.delete(schema.organization).where(eq(schema.organization.id, orgId))
        }

        console.log('Cleaning up Redis cache...')

        // Clean up Redis cache
        const keys = await redisClient.keys('document:*')
        console.log('cleaning up redis keys', keys)
        if (keys.length > 0) {
            await redisClient.del(...keys)
        }
    })

    describe('contextualize-chunk', async () => {
        const testContextualizeFunction = new InngestTestEngine({
            function: contextualizeChunk(inngestClient)
        })

        const testUploadFunction = new InngestTestEngine({
            function: uploadDocument(inngestClient)
        })

        const testIngestDocumentFunction = new InngestTestEngine({
            function: ingestDocument(inngestClient)
        })

        describe('input validation', () => {
            beforeAll(async () => console.log('input validation...'))

            test('should fail without parameters', async () => {
                const result = await testContextualizeFunction.execute({
                    events: [{ data: {}, name: 'retrieval/contextualize-chunk' }]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail with invalid parameters', async () => {
                const result = await testContextualizeFunction.execute({
                    events: [
                        {
                            data: {
                                organizationId: '123',
                                namespaceId: '456',
                                documentPath: 'test.md',
                                chunkIndex: 'not-a-number', // Invalid type
                                chunkContent: 'test content'
                            },
                            name: 'retrieval/contextualize-chunk'
                        }
                    ]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail with missing chunkContent', async () => {
                const result = await testContextualizeFunction.execute({
                    events: [
                        {
                            data: {
                                organizationId: '123',
                                namespaceId: '456',
                                documentPath: 'test.md',
                                chunkIndex: 0
                            },
                            name: 'retrieval/contextualize-chunk'
                        }
                    ]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })
        })

        describe('document caching and retrieval', async () => {
            beforeAll(async () => console.log('document caching and retrieval...'))

            const organizationId = `org_test_${randomUUID().substring(0, 8)}`
            const namespaceId = `ns_ctx_${randomUUID().substring(0, 8)}`
            const documentPath = 'test-document.md'
            const documentContent = `---
title: Test Document
description: A test document for contextualization
---

# Test Document

This is a test document with multiple sections.

## Section 1

This section contains information about feature A.

## Section 2

This section contains information about feature B.`

            beforeAll(async () => {
                // Create test organization
                await db
                    .insert(schema.organization)
                    .values({
                        id: organizationId,
                        name: 'Test Organization',
                        createdAt: new Date()
                    })
                    .onConflictDoNothing()
                createdResources.organizations.add(organizationId)

                // Create test namespace
                await db
                    .insert(schema.retrievalNamespace)
                    .values({
                        id: namespaceId,
                        name: 'Test Namespace',
                        organizationId,
                        createdAt: Date.now()
                    })
                    .onConflictDoNothing()
                createdResources.namespaces.add(namespaceId)

                // Upload document to S3
                const uploadResult = await testUploadFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath,
                                documentBufferBase64: Buffer.from(documentContent).toString('base64')
                            }
                        }
                    ]
                })
                expect(uploadResult.error).not.toBeDefined()
            })

            test('should get document from cache when available', async () => {
                // Set document in cache
                await setDocumentInCache(organizationId, namespaceId, documentPath, documentContent, 'text')

                const { ctx, result } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath,
                                chunkIndex: 0,
                                chunkContent: 'This section contains information about feature A.'
                            }
                        }
                    ]
                })

                // Verify cache was checked
                expect(ctx.step.run).toHaveBeenCalledWith('maybe-get-document-from-cache', expect.any(Function))

                // Verify S3 was NOT called since document was in cache
                expect(ctx.step.run).not.toHaveBeenCalledWith('get-document-from-s3', expect.any(Function))

                // Verify contextualization happened
                expect(ctx.step.run).toHaveBeenCalledWith('contextualize-chunk', expect.any(Function))

                // Verify chunk was updated
                expect(ctx.step.run).toHaveBeenCalledWith('update-chunk', expect.any(Function))

                // Verify result
                expect(result).toBeDefined()
                const resultData = result as ContextualizeChunkResult
                expect(resultData.organizationId).toBe(organizationId)
                expect(resultData.namespaceId).toBe(namespaceId)
                expect(resultData.documentPath).toBe(documentPath)
                expect(resultData.chunkIndex).toBe(0)
                expect(resultData.chunkContent).toBe('This section contains information about feature A.')
                expect(resultData.chunkContextualizedContent).toBeDefined()
                expect(resultData.chunkContextualizedContent.length).toBeGreaterThan(0)

                // Track chunk for cleanup
                createdResources.chunks.add({
                    organizationId,
                    namespaceId,
                    documentPath,
                    orderInDocument: 0
                })
            })

            test('should get document from S3 when not in cache', async () => {
                const uniqueDocPath = `uncached-${Date.now()}.md`

                // Upload document first
                await testUploadFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: uniqueDocPath,
                                documentBufferBase64: Buffer.from(documentContent).toString('base64')
                            }
                        }
                    ]
                })

                // Ensure it's not in cache
                const cacheKey = `document:${organizationId}:${namespaceId}:${uniqueDocPath}`
                await redisClient.del(cacheKey)

                const { ctx, result } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: uniqueDocPath,
                                chunkIndex: 1,
                                chunkContent: 'This section contains information about feature B.'
                            }
                        }
                    ]
                })

                // Verify cache was checked
                expect(ctx.step.run).toHaveBeenCalledWith('maybe-get-document-from-cache', expect.any(Function))

                // Verify S3 WAS called since document was not in cache
                expect(ctx.step.run).toHaveBeenCalledWith('get-document-from-s3', expect.any(Function))

                // Verify document was cached after retrieval
                expect(ctx.step.run).toHaveBeenCalledWith('set-document-in-cache', expect.any(Function))

                // Verify contextualization happened
                expect(ctx.step.run).toHaveBeenCalledWith('contextualize-chunk', expect.any(Function))

                // Verify chunk was updated
                expect(ctx.step.run).toHaveBeenCalledWith('update-chunk', expect.any(Function))

                // Verify result
                expect(result).toBeDefined()
                const resultData = result as ContextualizeChunkResult
                expect(resultData.chunkIndex).toBe(1)
                expect(resultData.chunkContextualizedContent).toBeDefined()

                // Verify document is now in cache
                const cachedDoc = await getDocumentFromCache(organizationId, namespaceId, uniqueDocPath)
                expect(cachedDoc).toBeDefined()
                expect(cachedDoc?.type).toBe('text')
                expect(cachedDoc?.content).toBe(documentContent)

                // Track chunk for cleanup
                createdResources.chunks.add({
                    organizationId,
                    namespaceId,
                    documentPath: uniqueDocPath,
                    orderInDocument: 1
                })
            })

            test('should fail when document not found in S3', async () => {
                // Clear cache
                await redisClient.del(`document:${organizationId}:${namespaceId}:non-existent.md`)

                const result = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'non-existent.md',
                                chunkIndex: 0,
                                chunkContent: 'Some content'
                            }
                        }
                    ]
                })

                expect(result.error).toBeDefined()
                expect((result.error as Error).message).toContain('Failed to get document from S3')
            })

            test('should fail for binary documents in cache', async () => {
                const binaryPath = 'test-image.png'

                // Set binary document in cache
                await setDocumentInCache(
                    organizationId,
                    namespaceId,
                    binaryPath,
                    Buffer.from('fake-image-data'),
                    'binary'
                )

                const result = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: binaryPath,
                                chunkIndex: 0,
                                chunkContent: 'Some content'
                            }
                        }
                    ]
                })

                expect(result.error).toBeDefined()
                expect((result.error as Error).message).toContain('Unsupported document type (binary)')
            })
        })

        describe('chunk storage and updates', async () => {
            const organizationId = `org_test_${randomUUID().substring(0, 8)}`
            const namespaceId = `ns_storage_${randomUUID().substring(0, 8)}`
            const documentPath = 'storage-test.md'
            const documentContent = `# Storage Test Document

This document tests chunk storage and updates.`
            beforeAll(async () => console.log('chunk storage and updates...'))

            beforeAll(async () => {
                // Create test organization
                await db
                    .insert(schema.organization)
                    .values({
                        id: organizationId,
                        name: 'Test Organization Storage',
                        createdAt: new Date()
                    })
                    .onConflictDoNothing()
                createdResources.organizations.add(organizationId)

                // Create test namespace
                await db
                    .insert(schema.retrievalNamespace)
                    .values({
                        id: namespaceId,
                        name: 'Test Namespace Storage',
                        organizationId,
                        createdAt: Date.now()
                    })
                    .onConflictDoNothing()
                createdResources.namespaces.add(namespaceId)

                // Upload document and set in cache
                const uploadResult = await testUploadFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath,
                                documentBufferBase64: Buffer.from(documentContent).toString('base64')
                            }
                        }
                    ]
                })
                expect(uploadResult.error).not.toBeDefined()

                await setDocumentInCache(organizationId, namespaceId, documentPath, documentContent, 'text')
            })

            test('should create new chunk in database', async () => {
                const chunkContent = 'This document tests chunk storage and updates.'

                const { result } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath,
                                chunkIndex: 0,
                                chunkContent
                            }
                        }
                    ]
                })

                expect(result).toBeDefined()

                // Verify chunk was created in database
                const [chunk] = await db
                    .select()
                    .from(schema.chunks)
                    .where(
                        and(
                            eq(schema.chunks.organizationId, organizationId),
                            eq(schema.chunks.namespaceId, namespaceId),
                            eq(schema.chunks.documentPath, documentPath),
                            eq(schema.chunks.orderInDocument, 0)
                        )
                    )

                expect(chunk).toBeDefined()
                const resultData = result as ContextualizeChunkResult
                expect(chunk?.originalContent).toBe(chunkContent)
                expect(chunk?.contextualizedContent).toBe(resultData.chunkContextualizedContent)
                expect(chunk?.metadata).toEqual({}) // No frontmatter in this test document

                // Track for cleanup
                createdResources.chunks.add({
                    organizationId,
                    namespaceId,
                    documentPath,
                    orderInDocument: 0
                })
            })

            test('should update existing chunk with new contextualization', async () => {
                const chunkContent = 'Updated content for the same chunk.'

                // First contextualization
                const { result: firstResult } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath,
                                chunkIndex: 1,
                                chunkContent: 'Original content'
                            }
                        }
                    ]
                })

                // Second contextualization with different content
                const { result: secondResultData } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath,
                                chunkIndex: 1,
                                chunkContent
                            }
                        }
                    ]
                })

                // Verify chunk was updated, not duplicated
                const chunks = await db
                    .select()
                    .from(schema.chunks)
                    .where(
                        and(
                            eq(schema.chunks.organizationId, organizationId),
                            eq(schema.chunks.namespaceId, namespaceId),
                            eq(schema.chunks.documentPath, documentPath),
                            eq(schema.chunks.orderInDocument, 1)
                        )
                    )

                expect(chunks.length).toBe(1)
                expect(chunks[0]?.originalContent).toBe(chunkContent)
                expect(chunks[0]?.contextualizedContent).toBe(
                    (secondResultData as ContextualizeChunkResult).chunkContextualizedContent
                )

                // Track for cleanup
                createdResources.chunks.add({
                    organizationId,
                    namespaceId,
                    documentPath,
                    orderInDocument: 1
                })
            })

            test('should extract and store frontmatter metadata', async () => {
                const docWithFrontmatter = `---
title: Document with Metadata
description: Testing frontmatter extraction
tags: [test, metadata]
---

# Content

This is the actual content.`

                await setDocumentInCache(
                    organizationId,
                    namespaceId,
                    'doc-with-frontmatter.md',
                    docWithFrontmatter,
                    'text'
                )

                const { result } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'doc-with-frontmatter.md',
                                chunkIndex: 0,
                                chunkContent: 'This is the actual content.'
                            }
                        }
                    ]
                })

                // Verify chunk has metadata
                const [chunk] = await db
                    .select()
                    .from(schema.chunks)
                    .where(
                        and(
                            eq(schema.chunks.organizationId, organizationId),
                            eq(schema.chunks.namespaceId, namespaceId),
                            eq(schema.chunks.documentPath, 'doc-with-frontmatter.md'),
                            eq(schema.chunks.orderInDocument, 0)
                        )
                    )

                expect(chunk?.metadata).toBeDefined()
                expect((chunk?.metadata as Record<string, unknown>).title).toBe('Document with Metadata')
                expect((chunk?.metadata as Record<string, unknown>).description).toBe('Testing frontmatter extraction')
                expect((chunk?.metadata as Record<string, unknown>).tags).toEqual(['test', 'metadata'])

                // Track for cleanup
                createdResources.chunks.add({
                    organizationId,
                    namespaceId,
                    documentPath: 'doc-with-frontmatter.md',
                    orderInDocument: 0
                })
            })
        })
    })
})
