import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash } from 'crypto'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { Resource } from 'sst/resource'

export const s3Client = new S3Client({})
export type ReingestDocumentResult =
    | {
          shouldReingest: false
          reason: 'CONTENT_HASH_MATCH'
      }
    | {
          shouldReingest: true
          contentHash: string
          reason: 'DOCUMENT_NOT_FOUND' | 'CONTENT_HASH_MISMATCH'
      }
/**
 * Returns a presigned URL for uploading a document to S3.
 * @param param0
 * @returns
 */
export async function getDocumentUploadUrl({
    organizationId,
    namespaceId,
    documentRelativePathWithExtension
}: {
    organizationId: string
    namespaceId: string
    documentRelativePathWithExtension: string // e.g. "docs/src/my-document.pdf"
}) {
    const command = new PutObjectCommand({
        Bucket: Resource.Bucket.name,
        Key: `${organizationId}/${namespaceId}/${documentRelativePathWithExtension}`
    })

    return await getSignedUrl(s3Client, command)
}

/**
 * Stores a document in S3.
 * @param document
 * @param param1
 */
export async function storeDocument(
    document: Buffer,
    {
        organizationId,
        namespaceId,
        documentRelativePath
    }: {
        organizationId: string
        namespaceId: string
        documentRelativePath: string
    }
) {
    const command = new PutObjectCommand({
        Bucket: Resource.Bucket.name,
        Key: `${organizationId}/${namespaceId}/${documentRelativePath}`,
        Body: document
    })
    await s3Client.send(command)
}

/**
 * Checks if a document should be re-ingested.
 * @param param0
 * @returns
 */
export async function shouldReingestDocument({
    organizationId,
    namespaceId,
    documentRelativePath,
    content
}: {
    organizationId: string
    namespaceId: string
    documentRelativePath: string
    content: Buffer
}): Promise<ReingestDocumentResult> {
    const [document] = await db
        .select()
        .from(schema.documents)
        .where(
            and(
                eq(schema.documents.organizationId, organizationId),
                eq(schema.documents.namespaceId, namespaceId),
                eq(schema.documents.filePath, documentRelativePath)
            )
        )

    const contentHash = createHash('sha1').update(content).digest('hex')

    if (!document) return { shouldReingest: true, contentHash: '', reason: 'DOCUMENT_NOT_FOUND' }

    // Check to see if the content hash matches the existing document
    if (contentHash === document.contentHash) return { shouldReingest: false, reason: 'CONTENT_HASH_MATCH' }
    return { shouldReingest: true, contentHash, reason: 'CONTENT_HASH_MISMATCH' }
}

/**
 * Gets a document from S3.
 * @param param0
 * @returns
 */
export async function getDocumentFromS3({
    organizationId,
    namespaceId,
    documentRelativePath
}: {
    organizationId: string
    namespaceId: string
    documentRelativePath: string
}) {
    const command = new GetObjectCommand({
        Bucket: Resource.McpPlatformBucket.name,
        Key: `${organizationId}/${namespaceId}/${documentRelativePath}`
    })

    const response = await s3Client.send(command)
    if (!response.Body) throw new Error('Failed to get document from S3')
    return response.Body
}
