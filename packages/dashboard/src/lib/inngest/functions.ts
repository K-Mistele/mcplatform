import { db, schema } from 'database'
import z from 'zod'
import { inngest } from './client'

export const requestDashboardSupportSchema = z.object({
    summary: z.string(),
    context: z.string().nullish(),
    email: z.string(),
    organizationId: z.string()
})
export type RequestDashboardSupportEvent = z.infer<typeof requestDashboardSupportSchema>

export const requestDashboardSupport = inngest.createFunction(
    { id: 'request-dashboard-support' },
    {
        event: 'mcp-server/support.requested.dashboard'
    },
    async ({ event, step }) => {
        const data = requestDashboardSupportSchema.parse(event.data)

        const [newSupportTicket] = await step.run(
            'create-support-ticket',
            async () =>
                await db
                    .insert(schema.supportRequests)
                    .values({
                        conciseSummary: data.summary,
                        context: data.context,
                        status: 'needs_email',
                        email: data.email,
                        supportRequestMethod: 'dashboard',
                        organizationId: event.data.organizationId
                    })
                    .returning()
        )
    }
)
