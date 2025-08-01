import { generateText, type JSONValue } from 'ai'
import { db, schema } from 'database'
import type { Inngest } from 'inngest'
import { NonRetriableError } from 'inngest'
import z from 'zod'
import { CHAT_COMPLETIONS_API_THROTTLE_LIMIT, CHAT_COMPLETIONS_API_THROTTLE_PERIOD } from '../config'
import { getDocumentFromS3 } from '../documents'
import { geminiFlash } from '../inference'
import { extractFrontMatter } from '../preprocessing'
import { getDocumentFromCache, setDocumentInCache } from '../redis'

export const contextualizeChunkEventSchema = z.object({
    organizationId: z.string(),
    namespaceId: z.string(),
    documentPath: z.string(),
    chunkIndex: z.number(),
    chunkContent: z.string()
})
export type ContextualizeChunkEvent = z.infer<typeof contextualizeChunkEventSchema>
export type ContextualizeChunkResult = {
    organizationId: string
    namespaceId: string
    documentPath: string
    chunkIndex: number
    chunkContent: string
    chunkContextualizedContent: string
    metadata: Record<string, JSONValue> | null
}

export const contextualizeChunk = (inngest: Inngest) =>
    inngest.createFunction(
        {
            id: 'retrieval/contextualize-chunk',
            name: 'Contextualize Chunk',
            throttle: {
                limit: CHAT_COMPLETIONS_API_THROTTLE_LIMIT,
                period: CHAT_COMPLETIONS_API_THROTTLE_PERIOD
            }
        },
        {
            event: 'retrieval/contextualize-chunk'
        },
        async ({ event, step, logger }) => {
            // Validate the data
            const { data, success, error } = contextualizeChunkEventSchema.safeParse(event.data)
            if (!success || error || !data) {
                if (error) logger.error(`Invalid data for contextualize chunk:`, z.prettifyError(error))
                else logger.error(`Invalid data for contextualize chunk (unknown error):`, event.data)
                throw new NonRetriableError(
                    'Invalid data for contextualize chunk',
                    error ? { cause: error } : undefined
                )
            }

            // STEP -- check redis for the document
            let documentText: string | null = null
            const document = await step.run('maybe-get-document-from-cache', async () => {
                logger.info(
                    `Checking redis for document: ${data.organizationId}/${data.namespaceId}/${data.documentPath}`
                )
                const cacheResult = await getDocumentFromCache(data.organizationId, data.namespaceId, data.documentPath)
                if (cacheResult?.type === 'text') documentText = cacheResult.content
                if (cacheResult?.type === 'binary') {
                    logger.error(
                        'Unsupported document type (binary); images are not supported for contextualization yet'
                    )
                    throw new NonRetriableError(
                        'Unsupported document type (binary); images are not supported for contextualization yet'
                    )
                }
                return { documentText }
            })

            // Handle the case where the document isn't in the cache
            if (document === null) {
                logger.warn(`Document not found in cache; checking S3:`, data)

                // STEP -- if we get a cache miss, get the document from S3
                const s3Result = await step.run('get-document-from-s3', async () => {
                    const body = await getDocumentFromS3({
                        organizationId: data.organizationId,
                        namespaceId: data.namespaceId,
                        documentRelativePath: data.documentPath
                    })

                    // if the document can't be retrieved from S3, throw a non-retriable error. this is not recoverable.
                    if (!body)
                        throw new NonRetriableError('Failed to get document from S3; unable to get original document')
                    return body.transformToString()
                })
                documentText = s3Result

                // STEP -- set the document in cache
                await step.run('set-document-in-cache', async () => {
                    await setDocumentInCache(
                        data.organizationId,
                        data.namespaceId,
                        data.documentPath,
                        documentText!,
                        'text'
                    )
                })
            }

            if (!documentText) {
                logger.error(`Document text is null; this should never happen`)
                throw new NonRetriableError('Document text is null; this should never happen')
            }
            const metadata = extractFrontMatter(documentText)

            // STEP -- contextualize the chunk
            const result = await step.run(
                'contextualize-chunk',
                async () =>
                    await generateText({
                        model: geminiFlash,
                        prompt: `
Here is a document enclosed in <document></document> XML tags:
<document>
${documentText}
</document>

Here is a chunk from that document enclosed in <chunk></chunk> XML tags:
<chunk>
${data.chunkContent}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. 
Answer only with the succinct context and nothing else.
`
                    })
            )

            // STEP -- update the ingestion chunk
            await step.run('update-chunk', async () => {
                // STEP -- upsert the chunk
                await db
                    .insert(schema.chunks)
                    .values({
                        organizationId: data.organizationId,
                        documentPath: data.documentPath,
                        namespaceId: data.namespaceId,
                        originalContent: data.chunkContent,
                        contextualizedContent: result.text,
                        metadata,
                        orderInDocument: data.chunkIndex,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                    })
                    .onConflictDoUpdate({
                        target: [
                            schema.chunks.organizationId,
                            schema.chunks.documentPath,
                            schema.chunks.namespaceId,
                            schema.chunks.orderInDocument
                        ],
                        set: {
                            originalContent: data.chunkContent,
                            contextualizedContent: result.text,
                            updatedAt: Date.now()
                        }
                    })
            })
            return {
                organizationId: data.organizationId,
                namespaceId: data.namespaceId,
                documentPath: data.documentPath,
                chunkIndex: data.chunkIndex,
                chunkContent: data.chunkContent,
                chunkContextualizedContent: result.text,
                metadata
            } satisfies ContextualizeChunkResult
        }
    )
