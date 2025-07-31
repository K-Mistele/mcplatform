import { type SplitOptions, Splitter } from 'llm-text-splitter'
import yaml from 'yaml'
import type { JSONValue } from '../types'

type SplitterType = SplitOptions['splitter']

/**
 * Extracts the front matter from a document. assumes YAML front matter.
 * If no title is present in the front matter, extracts the first H1 from the document.
 *
 * @param document - The document to extract the front matter from.
 * @returns The front matter as a JSON object with title guaranteed.
 */
export function extractFrontMatter(document: string): { [key: string]: JSONValue } {
    const frontMatterRegex = /^---\s*([\s\S]*?)---/m
    const match = frontMatterRegex.exec(document)

    let result: { [key: string]: JSONValue } = {}
    
    if (match) {
        const frontMatter = match[1]
        const parsed = yaml.parse(frontMatter)
        // yaml.parse returns null for empty or whitespace-only content
        if (parsed !== null) {
            result = parsed
        }
    }

    // If no title in frontmatter, extract from first H1
    if (!result.title) {
        const h1Regex = /^#\s+(.+)$/m
        const h1Match = h1Regex.exec(document)
        if (h1Match) {
            result.title = h1Match[1].trim()
        }
    }

    return result
}

/**
 * Chunks a document into smaller chunks.
 *
 * NOTE uses overlap, and also sets chunk length to be 2x the max tokens of the embedding model; assuming average token size is 2 (to be safe)
 * @param document - The document to chunk.
 * @param config - The configuration for the chunking.
 * @returns The chunks.
 */
export function chunkDocument(
    document: string,
    config: { maxChunkLength: number; overlap: number; splitter: SplitterType } = {
        maxChunkLength: 4096,
        overlap: 200,
        splitter: 'markdown'
    }
): Array<string> {
    const splitter = new Splitter({
        splitter: config.splitter,
        maxLength: config.maxChunkLength,
        overlap: config.overlap
    })
    const chunks = splitter.split(document)
    return chunks
}

/**
 * Extracts image URLs from a document.
 *
 * @param document - The document to extract image URLs from.
 * @returns The image URLs.
 */
export function extractImageUrls(document: string): Array<{ url: string; urlType: 'local' | 'remote' }> {
    const imageUrlRegex = /!\[.*?\]\((.*?)\)/g
    const matches = document.match(imageUrlRegex)
    return (
        matches?.map((match) => {
            const url = match.match(/!\[.*?\]\((.*?)\)/)?.[1] || ''
            const urlType = url.startsWith('http') ? 'remote' : 'local'
            return { url, urlType }
        }) || []
    )
}
