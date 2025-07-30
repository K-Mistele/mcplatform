import { inngest } from '@/lib/inngest/client'
import * as functions from '@/lib/inngest/functions'
import { serve } from 'inngest/next'


// Create the API handler for Inngest
export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: Object.values(functions),
    baseUrl: process.env.INNGEST_BASE_URL
})
