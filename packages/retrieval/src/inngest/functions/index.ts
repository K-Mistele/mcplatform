export * from './batch-chunk-for-embedding'
export * from './contextualize-chunk'
export * from './embed-chunks'
export * from './ingest-document'

import type { Inngest } from 'inngest'
import { batchChunkForEmbedding } from './batch-chunk-for-embedding'
import { contextualizeChunk } from './contextualize-chunk'
import { embedChunks } from './embed-chunks'
import { ingestDocument } from './ingest-document'
import { processChunk } from './process-chunk'
/**
 * exported function list for use in inngest client
 */
export const functions = [contextualizeChunk, ingestDocument, embedChunks, batchChunkForEmbedding, processChunk]

export const getFunctions = (client: Inngest) => functions.map((fn) => fn(client))
