import { type EventPayload, type Inngest, NonRetriableError } from 'inngest'
import z from 'zod'
import type { EmbedContextualizedChunkEvent, EmbedContextualizedChunkResultEvent } from './batch-chunk-for-embedding'
import type { ContextualizeChunkEvent, ContextualizeChunkResult } from './contextualize-chunk'
import { contextualizeChunk } from './contextualize-chunk'

export const processChunkEventSchema = z.object({
    organizationId: z.string(),
    namespaceId: z.string(),
    documentPath: z.string(),
    chunkIndex: z.number(),
    chunkContent: z.string(),
    correlationId: z.string()
})
export type ProcessChunkEvent = z.infer<typeof processChunkEventSchema>

export const processChunk = (inngest: Inngest) =>
    inngest.createFunction(
        {
            id: 'process-chunk',
            name: 'Process Chunk'
        },
        {
            event: 'retrieval/process-chunk'
        },
        async ({ step, event, logger }) => {
            // validate input
            const { data, success, error } = processChunkEventSchema.safeParse(event.data)
            if (!success || !data || error) {
                if (error) logger.error(error)
                else logger.error('Unknown error parsing event data')
                throw new NonRetriableError('Invalid input')
            }

            // STEP -- get the chunk from the database
            logger.info(`contextualizing chunk ${data.chunkContent}`)
            const contextualizedChunk: ContextualizeChunkResult = await step.invoke('contextualize-chunk', {
                function: contextualizeChunk(inngest),
                data: {
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentPath: data.documentPath,
                    chunkIndex: data.chunkIndex,
                    chunkContent: data.chunkContent
                } satisfies ContextualizeChunkEvent
            })
            logger.info(`contextualized chunk ${contextualizedChunk.chunkContextualizedContent}`)

            // STEP -- embed the chunk
            logger.info(`embedding chunk ${contextualizedChunk.chunkContextualizedContent}`)
            await step.sendEvent('batch-embed-chunk', {
                name: 'retrieval/batch-embed-chunk',
                data: {
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentPath: data.documentPath,
                    chunkIndex: data.chunkIndex,
                    chunkContent: data.chunkContent,
                    chunkContextualizedContent: contextualizedChunk.chunkContextualizedContent,
                    correlationId: data.correlationId,
                    metadata: JSON.stringify(contextualizedChunk.metadata)
                } satisfies EmbedContextualizedChunkEvent
            })

            const result: EventPayload<EmbedContextualizedChunkResultEvent> | null = await step.waitForEvent(
                'wait-for-chunk-result',
                {
                    event: 'retrieval/embedding-result',
                    timeout: '60m',
                    match: 'data.correlationId'
                }
            )
            if (result) {
                logger.info(`embedding result ${result.data}`)
            }
        }
    )
