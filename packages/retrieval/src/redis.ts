import { Redis } from 'ioredis'
import { Resource } from 'sst'

const { username, password, host, port } = Resource.McpPlatformRedis

export const redisClient = new Redis(`redis://${username}:${encodeURIComponent(password)}@${host}:${port}`)

export const DOCUMENT_EXPIRATION_SECONDS = 60 * 60 * 24 // 1 day

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
    documentContent: string | Buffer,
    type: 'text' | 'binary' = 'text'
) {
    await redisClient.hset(
        `document:${organizationId}:${namespaceId}:${documentPath}`,
        'content',
        Buffer.from(documentContent).toString('base64'),
        'type',
        type,
        'EX',
        DOCUMENT_EXPIRATION_SECONDS
    )
}
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
}
