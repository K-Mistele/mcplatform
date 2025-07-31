import type { EmbeddingModel } from "ai"
import { googleAiProvider } from "./providers"

type TextEmbeddingModel = EmbeddingModel<string>

export type EmbeddingModelInfo = {
    dimensions: number,
    maxTokens: number 
    modelTag: string
    model: TextEmbeddingModel
}

export const Embeddings: Record<string, EmbeddingModelInfo> = {
    gemini: {
        dimensions: 3072,
        maxTokens: 2048,
        modelTag: 'gemini-embedding-001',
        model: googleAiProvider.textEmbeddingModel('gemini-embedding-001')
    }
} as const