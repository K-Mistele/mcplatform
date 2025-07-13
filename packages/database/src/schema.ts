import { nanoid } from 'common/nanoid'
import { bigint, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { organization } from './auth-schema'

const supportRequestStatusValues = ['needs_email', 'pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard', 'none'] as const
const mcpServerAuthTypeValues = ['oauth', 'none', 'collect_email'] as const

export const supportRequestStatus = pgEnum('support_request_status', supportRequestStatusValues)
export const supportRequestMethod = pgEnum('support_request_method', supportRequestMethodValues)
export const mcpServerAuthType = pgEnum('mcp_server_auth_type', mcpServerAuthTypeValues)

export const supportRequests = pgTable('support_requests', {
    id: text('id').$defaultFn(() => `sr_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    conciseSummary: text('concise_summary'),
    context: text('context'),
    status: supportRequestStatus('status').default('pending'),
    supportRequestMethod: supportRequestMethod('support_request_method').default('dashboard'),
    resolvedAt: bigint('resolved_at', { mode: 'number' })
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
    productPlatformOrTool: text('product_platform_or_tool').notNull(),
    slug: text('slug').unique().notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    authType: mcpServerAuthType('auth_type').default('none'),
    supportTicketType: supportRequestMethod('support_ticket_type').default('dashboard')
})

export const toolCalls = pgTable('mcp_tool_calls', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `tc_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    mcpServerId: text('mcp_server_id')
        .references(() => mcpServers.id)
        .notNull(),
    toolName: text('tool_name').notNull(),
    input: jsonb('input'),
    output: jsonb('output')
})
