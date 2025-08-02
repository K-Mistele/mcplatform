import { Inngest } from 'inngest'

// Create the Inngest client with configuration from environment variables
export const inngest = new Inngest({
    id: 'retrieval',
    eventKey: process.env.INNGEST_EVENT_KEY,
    baseUrl: process.env.INNGEST_BASE_URL,
    //isDev: process.env.INNGEST_DEV !== '0' // Default to dev mode unless explicitly disabled
    isDev: process.env.NODE_ENV !== 'production'
})
