import { InngestTestEngine } from '@inngest/test'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { ingestDocument } from '../../src/inngest'
import { nukeTurbopufferNamespace } from '../../src/turbopuffer'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: process.env.INNGEST_BASE_URL!
})

const testIngestFunction = new InngestTestEngine({
    function: ingestDocument(inngestClient)
})

describe('Inngest Functions', async () => {
    beforeAll(async () => {
        // Wait for inngest connection
        console.log('Waiting for inngest connection...')
        await inngestClient.ready
        console.log('Inngest connection established')
    })

    describe('ingest-document', async () => {
        describe('input validation', () => {
            test('should fail without parameters', async () => {
                const result = await testIngestFunction.execute({
                    events: [{ data: {}, name: 'retrieval/ingest-document' }]
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
                                batchId: '789',
                                documentBufferBase64: ''
                            },
                            name: 'retrieval/ingest-document'
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
                await db
                    .insert(schema.retrievalNamespace)
                    .values({
                        id: namespaceId,
                        name: 'Test Namespace',
                        organizationId,
                        createdAt: Date.now()
                    })
                    .onConflictDoNothing()
                await db
                    .insert(schema.ingestionJob)
                    .values({
                        id: batchId,
                        organizationId,
                        namespaceId,
                        createdAt: Date.now()
                    })
                    .onConflictDoNothing()
                // Document will be uploaded as part of ingestion now
            })

            afterAll(async () => {
                // Clean up turbopuffer namespace
                await nukeTurbopufferNamespace({ organizationId, namespaceId })

                await Promise.all([
                    db.delete(schema.organization).where(eq(schema.organization.id, organizationId)),
                    db.delete(schema.retrievalNamespace).where(eq(schema.retrievalNamespace.id, namespaceId)),
                    db.delete(schema.ingestionJob).where(eq(schema.ingestionJob.id, batchId)),
                    db.delete(schema.documents).where(eq(schema.documents.namespaceId, namespaceId)),
                    db.delete(schema.chunks).where(eq(schema.chunks.namespaceId, namespaceId))
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
                                batchId,
                                documentBufferBase64: Buffer.from('fake pdf content').toString('base64')
                            }
                        }
                    ]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should skip if the document is image (not supported)', async () => {
                console.log('starting image (expected to skip) image')
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.png',
                                batchId,
                                documentBufferBase64: Buffer.from('fake png content').toString('base64')
                            }
                        }
                    ]
                })
                console.log('result', result)

                // Images are skipped, not failed
                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })

            // TODO This is where we are looping
            test('should succeed for .md file', async () => {
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.md',
                                batchId,
                                documentBufferBase64: documentContents
                            }
                        }
                    ]
                })

                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })

            test.skip('should succeed for .md file with front matter', async () => {
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file2.md',
                                batchId,
                                documentBufferBase64: documentContents
                            }
                        }
                    ]
                })

                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })

            test.skip('should succeed for .mdx file with front matter and title', async () => {
                const result = await testIngestFunction.execute({
                    events: [
                        {
                            name: 'retrieval/ingest-document',
                            data: {
                                organizationId,
                                namespaceId,
                                documentPath: 'test-file.mdx',
                                batchId,
                                documentBufferBase64: documentContents
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
