import { type Inngest, NonRetriableError } from 'inngest'
import z from 'zod'
import { storeDocument } from '../documents'

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

            await step.run('upload-document', async () => {
                const documentBuffer = Buffer.from(data.documentBufferBase64, 'base64')
                await storeDocument(documentBuffer, {
                    organizationId: data.organizationId,
                    namespaceId: data.namespaceId,
                    documentRelativePath: data.documentPath
                })
            })
        }
    )
