import type { Inngest } from 'inngest'
import { NonRetriableError } from 'inngest'
import z from 'zod'
import { EMBED_CHUNK_API_BATCH_GATHER_PERIOD, EMBED_CHUNK_API_BATCH_SIZE } from '../../config'
import { upsertIntoTurboPuffer } from '../../turbopuffer'
import { type EmbedChunksEvent, embedChunks } from './embed-chunks'

export const embedContextualizedChunkEventSchema = z.object({
    organizationId: z.string(),
    namespaceId: z.string(),
    documentPath: z.string(),
    chunkIndex: z.number(),
    chunkContent: z.string(),
    chunkContextualizedContent: z.string(),
    metadata: z.string().default('{}'),
    correlationId: z.string()
})
export type EmbedContextualizedChunkEvent = z.infer<typeof embedContextualizedChunkEventSchema>

export type EmbedContextualizedChunkResultEvent = {
    correlationId: string
    embedding: Array<number>
}

export const batchChunkForEmbedding = (inngest: Inngest) =>
    inngest.createFunction(
        {
            id: 'embed-contextualized-chunk',
            name: 'Embed Contextualized Chunk',
            batchEvents: {
                maxSize: EMBED_CHUNK_API_BATCH_SIZE,
                timeout: EMBED_CHUNK_API_BATCH_GATHER_PERIOD,

                // THIS IS IMPORTANT: WE ARE BATCHING ON AN ORGANIZATION AND NAMESPACE LEVEL
                key: 'event.data.organizationId + event.data.namespaceId'
            }
        },
        {
            event: 'retrieval/batch-embed-chunk'
        },
        async ({ step, events, logger }) => {
            const safeEvents: Array<EmbedContextualizedChunkEvent> = [] // required to have 1 item min;

            const namespaceId = events[0].data.namespaceId
            const organizationId = events[0].data.organizationId

            // parse the events and make an array of the valid ones (just in case! we don't want to fail the whole batch)
            for (const event of events) {
                const { data, success, error } = embedContextualizedChunkEventSchema.safeParse(event.data)
                if (!success || !data || error) {
                    if (error) logger.error(error)
                    else logger.error('Unknown error parsing event data:', { cause: event })
                    continue
                }
                if (data.namespaceId !== namespaceId || data.organizationId !== organizationId) {
                    logger.error('Event has a different namespace or organization id than the first event')

                    // NOTE this shoudl be an invariant due to the 'key' expression in the batchEvents
                    throw new NonRetriableError(
                        'Event has a different namespace or organization id than the first event'
                    )
                }
                safeEvents.push(data)
            }

            // if there are no safe events, we can just return
            if (!safeEvents.length) {
                logger.error('No safe events to embed')
                return
            }

            const keys: Record<string, string> = {}
            for (const event of safeEvents) {
                keys[event.correlationId] = event.chunkContextualizedContent
            }

            logger.info('embedding chunks', { keys })

            // invoke the throttled embed chunks function
            const embeddingResult = await step.invoke('embed-chunks', {
                function: embedChunks(inngest),
                data: {
                    chunks: keys
                } satisfies EmbedChunksEvent
            })

            if (!embeddingResult) {
                logger.error('No result from embedding chunks')
                throw new Error('No result from embedding chunks')
            }

            // TODO  insert into turbopuffer.
            await step.run('insert-into-turbopuffer', async () => {
                await upsertIntoTurboPuffer({
                    organizationId,
                    namespaceId,
                    chunks: safeEvents.map((event) => ({
                        chunkIndex: event.chunkIndex,
                        embedding: embeddingResult[event.correlationId]!,
                        documentPath: event.documentPath,
                        content: event.chunkContent,
                        contextualizedContent: event.chunkContextualizedContent,
                        metadata: JSON.parse(event.metadata)
                    }))
                })
            })

            logger.info('sending embedding results', { embeddingResult })
            const sendEventPromises: Promise<any>[] = []
            for (const correlationId of Object.keys(embeddingResult)) {
                sendEventPromises.push(
                    step.sendEvent('send-embedding-result', {
                        name: 'retrieval/embedding-result',
                        data: {
                            correlationId,
                            embedding: embeddingResult[correlationId]!
                        } satisfies EmbedContextualizedChunkResultEvent
                    })
                )
            }
            await Promise.all(sendEventPromises)
            logger.info('sent embedding results')
        }
    )
