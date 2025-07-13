import { inngest } from './client'

const syncSupportState = inngest.createFunction(
    { id: 'sync-support-state' },
    {
        event: 'mcp-server/support.requested'
    },
    async ({ event, step }) => {}
)
