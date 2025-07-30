import { Splitter, type SplitOptions } from 'llm-text-splitter';
import yaml from 'yaml';
import { JSONValue } from "../types";

type SplitterType = SplitOptions['splitter']


/**
 * Extracts the front matter from a document. assumes YAML front matter.
 * 
 * @param document - The document to extract the front matter from.
 * @returns The front matter as a JSON object.
 */
export function extractFrontMatter(document: string): {[key: string]: JSONValue} {
    const frontMatterRegex = /^---\s*([\s\S]*?)---/m;
    const match = frontMatterRegex.exec(document);

    if (!match) {
        return {};
    }
    const frontMatter = match[1];
    return yaml.parse(frontMatter)
    
}

/**
 * Chunks a document into smaller chunks.
 * 
 * NOTE uses overlap, and also sets chunk length to be 2x the max tokens of the embedding model; assuming average token size is 2 (to be safe)
 * @param document - The document to chunk.
 * @param config - The configuration for the chunking.
 * @returns The chunks.
 */
export function chunkDocument(document: string, config:{maxChunkLength: number, overlap: number, splitter: SplitterType}={
    maxChunkLength: 4096,
    overlap: 200,
    splitter: 'markdown'
}): Array<string> {

    const splitter = new Splitter({
        splitter: config.splitter, 
        maxLength: config.maxChunkLength,
        overlap: config.overlap,
    })
    const chunks = splitter.split(document)
    return chunks

}

export function extractImageUrls(document: string): Array<{url: string, urlType: 'local' | 'remote'}> {
    const imageUrlRegex = /!\[.*?\]\((.*?)\)/g;
    const matches = document.match(imageUrlRegex);
    return matches?.map(match => {
        const url = match.match(/!\[.*?\]\((.*?)\)/)?.[1] || '';
        const urlType = url.startsWith('http') ? 'remote' : 'local';
        return {url, urlType}
    }) || [];   
}