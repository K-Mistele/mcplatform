import { InngestTestEngine } from '@inngest/test'
import { beforeAll, describe, expect, test } from 'bun:test'
import { Inngest } from 'inngest'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { getDocumentFromS3 } from '../../src/documents'
import { uploadDocument } from '../../src/inngest'

const inngestClient = new Inngest({
    id: 'test-inngest',
    baseUrl: process.env.INNGEST_BASE_URL!
})

describe('Comprehensive Upload Document Tests', async () => {
    let testUploadFunction: InngestTestEngine
    let testFileContent: string

    beforeAll(async () => {
        // Wait for inngest connection
        console.log('Waiting for inngest connection...')
        await inngestClient.ready
        console.log('Inngest connection established')

        testUploadFunction = new InngestTestEngine({
            function: uploadDocument(inngestClient)
        })

        // Load test file
        testFileContent = await fs.readFile(path.join(__dirname, 'test_file.md'), 'utf-8')
    })

    describe('file upload validation', () => {
        test('should validate required parameters', async () => {
            // Missing organizationId
            const result1 = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            namespaceId: 'test-namespace',
                            documentPath: 'test.md',
                            documentBufferBase64: 'test'
                        } as any
                    }
                ]
            })
            expect(result1.error).toBeDefined()

            // Missing namespaceId
            const result2 = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            documentPath: 'test.md',
                            documentBufferBase64: 'test'
                        } as any
                    }
                ]
            })
            expect(result2.error).toBeDefined()

            // Missing documentPath
            const result3 = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            namespaceId: 'test-namespace',
                            documentBufferBase64: 'test'
                        } as any
                    }
                ]
            })
            expect(result3.error).toBeDefined()

            // Missing documentBufferBase64
            const result4 = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            namespaceId: 'test-namespace',
                            documentPath: 'test.md'
                        } as any
                    }
                ]
            })
            expect(result4.error).toBeDefined()
        })

        test('should handle invalid base64 content', async () => {
            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId: 'test-org',
                            namespaceId: 'test-namespace',
                            documentPath: 'test.md',
                            documentBufferBase64: 'not-valid-base64!@#$%'
                        }
                    }
                ]
            })

            // Should still succeed as Buffer.from handles invalid base64
            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')
        })
    })

    describe('file type support', () => {
        const organizationId = `org_test_${randomUUID().substring(0, 8)}`
        const namespaceId = `ns_test_${randomUUID().substring(0, 8)}`

        test('should upload markdown files (.md)', async () => {
            const documentPath = 'test-markdown.md'
            const content = '# Test Markdown\n\nThis is a test markdown file.'

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(content).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')

            // Verify file was uploaded to S3
            const s3Document = await getDocumentFromS3({
                organizationId,
                namespaceId,
                documentRelativePath: documentPath
            })

            const uploadedContent = await s3Document.transformToString()
            expect(uploadedContent).toBe(content)
        })

        test('should upload MDX files (.mdx)', async () => {
            const documentPath = 'test-mdx.mdx'
            const content = `import Component from './component'

# MDX Document

<Component />

This is an MDX file with JSX.`

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(content).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')

            // Verify file was uploaded
            const s3Document = await getDocumentFromS3({
                organizationId,
                namespaceId,
                documentRelativePath: documentPath
            })

            const uploadedContent = await s3Document.transformToString()
            expect(uploadedContent).toBe(content)
        })

        test('should upload text files (.txt)', async () => {
            const documentPath = 'test-text.txt'
            const content = 'This is a plain text file.\nWith multiple lines.'

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(content).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')
        })

        test('should upload binary files (images)', async () => {
            const documentPath = 'test-image.png'
            // Create a simple 1x1 pixel PNG
            const pngBuffer = Buffer.from([
                0x89,
                0x50,
                0x4e,
                0x47,
                0x0d,
                0x0a,
                0x1a,
                0x0a, // PNG signature
                0x00,
                0x00,
                0x00,
                0x0d,
                0x49,
                0x48,
                0x44,
                0x52, // IHDR chunk
                0x00,
                0x00,
                0x00,
                0x01,
                0x00,
                0x00,
                0x00,
                0x01,
                0x08,
                0x02,
                0x00,
                0x00,
                0x00,
                0x90,
                0x77,
                0x53,
                0xde,
                0x00,
                0x00,
                0x00,
                0x0c,
                0x49,
                0x44,
                0x41, // IDAT chunk
                0x54,
                0x08,
                0xd7,
                0x63,
                0xf8,
                0xcf,
                0xc0,
                0x00,
                0x00,
                0x03,
                0x01,
                0x01,
                0x00,
                0x18,
                0xdd,
                0x8d,
                0xb4,
                0x00,
                0x00,
                0x00,
                0x00,
                0x49,
                0x45,
                0x4e, // IEND chunk
                0x44,
                0xae,
                0x42,
                0x60,
                0x82
            ])

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: pngBuffer.toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')

            // Verify binary file was uploaded correctly
            const s3Document = await getDocumentFromS3({
                organizationId,
                namespaceId,
                documentRelativePath: documentPath
            })

            const uploadedBuffer = Buffer.from(await s3Document.transformToByteArray())
            expect(uploadedBuffer.length).toBe(pngBuffer.length)
            expect(uploadedBuffer.equals(pngBuffer)).toBe(true)
        })
    })

    describe('file size handling', () => {
        const organizationId = `org_test_${randomUUID().substring(0, 8)}`
        const namespaceId = `ns_test_${randomUUID().substring(0, 8)}`

        test('should handle empty files', async () => {
            const documentPath = 'empty-file.md'
            const content = ''

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(content).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')
        })

        test('should handle large files', async () => {
            const documentPath = 'large-file.md'
            // Create a 1MB file
            const largeContent = '# Large Document\n\n' + 'This is a test line.\n'.repeat(50000)

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(largeContent).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')

            // Verify large file was uploaded correctly
            const s3Document = await getDocumentFromS3({
                organizationId,
                namespaceId,
                documentRelativePath: documentPath
            })

            const uploadedContent = await s3Document.transformToString()
            expect(uploadedContent.length).toBe(largeContent.length)
        })
    })

    describe('path handling', () => {
        const organizationId = `org_test_${randomUUID().substring(0, 8)}`
        const namespaceId = `ns_test_${randomUUID().substring(0, 8)}`

        test('should handle nested paths', async () => {
            const documentPath = 'docs/api/reference/index.md'
            const content = '# API Reference'

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(content).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')

            // Verify nested path was preserved
            const s3Document = await getDocumentFromS3({
                organizationId,
                namespaceId,
                documentRelativePath: documentPath
            })

            const uploadedContent = await s3Document.transformToString()
            expect(uploadedContent).toBe(content)
        })

        test('should handle paths with special characters', async () => {
            const documentPath = 'docs/my-guide_v2.0.md'
            const content = '# My Guide v2.0'

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(content).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')
        })

        test('should handle paths with spaces', async () => {
            const documentPath = 'docs/my guide/getting started.md'
            const content = '# Getting Started'

            const result = await testUploadFunction.execute({
                events: [
                    {
                        name: 'retrieval/upload-document',
                        data: {
                            organizationId,
                            namespaceId,
                            documentPath,
                            documentBufferBase64: Buffer.from(content).toString('base64')
                        }
                    }
                ]
            })

            expect(result.error).not.toBeDefined()
            expect(result).toHaveProperty('result')
        })
    })

    describe('overwrite behavior', () => {
        const organizationId = `org_test_${randomUUID().substring(0, 8)}`
        const namespaceId = `ns_test_${randomUUID().substring(0, 8)}`

        test('should overwrite existing files', async () => {
            const documentPath = 'overwrite-test.md'
            const originalContent = '# Original Content'
            const updatedContent = '# Updated Content\n\nThis content has been updated.'

            // Upload original file
            const result1 = await testUploadFunction.execute({
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
            expect(result1.error).not.toBeDefined()

            // Verify original content
            const s3Document1 = await getDocumentFromS3({
                organizationId,
                namespaceId,
                documentRelativePath: documentPath
            })
            expect(await s3Document1.transformToString()).toBe(originalContent)

            // Upload updated file (should overwrite)
            const result2 = await testUploadFunction.execute({
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
            expect(result2.error).not.toBeDefined()

            // Verify updated content
            const s3Document2 = await getDocumentFromS3({
                organizationId,
                namespaceId,
                documentRelativePath: documentPath
            })
            expect(await s3Document2.transformToString()).toBe(updatedContent)
        })
    })
})
