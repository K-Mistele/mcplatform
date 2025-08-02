import { Inngest } from 'inngest'
import { connect } from 'inngest/connect'
import { Resource } from 'sst'
import { functions } from './functions'

const inngestUrl = Resource.McpPlatformInngestService.url
const inngestHttpUrl = `${inngestUrl}:8288`
const inngestWebsocketUrl = `${inngestUrl}:8289`.replace('https://', 'wss://').replace('http://', 'ws://')

console.log('inngestUrl', inngestUrl)
// Create the Inngest client with configuration from environment variables
export const inngest = new Inngest({
    id: 'retrieval',
    eventKey: process.env.INNGEST_EVENT_KEY,
    baseUrl: inngestHttpUrl,
    //isDev: process.env.INNGEST_DEV !== '0' // Default to dev mode unless explicitly disabled
    isDev: process.env.NODE_ENV !== 'production'
})

const inngestStreaming = new Inngest({
    id: 'retrieval-streaming',
    eventKey: process.env.INNGEST_EVENT_KEY,
    baseUrl: inngestWebsocketUrl,
    //isDev: process.env.INNGEST_DEV !== '0' // Default to dev mode unless explicitly disabled
    isDev: process.env.NODE_ENV !== 'production'
})

console.log('connecting to inngest (WS)')
export const connection = await connect({
    apps: [
        {
            client: inngestStreaming,
            functions: functions.map((f) => f(inngestStreaming))
        }
    ],
    maxConcurrency: 100,
    handleShutdownSignals: ['SIGINT', 'SIGTERM']
})
console.log('connected to inngest (WS)')
