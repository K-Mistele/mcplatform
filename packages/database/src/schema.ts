import { nanoid } from 'common/nanoid'
import { bigint, date, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { organization } from './auth-schema'

const supportRequestStatusValues = ['needs_email', 'pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard', 'none'] as const
const mcpServerAuthTypeValues = ['platform_oauth', 'custom_oauth', 'none', 'collect_email'] as const

export const supportRequestStatus = pgEnum('support_request_status', supportRequestStatusValues)
export const supportRequestMethod = pgEnum('support_request_method', supportRequestMethodValues)
export const mcpServerAuthType = pgEnum('mcp_server_auth_type', mcpServerAuthTypeValues)

export const supportRequests = pgTable('support_requests', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `sr_${nanoid(8)}`),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    title: text('title'),
    conciseSummary: text('concise_summary'),
    context: text('context'),
    status: supportRequestStatus('status').default('pending'),
    supportRequestMethod: supportRequestMethod('support_request_method').default('dashboard'),
    resolvedAt: bigint('resolved_at', { mode: 'number' }),
    email: text('email').notNull(),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    mcpServerId: text('mcp_server_id').references(() => mcpServers.id, { onDelete: 'cascade' })
})

export const mcpServers = pgTable('mcp_servers', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `${nanoid(8)}`),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    oauthIssuerUrl: text('oauth_issuer_url'),
    name: text('name').notNull(),
    productPlatformOrTool: text('product_platform_or_tool').notNull(),
    slug: text('slug').unique().notNull(),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    authType: mcpServerAuthType('auth_type').default('none'),
    supportTicketType: supportRequestMethod('support_ticket_type').default('dashboard')
})

export const mcpServerUser = pgTable('mcp_server_user', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => `mcpu_${nanoid(12)}`),
    trackingId: text('distinct_id').unique('mcp_server_user_distinct_id_unique', { nulls: 'not distinct' }),
    email: text('email'),
    firstSeenAt: bigint('first_seen_at', { mode: 'number' }).$defaultFn(() => Date.now())
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
    mcpServerUserId: text('mcp_server_user_id').references(() => mcpServerUser.id, { onDelete: 'cascade' }),
    mcpServerSessionId: text('mcp_server_session_id')
        .references(() => mcpServerSession.mcpServerSessionId, { onDelete: 'cascade' })
        .notNull(),
    input: jsonb('input'),
    output: jsonb('output')
})

export const mcpServerSession = pgTable('mcp_server_session', {
    mcpServerSessionId: text('mcp_server_session_id').primaryKey().notNull(),
    mcpServerSlug: text('mcp_server_slug')
        .references(() => mcpServers.slug, { onDelete: 'cascade' })
        .notNull(),
    connectionDate: date('connection_date')
        .notNull()
        .$defaultFn(() => new Date().toISOString()),
    connectionTimestamp: bigint('connection_timestamp', { mode: 'number' }).$defaultFn(() => Date.now()),
    mcpServerUserId: text('mcp_server_user_id').references(() => mcpServerUser.id, { onDelete: 'cascade' })
})

export type McpServerSession = typeof mcpServerSession.$inferSelect
export type McpServerUser = typeof mcpServerUser.$inferSelect
export type SupportRequest = typeof supportRequests.$inferSelect
export type McpServer = typeof mcpServers.$inferSelect
