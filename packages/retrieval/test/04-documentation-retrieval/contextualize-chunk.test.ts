import { InngestTestEngine } from '@inngest/test'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getDocumentFromCache, setDocumentInCache, storeDocumentInS3 } from '../../src/documents'
import { type ContextualizeChunkResult, contextualizeChunk } from '../../src/inngest'
import { redisClient } from '../../src/redis'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: process.env.INNGEST_BASE_URL!
})

// Track created resources for cleanup
const createdResources = {
    organizations: new Set<string>(),
    namespaces: new Set<string>(),
    documents: new Set<{ filePath: string }>(),
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
        // Clean up chunks first (they reference documents)
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

        console.log('Cleaning up documents...')

        // Clean up documents (they reference namespaces)
        for (const doc of createdResources.documents) {
            await db.delete(schema.documents).where(eq(schema.documents.title, doc.filePath))
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
            // Delete keys individually to avoid CROSSSLOT error in Redis cluster
            for (const key of keys) {
                await redisClient.del(key)
            }
        }
    })

    describe('contextualize-chunk', async () => {
        const testContextualizeFunction = new InngestTestEngine({
            function: contextualizeChunk(inngestClient)
        })


        // Load the test file content
        let testFileContent: string
        beforeAll(async () => {
            testFileContent = await fs.readFile(path.join(__dirname, 'test_file.md'), 'utf-8')
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
            const documentPath = 'test_file.md'

            beforeAll(async () => {
                // Create test organization
                await db
                    .insert(schema.organization)
                    .values({
                        id: organizationId,
                        name: 'Test Organization',
                        slug: `test-org-${organizationId}`,
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

                // Create document in database
                await db
                    .insert(schema.documents)
                    .values({
                        filePath: documentPath,
                        title: 'test_file.md',
                        contentType: 'text/markdown',
                        namespaceId,
                        organizationId,
                        contentHash: 'test-hash'
                    })
                    .onConflictDoNothing()
                createdResources.documents.add({ filePath: documentPath })

                // Upload document to S3
                await storeDocumentInS3(Buffer.from(testFileContent), {
                    organizationId,
                    namespaceId,
                    documentRelativePath: documentPath
                })
            })

            test('should get document from cache when available', async () => {
                // Set document in cache
                await setDocumentInCache(organizationId, namespaceId, documentPath, Buffer.from(testFileContent), 'text')

                const { result } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath,
                                chunkIndex: 0,
                                chunkContent:
                                    'The promise of agents is that you get to throw the DAG away. Instead of software engineers coding each step and edge case, you can give the agent a goal and a set of transitions.'
                            }
                        }
                    ]
                })

                // Verify result
                expect(result).toBeDefined()
                const resultData = result as ContextualizeChunkResult
                expect(resultData.organizationId).toBe(organizationId)
                expect(resultData.namespaceId).toBe(namespaceId)
                expect(resultData.documentPath).toBe(documentPath)
                expect(resultData.chunkIndex).toBe(0)
                expect(resultData.chunkContent).toBe(
                    'The promise of agents is that you get to throw the DAG away. Instead of software engineers coding each step and edge case, you can give the agent a goal and a set of transitions.'
                )
                expect(resultData.chunkContextualizedContent).toBeDefined()
                expect(resultData.chunkContextualizedContent.length).toBeGreaterThan(0)

                // Print chunk and contextualized content for verification
                console.log('\n--- Test: should get document from cache when available ---')
                console.log('Original chunk:')
                console.log(resultData.chunkContent)
                console.log('\nContextualized chunk:')
                console.log(resultData.chunkContextualizedContent)
                console.log('---\n')

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

                // Create document in database
                await db
                    .insert(schema.documents)
                    .values({
                        filePath: uniqueDocPath,
                        title: uniqueDocPath,
                        contentType: 'text/markdown',
                        namespaceId,
                        organizationId,
                        contentHash: 'test-hash-unique'
                    })
                    .onConflictDoNothing()
                createdResources.documents.add({ filePath: uniqueDocPath })

                // Upload document first
                await storeDocumentInS3(Buffer.from(testFileContent), {
                    organizationId,
                    namespaceId,
                    documentRelativePath: uniqueDocPath
                })

                // Ensure it's not in cache
                const cacheKey = `document:${organizationId}:${namespaceId}:${uniqueDocPath}`
                await redisClient.del(cacheKey)

                const { result } = await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: uniqueDocPath,
                                chunkIndex: 1,
                                chunkContent:
                                    "Agents, at least the good ones, don't follow the \"here's your prompt, here's a bag of tools, loop until you hit the goal\" pattern. Rather, they are comprised of mostly just software."
                            }
                        }
                    ]
                })

                // Verify result
                expect(result).toBeDefined()
                const resultData = result as ContextualizeChunkResult
                expect(resultData.chunkIndex).toBe(1)
                expect(resultData.chunkContextualizedContent).toBeDefined()

                // Print chunk and contextualized content for verification
                console.log('\n--- Test: should get document from S3 when not in cache ---')
                console.log('Original chunk:')
                console.log(resultData.chunkContent)
                console.log('\nContextualized chunk:')
                console.log(resultData.chunkContextualizedContent)
                console.log('---\n')

                // Verify document is now in cache
                const cachedDoc = await getDocumentFromCache(organizationId, namespaceId, uniqueDocPath)
                expect(cachedDoc).toBeDefined()
                expect(cachedDoc?.type).toBe('text')
                expect(cachedDoc?.content).toBe(testFileContent)

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
                expect((result.error as Error).message).toContain('The specified key does not exist')
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
            const documentPath = 'test_file.md'
            beforeAll(async () => console.log('chunk storage and updates...'))

            beforeAll(async () => {
                // Create test organization
                await db
                    .insert(schema.organization)
                    .values({
                        id: organizationId,
                        name: 'Test Organization Storage',
                        slug: `test-org-storage-${organizationId}`,
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

                // Create document in database
                await db
                    .insert(schema.documents)
                    .values({
                        filePath: documentPath,
                        title: 'test_file.md',
                        contentType: 'text/markdown',
                        namespaceId,
                        organizationId,
                        contentHash: 'test-hash-storage'
                    })
                    .onConflictDoNothing()
                createdResources.documents.add({ filePath: documentPath })

                // Upload document and set in cache
                await storeDocumentInS3(Buffer.from(testFileContent), {
                    organizationId,
                    namespaceId,
                    documentRelativePath: documentPath
                })

                await setDocumentInCache(organizationId, namespaceId, documentPath, Buffer.from(testFileContent), 'text')
            })

            test('should create new chunk in database', async () => {
                const chunkContent =
                    'What are the principles we can use to build LLM-powered software that is actually good enough to put in the hands of production customers?'

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
                expect(chunk?.metadata).toEqual({
                    title: '12-Factor Agents - Principles for building reliable LLM applications',
                    description: 'The 12 factor agents manifesto',
                    updatedAt: '02/15/2023'
                })

                // Print chunk and contextualized content for verification
                console.log('\n--- Test: should create new chunk in database ---')
                console.log('Original chunk:')
                console.log(resultData.chunkContent)
                console.log('\nContextualized chunk:')
                console.log(resultData.chunkContextualizedContent)
                console.log('---\n')

                // Track for cleanup
                createdResources.chunks.add({
                    organizationId,
                    namespaceId,
                    documentPath,
                    orderInDocument: 0
                })
            })

            test('should update existing chunk with new contextualization', async () => {
                const chunkContent =
                    "The fastest way I've seen for builders to get good AI software in the hands of customers is to take small, modular concepts from agent building, and incorporate them into their existing product"

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
                                chunkContent:
                                    'I hope that one outcome of this post is that agent framework builders can learn from the journeys of myself and others, and make frameworks even better.'
                            }
                        }
                    ]
                })

                expect(firstResult).toBeDefined()

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

                // Print chunk and contextualized content for verification
                console.log('\n--- Test: should update existing chunk with new contextualization ---')
                console.log('First contextualization:')
                console.log('Original chunk:', (firstResult as ContextualizeChunkResult).chunkContent)
                console.log(
                    'Contextualized chunk:',
                    (firstResult as ContextualizeChunkResult).chunkContextualizedContent
                )
                console.log('\nSecond contextualization:')
                console.log('Original chunk:', (secondResultData as ContextualizeChunkResult).chunkContent)
                console.log(
                    'Contextualized chunk:',
                    (secondResultData as ContextualizeChunkResult).chunkContextualizedContent
                )
                console.log('---\n')

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
title: Custom Test Document
description: Testing custom frontmatter extraction
author: Test Author
tags: [test, metadata, custom]
---

# Custom Content

This is custom content for testing frontmatter extraction.`

                // Create document in database
                await db
                    .insert(schema.documents)
                    .values({
                        filePath: 'doc-with-frontmatter.md',
                        title: 'doc-with-frontmatter.md',
                        contentType: 'text/markdown',
                        namespaceId,
                        organizationId,
                        contentHash: 'test-hash-frontmatter'
                    })
                    .onConflictDoNothing()
                createdResources.documents.add({ filePath: 'doc-with-frontmatter.md' })

                // Upload document to S3
                await storeDocumentInS3(Buffer.from(docWithFrontmatter), {
                    organizationId,
                    namespaceId,
                    documentRelativePath: 'doc-with-frontmatter.md'
                })

                await setDocumentInCache(
                    organizationId,
                    namespaceId,
                    'doc-with-frontmatter.md',
                    docWithFrontmatter,
                    'text'
                )

                await testContextualizeFunction.execute({
                    events: [
                        {
                            name: 'retrieval/contextualize-chunk',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'doc-with-frontmatter.md',
                                chunkIndex: 0,
                                chunkContent: 'This is custom content for testing frontmatter extraction.'
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
                expect((chunk?.metadata as Record<string, unknown>).title).toBe('Custom Test Document')
                expect((chunk?.metadata as Record<string, unknown>).description).toBe(
                    'Testing custom frontmatter extraction'
                )
                expect((chunk?.metadata as Record<string, unknown>).author).toBe('Test Author')
                expect((chunk?.metadata as Record<string, unknown>).tags).toEqual(['test', 'metadata', 'custom'])

                // Print chunk and contextualized content for verification
                console.log('\n--- Test: should extract and store frontmatter metadata ---')
                console.log('Original chunk:')
                console.log('This is custom content for testing frontmatter extraction.')
                console.log('\nContextualized chunk:')
                console.log(chunk?.contextualizedContent)
                console.log('\nExtracted metadata:')
                console.log(JSON.stringify(chunk?.metadata, null, 2))
                console.log('---\n')

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
