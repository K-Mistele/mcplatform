import type { JSONValue } from 'ai'
import { db, schema } from 'database'
import { type Inngest, NonRetriableError } from 'inngest'
import z from 'zod'
import { extractFrontMatter, shouldReingestDocument, storeDocumentInS3 } from '../../documents'

export const uploadDocumentEventSchema = z.object({
    organizationId: z.string(),
    namespaceId: z.string(),
    documentPath: z.string(),
    documentBufferBase64: z.string().describe('The file buffer in base64 format')
})
export type UploadDocumentEvent = z.infer<typeof uploadDocumentEventSchema>

export const uploadDocument = (inngest: Inngest) =>
    inngest.createFunction(
        {
            id: 'upload-document',
            name: 'Upload Document'
        },
        {
            event: 'retrieval/upload-document'
        },
        async ({ event, step, logger }) => {
            const { success, data, error } = uploadDocumentEventSchema.safeParse(event.data)
            if (!data || error || !success) {
                const prettyError = z.prettifyError(error)
                logger.error(`invalid event data:\n\n${prettyError}`)
                throw new NonRetriableError(prettyError)
            }
            const documentBuffer = Buffer.from(data.documentBufferBase64, 'base64')

            const ingestionDecision = await step.run('make-reingestion-decision', async () => {
                return await shouldReingestDocument({
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentRelativePath: data.documentPath,
                    content: documentBuffer
                })
            })
            if (!ingestionDecision.shouldReingest) {
                logger.info(`document ${data.documentPath} already exists, skipping ingestion`)
                return
            }

            const uploadDocumentPromise = step.run('upload-document', async () => {
                await storeDocumentInS3(documentBuffer, {
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentRelativePath: data.documentPath
                })
            })
            const isLikelyMarkdown =
                data.documentPath.endsWith('.md') ||
                data.documentPath.endsWith('.markdown') ||
                data.documentPath.endsWith('.txt') ||
                data.documentPath.endsWith('.mdx')

            if (!isLikelyMarkdown) {
                logger.warn(
                    `document ${data.documentPath} is not a markdown file, skipping further processing extraction`
                )
                return
            }

            const insertDocumentToDbPromise = step.run('insert-document', async () => {
                const isLikelyMarkdown =
                    data.documentPath.endsWith('.md') ||
                    data.documentPath.endsWith('.markdown') ||
                    data.documentPath.endsWith('.txt') ||
                    data.documentPath.endsWith('.mdx')

                let metadata: { title: string | null; [record: string]: JSONValue } | null = null
                if (isLikelyMarkdown) {
                    metadata = extractFrontMatter(documentBuffer.toString())
                }

                // Insert
                return await db
                    .insert(schema.documents)
                    .values({
                        organizationId: data.organizationId,
                        namespaceId: data.namespaceId,
                        title: metadata?.title || data.documentPath.split('/').pop() || 'unknown',
                        metadata,
                        filePath: data.documentPath,
                        contentHash: ingestionDecision.contentHash
                    })
                    .onConflictDoUpdate({
                        target: [
                            schema.documents.filePath,
                            schema.documents.organizationId,
                            schema.documents.namespaceId
                        ],
                        set: {
                            updatedAt: Date.now(),
                            title: metadata?.title || data.documentPath.split('/').pop() || 'unknown',
                            metadata,
                            filePath: data.documentPath,
                            contentHash: ingestionDecision.contentHash
                        }
                    })
            })

            await Promise.all([insertDocumentToDbPromise, uploadDocumentPromise])
        }
    )
