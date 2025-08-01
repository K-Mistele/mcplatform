import { createGoogleGenerativeAI } from '@ai-sdk/google'

export const googleAiProvider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY!
})

import type { EmbeddingModel } from 'ai'

type TextEmbeddingModel = EmbeddingModel<string>

export type EmbeddingModelInfo = {
    dimensions: number
    maxTokens: number
    modelTag: string
    model: TextEmbeddingModel
}

export const geminiFlash = googleAiProvider.chat('gemini-2.5-flash')
export const geminiEmbedding = googleAiProvider.textEmbedding('gemini-embedding-001')
