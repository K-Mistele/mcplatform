import { DOCUMENT_EXPIRATION_SECONDS, redisClient } from '../redis'

/**
 * Get a document from the cache. If the document is not in the cache, return null.
 * @param organizationId - The organization ID
 * @param namespaceId - The namespace ID
 * @param documentPath - The path to the document
 * @returns The document content
 */
export async function getDocumentFromCache(
    organizationId: string,
    namespaceId: string,
    documentPath: string
): Promise<
    | {
          type: 'text'
          content: string
      }
    | {
          type: 'binary'
          content: Buffer
      }
    | null
> {
    const key = `document:${organizationId}:${namespaceId}:${documentPath}`

    try {
        const result = await redisClient.hgetall(key)

        if (!result || !result.content || !result.type) {
            console.log(`Cache miss for ${key}`)
            return null
        }

        // Get TTL for debugging
        const ttl = await redisClient.ttl(key)
        console.log(`Cache hit for ${key} (type: ${result.type}, TTL: ${ttl}s)`)

        if (result.type === 'text') return { type: 'text', content: Buffer.from(result.content, 'base64').toString() }
        if (result.type === 'binary') return { type: 'binary', content: Buffer.from(result.content, 'base64') }

        console.warn(`Unknown document type in cache: ${result.type}`)
        return null
    } catch (error) {
        console.error(`Cache get operation failed for ${key}:`, error)
        return null
    }
}
export async function removeDocumentFromCache(organizationId: string, namespaceId: string, documentPath: string) {
    await redisClient.del(`document:${organizationId}:${namespaceId}:${documentPath}`)
}

/**
 * Set a document in the cache.
 * @param organizationId - The organization ID
 * @param namespaceId - The namespace ID
 * @param documentPath - The path to the document
 * @param documentContent - The content of the document
 */
export async function setDocumentInCache(
    organizationId: string,
    namespaceId: string,
    documentPath: string,
    documentTextOrBinary: Buffer,
    type: 'text' | 'binary'
) {
    const key = `document:${organizationId}:${namespaceId}:${documentPath}`

    try {
        // Use pipeline for atomic operations

        await redisClient.hset(key, 'content', documentTextOrBinary.toString('base64'), 'type', type)
        await redisClient.expire(key, DOCUMENT_EXPIRATION_SECONDS)

        // Log successful cache operation for debugging
        console.log(
            `Successfully cached document ${key} (${type}, ${documentTextOrBinary.length} bytes, TTL: ${DOCUMENT_EXPIRATION_SECONDS}s)`
        )
    } catch (error) {
        console.error(`Cache set operation failed for ${key}:`, error)
        throw error
    }
}
