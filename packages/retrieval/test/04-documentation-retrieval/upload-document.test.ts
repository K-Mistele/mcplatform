import { InngestTestEngine } from '@inngest/test'
import { beforeAll, describe, expect, test } from 'bun:test'
import { Inngest } from 'inngest'
import { uploadDocument } from '../../src/inngest-functions/upload-document'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: process.env.INNGEST_BASE_URL!
})

describe('Inngest Functions', async () => {
    beforeAll(async () => {
        // Wait for inngest connection
        console.log('Waiting for inngest connection...')
        await inngestClient.ready
        console.log('Inngest connection established')
    })

    describe('upload-document', async () => {
        const t = new InngestTestEngine({
            function: uploadDocument(inngestClient)
        })

        test('should fail without parameters', async () => {
            const result = await t.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {}
                    }
                ]
            })

            expect(result.error).toBeDefined()
            expect(result).not.toHaveProperty('result')
        })

        test('should fail without namespaceId', async () => {
            const result = await t.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            documentPath: 'test-file.md',
                            documentBufferBase64: 'test-buffer'
                        }
                    }
                ]
            })

            expect(result.error).toBeDefined()
            expect(result).not.toHaveProperty('result')
        })
        test('should fail without documentPath', async () => {
            const result = await t.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            namespaceId: 'test-namespace',
                            documentBufferBase64: 'test-buffer'
                        }
                    }
                ]
            })

            expect(result.error).toBeDefined()
            expect(result).not.toHaveProperty('result')
        })

        test('should fail without documentBufferBase64', async () => {
            const result = await t.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            namespaceId: 'test-namespace',
                            documentPath: 'test-file.md'
                        }
                    }
                ]
            })

            expect(result.error).toBeDefined()
            expect(result).not.toHaveProperty('result')
        })

        test('should succeeed with valid parameters', async () => {
            const result = await t.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            namespaceId: 'test-namespace',
                            documentPath: 'test-file.md',
                            documentBufferBase64: 'test-buffer'
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')
        })
    })
})
