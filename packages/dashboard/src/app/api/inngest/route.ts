import { serve } from 'inngest/next'
import { functions, inngest } from 'retrieval'
import { Resource } from 'sst'

const inngestUrl = Resource.McpPlatformInngestService.url
console.log('inngestUrl', inngestUrl)

// Create the API handler for Inngest
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: functions.map((f) => f(inngest)),
    baseUrl: inngestUrl
})
