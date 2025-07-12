import { nanoid } from 'common/nanoid'
import { bigint, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { organization } from './auth-schema'

const supportRequestStatusValues = ['pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard'] as const
const mcpServerAuthTypeValues = ['oauth', 'none', 'collect_email'] as const

export const supportRequestStatus = pgEnum('support_request_status', supportRequestStatusValues)
export const supportRequestMethod = pgEnum('support_request_method', supportRequestMethodValues)
export const mcpServerAuthType = pgEnum('mcp_server_auth_type', mcpServerAuthTypeValues)

export const supportRequests = pgTable('support_requests', {
    id: text('id').$defaultFn(() => `sr_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    conciseSummary: text('concise_summary'),
    useCase: text('use_case'),
    problemDescription: text('problem_description'),
    status: supportRequestStatus('status')
})

export type SupportRequest = typeof supportRequests.$inferSelect

export const mcpServers = pgTable('mcp_servers', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `${nanoid(8)}`),
    organizationId: text('organization_id')
        .references(() => organization.id)
        .notNull(),
    name: text('name').notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    authType: mcpServerAuthType('auth_type').default('none'),
    informationMessage: text('information_message'),
    supportTicketType: supportRequestMethod('support_ticket_type').default('dashboard')
})
