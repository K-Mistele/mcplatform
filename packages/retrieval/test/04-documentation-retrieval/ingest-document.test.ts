import { InngestTestEngine } from '@inngest/test'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'

import { ingestDocument } from '../../src/inngest-functions'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: 'http://localhost:8288'
})

const t = new InngestTestEngine({
    function: ingestDocument(inngestClient)
})

describe('Inngest Functions', async () => {
    beforeAll(async () => {
        // Wait for inngest connection
        await inngestClient.ready
    })

    describe('ingest-document', async () => {
        describe('input validation', () => {
            test('should fail without parameters', async () => {
                const result = await t.execute({
                    events: [{ data: {}, name: 'ingest-document' }]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail with invalid parameters', async () => {
                const result = await t.execute({
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
            let organizationId: string
            const namespaceId = 'test-namespace'
            const batchId = randomUUID()

            beforeAll(async () => {
                const [results] = await db
                    .insert(schema.organization)
                    .values({
                        name: 'test-org-inngest',
                        id: 'test-org-inngest',
                        slug: 'test-org-inngest',
                        createdAt: new Date()
                    })
                    .returning({ id: schema.organization.id })
                organizationId = results!.id
            })

            afterAll(async () => {
                await db.delete(schema.organization).where(eq(schema.organization.id, organizationId))
            })
            test('should fail for unsupported file type (pdf)', async () => {
                const result = await t.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId: 'test-org',
                                namespaceId: 'test-namespace',
                                documentPath: 'test-file.pdf',
                                batchId: randomUUID()
                            }
                        }
                    ]
                })
                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail if the document is image (not supported)', async () => {
                const result = await t.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId: 'test-org',
                                namespaceId: 'test-namespace',
                                documentPath: 'test-file.png',
                                batchId: randomUUID()
                            }
                        }
                    ]
                })

                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should fail for unsupported file type (pdf)', async () => {
                const result = await t.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId: 'test-org',
                                namespaceId: 'test-namespace',
                                documentPath: 'test-file.pdf',
                                batchId: randomUUID()
                            }
                        }
                    ]
                })

                expect(result.error).toBeDefined()
                expect(result).not.toHaveProperty('result')
            })

            test('should succeed for .md file', async () => {
                const result = await t.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId: 'test-org',
                                namespaceId: 'test-namespace',
                                documentPath: 'test-file.md',
                                batchId: randomUUID()
                            }
                        }
                    ]
                })

                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })

            test('should succeed for .md file with front matter', async () => {
                const result = await t.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId: 'test-org',
                                namespaceId: 'test-namespace',
                                documentPath: 'test-file.md',
                                batchId: randomUUID()
                            }
                        }
                    ]
                })

                expect(result.error).not.toBeDefined()
                expect(result).toHaveProperty('result')
            })

            test('should succeed for .mdx file with front matter and title', async () => {
                const result = await t.execute({
                    events: [
                        {
                            name: 'retrieval/upload-document',
                            data: {
                                organizationId: 'test-org',
                                namespaceId: 'test-namespace',
                                documentPath: 'test-file.mdx',
                                batchId: randomUUID()
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
