import { createHash } from 'crypto'
import { db, schema } from 'database'
import { and, asc, eq, sql } from 'drizzle-orm'
import { type Inngest, NonRetriableError } from 'inngest'
import type { InvocationResult } from 'inngest/types'
import z from 'zod'
import {
    chunkDocument,
    removeDocumentFromCache,
    setDocumentInCache,
    shouldReingestDocument,
    storeDocumentInS3
} from '../../documents'
import { type ProcessChunkEvent, type ProcessChunkResult, processChunk } from './process-chunk'

export const ingestDocumentEventSchema = z.object({
    organizationId: z.string(),
    namespaceId: z.string(),
    documentPath: z.string(),
    batchId: z.string().uuid().describe('The ID of the batch to ingest the document to'),
    documentBufferBase64: z.string().describe('The file buffer in base64 format')
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

            // STEP -- Check if document should be reingested
            const documentBuffer = Buffer.from(data.documentBufferBase64, 'base64')
            const ingestionDecision = await step.run('make-reingestion-decision', async () => {
                logger.info('Making ingestion decision')
                return await shouldReingestDocument({
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentRelativePath: data.documentPath,
                    contentHash: createHash('sha1').update(documentBuffer).digest('hex')
                })
            })

            if (!ingestionDecision.shouldReingest) {
                logger.info(`document ${data.documentPath} already exists, skipping ingestion`)
                return
            }

            // STEP -- Upload document to S3
            await step.run('upload-document-to-s3', async () => {
                logger.info('Uploading document to S3')
                await storeDocumentInS3(documentBuffer, {
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentRelativePath: data.documentPath
                })
            })

            // STEP -- Create or update document record in database
            await step.run('create-document-record', async () => {
                logger.info('Creating document record in database')
                const contentHash = createHash('sha1').update(documentBuffer).digest('hex')
                await db
                    .insert(schema.documents)
                    .values({
                        filePath: data.documentPath,
                        namespaceId: data.namespaceId,
                        organizationId: data.organizationId,
                        contentType: 'text/markdown',
                        contentHash,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    })
                    .onConflictDoUpdate({
                        target: [
                            schema.documents.filePath,
                            schema.documents.namespaceId,
                            schema.documents.organizationId
                        ],
                        set: {
                            contentHash,
                            updatedAt: Date.now()
                        }
                    })
            })

            // Use the document buffer directly
            // add the document to the cache - this MUST complete before chunk processing
            await step.run('cache-document-id', async () => {
                logger.info('caching document')
                await setDocumentInCache(
                    data.organizationId,
                    data.namespaceId,
                    data.documentPath,
                    documentBuffer,
                    'text'
                )
            })

            // STEP -- increment the total documents count for the batch
            await step.run('increment-batch-total-documents', async () => {
                logger.info(`incrementing total documents count for batch ${data.batchId}`)
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
                logger.info(
                    `incremented total documents count for batch ${data.batchId} to ${result?.totalDocuments} for document ${data.documentPath}`
                )
                if (!result) {
                    logger.error(`failed to increment total documents count for batch ${data.batchId}`)
                    throw new Error('Failed to increment total documents count for batch')
                }
                return result
            })

            // STEP -- split the document into chunks
            const chunks = await step.run('split-document-into-chunks', async () => {
                logger.info('splitting document into chunks')
                const chunks = chunkDocument(documentBuffer.toString())
                if (!chunks) {
                    logger.error(`failed to split document into chunks`)
                    throw new Error('Failed to split document into chunks')
                }
                if (!chunks.length) {
                    logger.warn(`failed to split document into chunks, skipping`)
                    return [] satisfies string[]
                }
                logger.info(`split document into ${chunks.length} chunks`)
                return chunks
            })

            // STEP -- get chunks from the database for the document
            const existingChunks = await step.run('get-existing-chunks-from-db', async () => {
                logger.info('getting existing chunks from db')
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

                logger.info(`found ${chunks.length} existing chunks for document ${data.documentPath}`)
                return chunks
            })

            const [shouldEraseExistingChunksBeforeSave, chunksToProcess] = await step.run(
                'determine-if-we-should-erase-existing-chunks',
                async () => {
                    logger.info('calculating chunks to process')
                    // Calculate the chunks to process by finding the non-matching chunks
                    // no need to do this in a step since it's deterministic and cheap
                    const chunksToProcess: Array<{ chunk: string; index: number }> = []
                    chunks.forEach((chunk, index) => {
                        const existingChunk = existingChunks[index]
                        if (
                            !existingChunk ||
                            (existingChunk && chunk.trim() !== existingChunk.originalContent.trim())
                        ) {
                            chunksToProcess.push({ chunk, index })
                        }
                    })
                    logger.info(`calculated ${chunksToProcess.length} chunks to process`)

                    logger.info('determining if we should erase existing chunks before save')
                    return [existingChunks.length > chunks.length, chunksToProcess] as const
                }
            )

            if (chunksToProcess.length) {
                // create promises for contextualizing and then handling all the chunks
                const chunkPromises: InvocationResult<ProcessChunkResult | null>[] = []
                for (const chunk of chunksToProcess) {
                    const embeddedChunkPromise = step.invoke('process-chunk', {
                        function: processChunk(inngest),
                        data: {
                            organizationId: data.organizationId,
                            namespaceId: data.namespaceId,
                            documentPath: data.documentPath,
                            chunkIndex: chunk.index,
                            chunkContent: chunk.chunk,
                            correlationId: data.batchId
                        } satisfies ProcessChunkEvent
                    })
                    chunkPromises.push(embeddedChunkPromise)
                }
                const chunkPromiseResults = await Promise.allSettled(chunkPromises)

                // STEP -- Build a list of chunks to insert
                const chunkListToInsert = await step.run('build-chunks-to-insert', async () => {
                    logger.info('building chunks to insert')
                    const chunksToInsert: Array<typeof schema.chunks.$inferInsert> = []

                    // loop over chunks and if the chunk resolved; add it to the list of chunks to insert
                    for (let i = 0; i < chunkPromiseResults.length; i++) {
                        const originalChunk = chunksToProcess[i]!
                        const chunkPromiseResult = chunkPromiseResults[i]
                        if (chunkPromiseResult?.status === 'rejected') {
                            logger.error(`Failed to process chunk ${i}:`, originalChunk)
                        } else if (chunkPromiseResult?.status === 'fulfilled') {
                            const chunkResult = chunkPromiseResult.value
                            if (!chunkResult || !originalChunk) {
                                logger.error(`Failed to process chunk ${i}:`, originalChunk, chunkResult)
                                continue
                            }
                            chunksToInsert.push({
                                originalContent: originalChunk.chunk,
                                contextualizedContent: chunkResult.contextualizedContent,
                                documentPath: data.documentPath,
                                orderInDocument: originalChunk.index,
                                namespaceId: data.namespaceId,
                                organizationId: data.organizationId,
                                metadata: null,
                                id: crypto.randomUUID(),
                                createdAt: Date.now(),
                                updatedAt: Date.now()
                            })
                        }
                    }
                    logger.info(`built ${chunksToInsert.length} chunks to insert`)
                    return chunksToInsert
                })

                await step.run('insert-chunks-into-db', async () => {
                    logger.info(`inserting ${chunkListToInsert.length} chunks into db`)
                    await db
                        .insert(schema.chunks)
                        .values(chunkListToInsert)
                        .onConflictDoUpdate({
                            target: [
                                schema.chunks.documentPath,
                                schema.chunks.orderInDocument,
                                schema.chunks.namespaceId,
                                schema.chunks.organizationId
                            ],
                            set: {
                                contextualizedContent: sql`excluded.contextualized_content`,
                                originalContent: sql`excluded.original_content`,
                                updatedAt: Date.now()
                            }
                        })
                })

                logger.info(`inserted ${chunkListToInsert.length} chunks into db`)

                // TODO remove old chunks from DB and Turbopuffer
            } else {
                logger.warn('no chunks to process for document', data.documentPath)
            }

            // STEP -- update the processed documents count in the database
            await step.run('increment-batch-processed-documents', async () => {
                logger.info(`incrementing processed documents count for batch ${data.batchId}`)
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

            const deleteOld = step.run('delete-old-chunks-from-db', async () => {
                if (shouldEraseExistingChunksBeforeSave) {
                    // TODO
                }
            })

            const clearCache = step.run('clear-document-from-cache', async () =>
                removeDocumentFromCache(data.organizationId, data.namespaceId, data.documentPath)
            )

            await Promise.all([deleteOld, clearCache])
        }
    )
