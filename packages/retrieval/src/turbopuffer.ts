import { Turbopuffer } from '@turbopuffer/turbopuffer'
import type { JSONValue } from 'ai'
import { embed } from 'ai'
import { geminiEmbedding } from './inference'

export const turboPuffer = new Turbopuffer({
    apiKey: process.env.TURBOPUFFER_API_KEY!,
    region: 'aws-us-east-1' // closest to our backend.
})

export async function upsertIntoTurboPuffer(data: {
    organizationId: string
    namespaceId: string
    chunks: Array<{
        chunkIndex: number
        embedding: Array<number>
        documentPath: string
        content: string
        contextualizedContent: string
        metadata: Record<string, JSONValue> | null
    }>
}) {
    const ns = turboPuffer.namespace(`${data.organizationId}-${data.namespaceId}`)
    await ns.write({
        upsert_rows: data.chunks.map((chunk) => ({
            // Expand the metadata into the root of the object
            ...(chunk.metadata ? chunk.metadata : {}),

            // Add the rest of the fields
            id: `${chunk.documentPath}-${chunk.chunkIndex}`,
            document_path: chunk.documentPath,
            vector: chunk.embedding,
            content: chunk.content,
            contextualized_content: chunk.contextualizedContent
        })),
        distance_metric: 'cosine_distance',
        schema: {
            content: {
                type: 'string',
                full_text_search: true
            },
            contextualized_content: {
                type: 'string',
                full_text_search: true
            }
        }
    })
}

type TextQuery = {
    textQuery: string
}
type VectorQuery = {
    vectorQuery: Array<number>
}
type Query = TextQuery | VectorQuery | (TextQuery & VectorQuery)

/**
 * Search TurboPuffer.
 *
 * @param data - The data to search for.
 * @returns The search results.
 */

export async function searchTurboPuffer(data: {
    organizationId: string
    namespaceId: string
    query: Query
    topK?: number
}) {
    const ns = turboPuffer.namespace(`${data.organizationId}-${data.namespaceId}`)

    // Extract the type so that we can use it properly.
    type TurboPufferQuery = Parameters<typeof ns.multiQuery>[0]['queries'][number]

    let textQuery: TurboPufferQuery | null = null
    let vectorQuery: TurboPufferQuery | null = null

    if ('textQuery' in data.query)
        textQuery = {
            rank_by: ['content', 'BM25', data.query.textQuery],
            top_k: data.topK ?? 10,
            include_attributes: ['content', 'document_path', 'id', 'contextualized_content']
        } satisfies TurboPufferQuery
    if ('vectorQuery' in data.query)
        vectorQuery = {
            rank_by: ['vector', 'ANN', data.query.vectorQuery],
            top_k: data.topK ?? 10,
            include_attributes: ['content', 'document_path', 'id', 'contextualized_content']
        } satisfies TurboPufferQuery

    if (textQuery && vectorQuery)
        return await ns.multiQuery({
            queries: [textQuery, vectorQuery]
        })
    else if (textQuery) return await ns.query(textQuery)
    else if (vectorQuery) return await ns.query(vectorQuery)
    else throw new Error('No query provided')
}

/**
 * Vector search using TurboPuffer.
 * Takes a text query string and converts it to an embedding for vector search.
 *
 * @param data - The data to search for.
 * @returns The search results.
 */
export async function vectorSearchTurbopuffer(data: {
    organizationId: string
    namespaceId: string
    query: string
    topK?: number
}) {
    const ns = turboPuffer.namespace(`${data.organizationId}-${data.namespaceId}`)

    // Convert the text query to an embedding using RETRIEVAL_QUERY task type
    const { embedding } = await embed({
        model: geminiEmbedding,
        value: data.query,
        providerOptions: {
            google: {
                taskType: 'RETRIEVAL_QUERY'
            }
        }
    })

    return await ns.query({
        rank_by: ['vector', 'ANN', embedding],
        top_k: data.topK ?? 10,
        include_attributes: ['content', 'document_path', 'id', 'contextualized_content']
    })
}

/**
 * BM25 text search using TurboPuffer.
 *
 * @param data - The data to search for.
 * @returns The search results.
 */
export async function bm25SearchTurbopuffer(data: {
    organizationId: string
    namespaceId: string
    query: string
    topK?: number
}) {
    const ns = turboPuffer.namespace(`${data.organizationId}-${data.namespaceId}`)

    return await ns.query({
        rank_by: ['content', 'BM25', data.query],
        top_k: data.topK ?? 10,
        include_attributes: ['content', 'document_path', 'id', 'contextualized_content']
    })
}

/**
 * Hybrid search (vector + BM25) using TurboPuffer.
 * Takes a text query string and performs both vector and BM25 search.
 *
 * @param data - The data to search for.
 * @returns The search results.
 */
export async function hybridSearchTurbopuffer(data: {
    organizationId: string
    namespaceId: string
    query: string
    topK?: number
}) {
    const ns = turboPuffer.namespace(`${data.organizationId}-${data.namespaceId}`)

    // Convert the text query to an embedding for the vector search component
    const { embedding } = await embed({
        model: geminiEmbedding,
        value: data.query,
        providerOptions: {
            google: {
                taskType: 'RETRIEVAL_QUERY'
            }
        }
    })

    return await ns.multiQuery({
        queries: [
            {
                rank_by: ['content', 'BM25', data.query],
                top_k: data.topK ?? 10,
                include_attributes: ['content', 'document_path', 'id', 'contextualized_content']
            },
            {
                rank_by: ['vector', 'ANN', embedding],
                top_k: data.topK ?? 10,
                include_attributes: ['content', 'document_path', 'id', 'contextualized_content']
            }
        ]
    })
}

/**
 * Nuke a Turbopuffer namespace.
 *
 * @param param0 - The data to nuke the namespace for.
 * @returns The search results.
 */
export async function nukeTurbopufferNamespace({
    organizationId,
    namespaceId
}: {
    organizationId: string
    namespaceId: string
}) {
    try {
        const ns = turboPuffer.namespace(`${organizationId}-${namespaceId}`)
        await ns.deleteAll()
    } catch (error: any) {
        // Ignore 404 errors - namespace doesn't exist
        if (error?.status !== 404) {
            throw error
        }
    }
}
