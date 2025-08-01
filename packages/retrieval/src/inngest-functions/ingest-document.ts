import { db, schema } from 'database'
import { and, asc, eq, sql } from 'drizzle-orm'
import { type Inngest, NonRetriableError } from 'inngest'
import z from 'zod'
import { getDocumentFromS3 } from '../documents'
import { chunkDocument } from '../preprocessing'

export const ingestDocumentEventSchema = z.object({
    organizationId: z.string(),
    namespaceId: z.string(),
    documentPath: z.string(),
    batchId: z.string().uuid().describe('The ID of the batch to ingest the document to')
})
export type IngestDocumentEvent = z.infer<typeof ingestDocumentEventSchema>

export const ingestDocument = (inngest: Inngest) =>
    inngest.createFunction(
        {
            id: 'ingest-document',
            name: 'Ingest Document to Namespace'
        },
        {
            event: 'retrieval/ingest-document'
        },
        async ({ event, step, logger }) => {
            // validate the input; prevent retries if the input is invalid
            const { success, data, error } = ingestDocumentEventSchema.safeParse(event.data)
            if (!data || error || !success) {
                const prettyError = z.prettifyError(error)
                logger.error(`invalid event data:\n\n${prettyError}`)
                throw new NonRetriableError(prettyError)
            }

            // STEP -- Get the document from S3 (if it doesn't exist there is no point in continuing)
            // IMPORTANT: we need to convert the document to a base64 string because the document is a stream
            const base64DocumentBytes: string = await step.run('get-document-from-s3', async () => {
                const document = await getDocumentFromS3({
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentRelativePath: data.documentPath
                })
                return await Buffer.from(await document.transformToByteArray()).toString('base64')
            })

            // NOTE that if the document is NOT markdown we need a different ingestion approach
            const isLikelyImage =
                data.documentPath.endsWith('.png') ||
                data.documentPath.endsWith('.jpg') ||
                data.documentPath.endsWith('.jpeg') ||
                data.documentPath.endsWith('.gif') ||
                data.documentPath.endsWith('.webp')

            if (isLikelyImage) {
                // TODO implement this
                logger.warn('likely image, skipping')
                return
            }

            // NOTE we need to make sure it's markdown otherwise we cannot process at present
            const isLikelyMarkdown =
                data.documentPath.endsWith('.md') ||
                data.documentPath.endsWith('.markdown') ||
                data.documentPath.endsWith('.txt') ||
                data.documentPath.endsWith('.mdx')
            if (!isLikelyMarkdown) {
                logger.error('unable to process non-markdown documents')
                throw new NonRetriableError('unable to process non-markdown documents')
            }

            // STEP -- increment the total documents count for the batch
            await step.run('increment-batch-total-documents', async () => {
                const result = await db.transaction(
                    async (tx) => {
                        await tx
                            .update(schema.ingestionJob)
                            .set({ totalDocuments: sql`${schema.ingestionJob.totalDocuments} + 1` })
                            .where(eq(schema.ingestionJob.id, data.batchId))
                            .returning()

                        const result = await tx
                            .select()
                            .from(schema.ingestionJob)
                            .where(eq(schema.ingestionJob.id, data.batchId))
                        return result?.[0]
                    },
                    {
                        // IMPORTANT: prevent deadlocks by using a read committed isolation level
                        isolationLevel: 'read committed',
                        accessMode: 'read write'
                    }
                )
                console.log(result)
                if (!result) {
                    logger.error(`failed to increment total documents count for batch ${data.batchId}`)
                    throw new Error('Failed to increment total documents count for batch')
                }
                logger.info(
                    `incremented total documents count for batch ${data.batchId} to ${result?.totalDocuments} (${result?.totalDocuments}/${result?.totalDocuments})`
                )
            })

            // STEP -- split the document into chunks
            const chunks: string[] = await step.run('split-document-into-chunks', async () => {
                const chunks = chunkDocument(Buffer.from(base64DocumentBytes, 'base64').toString())
                if (!chunks) {
                    logger.error(`failed to split document into chunks`)
                    throw new Error('Failed to split document into chunks')
                }
                if (!chunks.length) {
                    logger.warn(`failed to split document into chunks, skipping`)
                    return [] satisfies string[]
                }
                return chunks
            })

            // STEP -- get chunks from the database for the document
            const existingChunks = await step.run('get-existing-chunks-from-db', async () => {
                const chunks = await db
                    .select()
                    .from(schema.chunks)
                    .where(
                        and(
                            eq(schema.chunks.documentPath, data.documentPath),
                            eq(schema.chunks.namespaceId, data.namespaceId),
                            eq(schema.chunks.organizationId, data.organizationId)
                        )
                    )
                    .orderBy(asc(schema.chunks.orderInDocument))

                return chunks
            })

            if (!existingChunks.length)
                logger.info(`No existing chunks found for document ${data.documentPath}; creating new chunks`)
            if (existingChunks.length !== chunks.length && existingChunks.length !== 0)
                logger.info(
                    `Detected ${Math.abs(existingChunks.length - chunks.length)} ${chunks.length > existingChunks.length ? 'more' : 'fewer'} chunks in ${data.organizationId}/${data.namespaceId}/${data.documentPath}`
                )

            // If there are more chunks that exist than we have now; we need to erase everything beyond the chunks we have
            const shouldEraseExistingChunksBeforeSave = existingChunks.length > chunks.length

            // Calculate the chunks to process by finding the non-matching chunks
            // no need to do this in a step since it's deterministic and cheap
            const chunksToProcess: Array<{ chunk: string; index: number }> = []
            chunks.forEach((chunk, index) => {
                const existingChunk = existingChunks[index]
                if (existingChunk && chunk.trim() !== existingChunk.originalContent.trim()) {
                    chunksToProcess.push({ chunk, index })
                }
            })
            logger.info(`${chunksToProcess.length} chunks to update out of ${chunks.length}`)

            if (chunksToProcess.length) {
                // TODO contextualize chunks
                // TODO embed chunks & insert
                // TODO wait for completion
                // TODO remove old chunks from DB and Turbopuffer
            }

            // STEP -- update the processed documents count in the database
            await step.run('increment-batch-processed-documents', async () => {
                const result = await db.transaction(
                    async (tx) => {
                        await tx
                            .update(schema.ingestionJob)
                            .set({ documentsProcessed: sql`${schema.ingestionJob.documentsProcessed} + 1` })
                            .where(eq(schema.ingestionJob.id, data.batchId))

                        const result = await tx
                            .select()
                            .from(schema.ingestionJob)
                            .where(eq(schema.ingestionJob.id, data.batchId))
                        return result?.[0]
                    },
                    {
                        // IMPORTANT: prevent deadlocks by using a read committed isolation level
                        isolationLevel: 'read committed',
                        accessMode: 'read write'
                    }
                )
                if (!result) {
                    logger.error(`Failed to increment processed documents count for batch ${data.batchId}`)
                    throw new Error('Failed to increment processed documents count for batch')
                }
                logger.info(
                    `incremented processed documents count for batch ${data.batchId} to ${result?.documentsProcessed} (${result?.documentsProcessed}/${result?.totalDocuments})`
                )
            })
        }
    )
