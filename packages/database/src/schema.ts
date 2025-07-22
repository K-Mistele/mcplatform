import { nanoid } from 'common/nanoid'
import { bigint, date, index, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { organization, user } from './auth-schema'

const supportRequestStatusValues = ['needs_email', 'pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard', 'none'] as const
const mcpServerAuthTypeValues = ['platform_oauth', 'custom_oauth', 'none', 'collect_email'] as const
const activityTypeValues = ['comment', 'status_change', 'assignment', 'field_update', 'system'] as const
const priorityValues = ['low', 'medium', 'high', 'critical'] as const

export const supportRequestStatus = pgEnum('support_request_status', supportRequestStatusValues)
export const supportRequestMethod = pgEnum('support_request_method', supportRequestMethodValues)
export const mcpServerAuthType = pgEnum('mcp_server_auth_type', mcpServerAuthTypeValues)
export const supportTicketActivityType = pgEnum('support_ticket_activity_type', activityTypeValues)
export const supportTicketPriority = pgEnum('support_ticket_priority', priorityValues)

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
    mcpServerId: text('mcp_server_id').references(() => mcpServers.id, { onDelete: 'cascade' }),
    mcpServerSessionId: text('mcp_server_session_id').references(() => mcpServerSession.mcpServerSessionId, {
        onDelete: 'cascade'
    }),
    assigneeId: text('assignee_id').references(() => user.id, { onDelete: 'set null' }),
    priority: supportTicketPriority('priority').default('medium')
})

export const supportTicketActivities = pgTable(
    'support_ticket_activities',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `sta_${nanoid(8)}`),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        supportRequestId: text('support_request_id')
            .references(() => supportRequests.id, { onDelete: 'cascade' })
            .notNull(),
        userId: text('user_id')
            .references(() => user.id, { onDelete: 'cascade' })
            .notNull(),
        activityType: supportTicketActivityType('activity_type').notNull(),
        content: jsonb('content'),
        contentType: text('content_type').default('text'),
        metadata: jsonb('metadata')
    },
    (t) => [
        index('support_ticket_activities_support_request_id_idx').on(t.supportRequestId),
        index('support_ticket_activities_created_at_idx').on(t.createdAt)
    ]
)

export const mcpServers = pgTable(
    'mcp_servers',
    {
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
    },
    (t) => [index('mcp_server_slug_idx').on(t.slug)]
)

export const mcpServerUser = pgTable(
    'mcp_server_user',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `mcpu_${nanoid(12)}`),
        trackingId: text('distinct_id').unique('mcp_server_user_distinct_id_unique', { nulls: 'not distinct' }),
        email: text('email'),
        firstSeenAt: bigint('first_seen_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [index('mcp_server_user_distinct_id_idx').on(t.trackingId), index('mcp_server_user_email_idx').on(t.email)]
)

export const toolCalls = pgTable(
    'mcp_tool_calls',
    {
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
    },
    (t) => [index('tool_calls_mcp_server_session_id_idx').on(t.mcpServerSessionId)]
)

export const mcpServerSession = pgTable(
    'mcp_server_session',
    {
        title: text('title'),
        mcpServerSessionId: text('mcp_server_session_id').primaryKey().notNull(),
        mcpServerSlug: text('mcp_server_slug')
            .references(() => mcpServers.slug, { onDelete: 'cascade' })
            .notNull(),
        connectionDate: date('connection_date')
            .notNull()
            .$defaultFn(() => new Date().toISOString()),
        connectionTimestamp: bigint('connection_timestamp', { mode: 'number' }).$defaultFn(() => Date.now()),
        mcpServerUserId: text('mcp_server_user_id').references(() => mcpServerUser.id, { onDelete: 'cascade' })
    },
    (t) => [
        index('mcp_server_session_user_id_idx').on(t.mcpServerUserId),
        index('mcp_server_session_mcp_server_slug_idx').on(t.mcpServerSlug)
    ]
)

export type McpServerSession = typeof mcpServerSession.$inferSelect
export type McpServerUser = typeof mcpServerUser.$inferSelect
export type SupportRequest = typeof supportRequests.$inferSelect
export type SupportTicketActivity = typeof supportTicketActivities.$inferSelect
export type McpServer = typeof mcpServers.$inferSelect
