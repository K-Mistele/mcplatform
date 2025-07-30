import yaml from 'yaml';
import { JSONValue } from "../types";
 
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
    const data = yaml.parse(frontMatter)
    return data
}