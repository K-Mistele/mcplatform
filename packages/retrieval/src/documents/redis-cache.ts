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
    const result = await redisClient.hgetall(`document:${organizationId}:${namespaceId}:${documentPath}`)
    if (!result || !result.content || !result.type) return null
    if (result.type === 'text') return { type: 'text', content: Buffer.from(result.content, 'base64').toString() }
    if (result.type === 'binary') return { type: 'binary', content: Buffer.from(result.content, 'base64') }
    return null
}
export async function removeDocumentFromCache(organizationId: string, namespaceId: string, documentPath: string) {
    await redisClient.del(`document:${organizationId}:${namespaceId}:${documentPath}`)
} /**
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
    documentContent: string | Buffer,
    type: 'text' | 'binary' = 'text'
) {
    const key = `document:${organizationId}:${namespaceId}:${documentPath}`
    await redisClient.hset(key, 'content', Buffer.from(documentContent).toString('base64'), 'type', type)
    // Set expiration separately as hset doesn't support EX option
    await redisClient.expire(key, DOCUMENT_EXPIRATION_SECONDS)
}
