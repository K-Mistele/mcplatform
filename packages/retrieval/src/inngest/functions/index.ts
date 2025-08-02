export * from './batch-chunk-for-embedding'
export * from './contextualize-chunk'
export * from './embed-chunks'
export * from './ingest-document'
export * from './upload-document'

import type { Inngest } from 'inngest'
import { batchChunkForEmbedding } from './batch-chunk-for-embedding'
import { contextualizeChunk } from './contextualize-chunk'
import { embedChunks } from './embed-chunks'
import { ingestDocument } from './ingest-document'
import { uploadDocument } from './upload-document'

/**
 * exported function list for use in inngest client
 */
export const functions = [contextualizeChunk, ingestDocument, uploadDocument, embedChunks, batchChunkForEmbedding]

export const getFunctions = (client: Inngest) => functions.map((fn) => fn(client))
