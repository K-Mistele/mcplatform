import { embedMany } from 'ai'
import { type Inngest, NonRetriableError } from 'inngest'
import z from 'zod'
import { EMBED_CHUNK_API_THROTTLE_LIMIT, EMBED_CHUNK_API_THROTTLE_PERIOD } from '../../config'
import { geminiEmbedding } from '../../inference'

export const embedChunksEventSchema = z.object({
    chunks: z.record(z.string(), z.string())
})
export type EmbedChunksEvent = z.infer<typeof embedChunksEventSchema>
export type EmbedChunksResult = Record<string, Array<number>>

/**
 * Embeds a batch of contextualized chunk contents.
 * You may be wondering, why not do this in the embed chunk aggregator function?
 * The short answer is that that function is used for batching and this one is used for doing the embedding
 * with proper flow control since batching is NOT compatible with flow control.
 *
 * @param inngest - The inngest instance.
 * @returns The inngest function.
 */
export const embedChunks = (inngest: Inngest) =>
    inngest.createFunction(
        {
            id: 'embed-chunk',
            name: 'Embed Chunk',
            throttle: {
                limit: EMBED_CHUNK_API_THROTTLE_LIMIT,
                period: EMBED_CHUNK_API_THROTTLE_PERIOD
            }
        },
        {
            event: 'retrieval/embed-chunk'
        },
        async ({ step, event, logger }) => {
            // validate input
            const { data, success, error } = embedChunksEventSchema.safeParse(event.data)
            if (!success || !data || error) {
                if (error) logger.error(error)
                else logger.error('Unknown error parsing event data')
                throw new NonRetriableError('Invalid input')
            }

            // this makes sure that the order of the embeddings is the same as the order of the keys
            const keys = Object.keys(data.chunks).sort()
            const contextualizedChunkContents = keys.map((key) => data.chunks[key])

            // STEP -- embed the chunks
            const embeddingsResult = await step.run('embed-chunks', async () => {
                const result = await embedMany({
                    model: geminiEmbedding,
                    values: contextualizedChunkContents,
                    providerOptions: {
                        google: {
                            taskType: 'RETRIEVAL_DOCUMENT'
                        }
                    }
                })

                return result.embeddings
            })

            if (embeddingsResult.length !== keys.length) {
                logger.error('Number of embeddings does not match number of keys')
                throw new Error('Number of embeddings does not match number of keys')
            }

            const result: Record<string, Array<number>> = {}
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i]
                const embedding = embeddingsResult[i]
                if (key && embedding) result[key] = embedding
            }
            return result satisfies EmbedChunksResult
        }
    )
