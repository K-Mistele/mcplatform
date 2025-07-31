import { createGoogleGenerativeAI } from '@ai-sdk/google';

export const googleAiProvider = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY!,
})