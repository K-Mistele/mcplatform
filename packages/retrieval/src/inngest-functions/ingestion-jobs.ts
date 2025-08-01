import { db, schema } from 'database'
import { type Inngest, NonRetriableError } from 'inngest'
import z from 'zod'

export const createBatchEventSchema = z.object({
    organizationId: z.string(),
    namespaceId: z.string(),
    batchId: z.string().uuid().describe('The ID of the batch to create')
})
export type CreateBatchEvent = z.infer<typeof createBatchEventSchema>

/**
 * This function creates a new ingestion job record in the database.
 * @param inngest This is the Inngest instance that will be used to create the function.
 * @returns The function that will be used to create the ingestion job record.
 */
export const createBatch = (inngest: Inngest) =>
    inngest.createFunction(
        {
            id: 'create-batch',
            name: 'Create Batch'
        },
        {
            event: 'retrieval/create-batch'
        },
        async ({ event, step, logger }) => {
            const { success, data, error } = createBatchEventSchema.safeParse(event.data)
            if (!data || error || !success) {
                const prettyError = z.prettifyError(error)
                logger.error(`invalid event data:\n\n${prettyError}`)
                throw new NonRetriableError(prettyError)
            }

            const [batchRecord] = await step.run(
                'create-batch-record',
                async () =>
                    await db
                        .insert(schema.ingestionJob)
                        .values({
                            id: data.batchId,
                            organizationId: data.organizationId,
                            namespaceId: data.namespaceId,
                            status: 'pending'
                        })
                        .onConflictDoNothing()
                        .returning()
            )

            if (!batchRecord) throw new Error('Failed to create batch record')

            return JSON.stringify({
                id: batchRecord.id,
                organizationId: batchRecord.organizationId,
                namespaceId: batchRecord.namespaceId,
                record: batchRecord
            })
        }
    )
