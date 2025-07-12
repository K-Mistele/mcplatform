import { nanoid } from 'common/nanoid'
import { bigint, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'

export const supportRequestStatus = pgEnum('support_request_status', ['pending', 'in_progress', 'resolved', 'closed'])

export const supportRequests = pgTable('support_requests', {
    id: text('id').$defaultFn(() => `sr_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    conciseSummary: text('concise_summary'),
    useCase: text('use_case'),
    problemDescription: text('problem_description'),
    status: supportRequestStatus('status')
})
