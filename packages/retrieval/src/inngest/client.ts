import { Inngest } from 'inngest'
import { Resource } from 'sst'

const inngestUrl = Resource.Inngest.url
const inngestHttpUrl = `${inngestUrl}:8288`

// Create the Inngest client with configuration from environment variables
export const inngest = new Inngest({
    id: 'retrieval',
    eventKey: process.env.INNGEST_EVENT_KEY,
    baseUrl: inngestHttpUrl,
    //isDev: process.env.INNGEST_DEV !== '0' // Default to dev mode unless explicitly disabled
    isDev: process.env.NODE_ENV !== 'production'
})
