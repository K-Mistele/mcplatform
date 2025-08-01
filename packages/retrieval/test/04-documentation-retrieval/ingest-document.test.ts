import { InngestTestEngine } from '@inngest/test'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ingestDocument, uploadDocument } from '../../src/inngest-functions'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: 'http://localhost:8288'
})

const testIngestFunction = new InngestTestEngine({
    function: ingestDocument(inngestClient)
})

const testUploadFunction = new InngestTestEngine({
    function: uploadDocument(inngestClient)
})

describe('Inngest Functions', async () => {
    beforeAll(async () => {
        // Wait for inngest connection
        await inngestClient.ready
    })

    describe('ingest-document', async () => {
        describe('input validation', () => {
            test('should fail without parameters', async () => {
                const result = await testIngestFunction.execute({
                    events: [{ data: {}, name: 'ingest-document' }]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail with invalid parameters', async () => {
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            data: {
                                organizationId: '123',
                                namespaceId: '456',
                                documentPath: 'test.md',
                                batchId: '789'
                            },
                            name: 'ingest-document'
                        }
                    ]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })
        })

        describe('file types', async () => {
            const organizationId: string = `org_test_abcdefghijklmnopqrstuvwxyz`
            const namespaceId = 'test-namespace'
            const batchId = randomUUID()
            const documentContents = (await fs.readFile(path.join(__dirname, 'test_file.md'))).toString('base64')

            // Create a mock organization
            // insert files
            beforeAll(async () => {
                await db
                    .insert(schema.organization)
                    .values({
                        id: organizationId,
                        name: 'Test Organization',
                        createdAt: new Date()
                    })
                    .onConflictDoNothing()
                await db.insert(schema.retrievalNamespace).values({
                    id: namespaceId,
                    name: 'Test Namespace',
                    organizationId,
                    createdAt: Date.now()
                })
                await db.insert(schema.ingestionJob).values({
                    id: batchId,
                    organizationId,
                    namespaceId,
                    createdAt: Date.now()
                })
                const uploadResult = await testUploadFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test_file.md',
                                documentBufferBase64: documentContents
                            }
                        }
                    ]
                })

                expect(uploadResult.error).not.toBeDefined()
                expect(uploadResult).toHaveProperty('result')
            })

            afterAll(async () => {
                await Promise.all([
                    db.delete(schema.organization).where(eq(schema.organization.id, organizationId)),
                    db.delete(schema.retrievalNamespace).where(eq(schema.retrievalNamespace.id, namespaceId)),
                    db.delete(schema.ingestionJob).where(eq(schema.ingestionJob.id, batchId))
                ])
            })
            test('should fail for unsupported file type (pdf)', async () => {
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.pdf',
                                batchId
                            }
                        }
                    ]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail if the document is image (not supported)', async () => {
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.png',
                                batchId
                            }
                        }
                    ]
                })

                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail for unsupported file type (pdf)', async () => {
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.pdf',
                                batchId
                            }
                        }
                    ]
                })

                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should succeed for .md file', async () => {
                const uploadResult = await testUploadFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.md',
                                documentBufferBase64: documentContents
                            }
                        }
                    ]
                })
                expect(uploadResult.error).not.toBeDefined()
                expect(uploadResult).toHaveProperty('result')
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.md',
                                batchId
                            }
                        }
                    ]
                })

                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })

            test('should succeed for .md file with front matter', async () => {
                const uploadResult = await testUploadFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.md',
                                documentBufferBase64: documentContents
                            }
                        }
                    ]
                })
                expect(uploadResult.error).not.toBeDefined()
                expect(uploadResult).toHaveProperty('result')
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.md',
                                batchId
                            }
                        }
                    ]
                })

                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })

            test('should succeed for .mdx file with front matter and title', async () => {
                const uploadResult = await testUploadFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.mdx',
                                documentBufferBase64: documentContents
                            }
                        }
                    ]
                })
                expect(uploadResult.error).not.toBeDefined()
                expect(uploadResult).toHaveProperty('result')

                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.mdx',
                                batchId
                            }
                        }
                    ]
                })

                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })
        })
    })
})
