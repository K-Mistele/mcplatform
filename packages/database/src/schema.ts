import { nanoid } from 'common/nanoid'
import {
    type AnyPgColumn,
    bigint,
    date,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    text,
    unique
} from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { organization, user } from './auth-schema'

export const walkthroughStepContentFieldVersion1 = z.object({
    version: z.literal('v1'),
    introductionForAgent: z
        .string()
        .optional()
        .describe(
            'The introduction for the agent to read. Provides information about the step and what should be done.'
        ),
    contextForAgent: z
        .string()
        .optional()
        .describe(
            'Information about what the context is for the stpe, and where/how the agent can find more information.'
        ),
    contentForUser: z.string().describe('The specifics of what the agent should say / tell the user with the step'),
    operationsForAgent: z
        .string()
        .describe(
            'A list of operations that the agent should perform including CRUD operations on files, tools, MCP tools etc.'
        )
})
export const walkthroughStepContentField = z.discriminatedUnion('version', [walkthroughStepContentFieldVersion1])

const supportRequestStatusValues = ['needs_email', 'pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard', 'none'] as const
const mcpServerAuthTypeValues = ['platform_oauth', 'custom_oauth', 'none', 'collect_email'] as const
const activityTypeValues = ['comment', 'status_change', 'assignment', 'field_update', 'system'] as const
const priorityValues = ['low', 'medium', 'high', 'critical'] as const
const walkthroughStatusValues = ['draft', 'published', 'archived'] as const
const walkthroughTypeValues = ['course', 'installer', 'troubleshooting', 'integration', 'quickstart'] as const

export const supportRequestStatus = pgEnum('support_request_status', supportRequestStatusValues)
export const supportRequestMethod = pgEnum('support_request_method', supportRequestMethodValues)
export const mcpServerAuthType = pgEnum('mcp_server_auth_type', mcpServerAuthTypeValues)
export const supportTicketActivityType = pgEnum('support_ticket_activity_type', activityTypeValues)
export const supportTicketPriority = pgEnum('support_ticket_priority', priorityValues)
export const walkthroughStatus = pgEnum('walkthrough_status', walkthroughStatusValues)
export const walkthroughType = pgEnum('walkthrough_type', walkthroughTypeValues)

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
        supportTicketType: supportRequestMethod('support_ticket_type').default('dashboard'),
        walkthroughToolsEnabled: text('walkthrough_tools_enabled').$type<'true' | 'false'>().default('true')
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

export const walkthroughs = pgTable(
    'walkthroughs',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `wt_${nanoid(8)}`),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        title: text('title').notNull(),
        description: text('description'),
        type: walkthroughType('type').default('course'),
        status: walkthroughStatus('status').default('draft'),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        estimatedDurationMinutes: integer('estimated_duration_minutes'),
        tags: jsonb('tags').$type<string[]>().default([]),
        metadata: jsonb('metadata')
    },
    (t) => [
        index('walkthroughs_organization_id_idx').on(t.organizationId),
        index('walkthroughs_status_idx').on(t.status)
    ]
)

export const mcpServerWalkthroughs = pgTable(
    'mcp_server_walkthroughs',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `msw_${nanoid(8)}`),
        mcpServerId: text('mcp_server_id')
            .references(() => mcpServers.id, { onDelete: 'cascade' })
            .notNull(),
        walkthroughId: text('walkthrough_id')
            .references(() => walkthroughs.id, { onDelete: 'cascade' })
            .notNull(),
        displayOrder: integer('display_order').notNull().default(0),
        isEnabled: text('is_enabled').$type<'true' | 'false'>().notNull().default('true'),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('mcp_server_walkthroughs_server_id_idx').on(t.mcpServerId),
        index('mcp_server_walkthroughs_walkthrough_id_idx').on(t.walkthroughId),
        index('mcp_server_walkthroughs_display_order_idx').on(t.displayOrder),
        unique('mcp_server_walkthroughs_server_walkthrough_unique').on(t.mcpServerId, t.walkthroughId)
    ]
)

export const walkthroughSteps = pgTable(
    'walkthrough_steps',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `wts_${nanoid(8)}`),
        walkthroughId: text('walkthrough_id')
            .references(() => walkthroughs.id, { onDelete: 'cascade' })
            .notNull(),
        title: text('title').notNull(),
        contentFields: jsonb('content_fields').$type<z.infer<typeof walkthroughStepContentField>>().notNull().default({
            version: 'v1',
            introductionForAgent: '',
            contextForAgent: '',
            contentForUser: '',
            operationsForAgent: ''
        }),
        displayOrder: integer('display_order').notNull().default(0),
        nextStepId: text('next_step_id').references((): AnyPgColumn => walkthroughSteps.id),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        metadata: jsonb('metadata')
    },
    (t) => [
        index('walkthrough_steps_walkthrough_id_idx').on(t.walkthroughId),
        index('walkthrough_steps_display_order_idx').on(t.displayOrder),
        index('walkthrough_steps_next_step_id_idx').on(t.nextStepId)
    ]
)

export const walkthroughProgress = pgTable(
    'walkthrough_progress',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `wtp_${nanoid(8)}`),
        mcpServerUserId: text('mcp_server_user_id')
            .references(() => mcpServerUser.id, { onDelete: 'cascade' })
            .notNull(),
        walkthroughId: text('walkthrough_id')
            .references(() => walkthroughs.id, { onDelete: 'cascade' })
            .notNull(),
        completedSteps: jsonb('completed_steps').$type<string[]>().default([]),
        currentStepId: text('current_step_id').references(() => walkthroughSteps.id),
        completedAt: bigint('completed_at', { mode: 'number' }),
        startedAt: bigint('started_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        lastActivityAt: bigint('last_activity_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        metadata: jsonb('metadata')
    },
    (t) => [
        index('walkthrough_progress_user_id_idx').on(t.mcpServerUserId),
        index('walkthrough_progress_walkthrough_id_idx').on(t.walkthroughId),
        index('walkthrough_progress_last_activity_idx').on(t.lastActivityAt),
        index('walkthrough_progress_completed_steps_gin_idx').using('gin', t.completedSteps)
    ]
)

export type McpServerSession = typeof mcpServerSession.$inferSelect
export type McpServerUser = typeof mcpServerUser.$inferSelect
export type SupportRequest = typeof supportRequests.$inferSelect
export type SupportTicketActivity = typeof supportTicketActivities.$inferSelect
export type McpServer = typeof mcpServers.$inferSelect
export type Walkthrough = typeof walkthroughs.$inferSelect
export type McpServerWalkthrough = typeof mcpServerWalkthroughs.$inferSelect
export type WalkthroughStep = typeof walkthroughSteps.$inferSelect
export type WalkthroughProgress = typeof walkthroughProgress.$inferSelect

export const retrievalNamespace = pgTable(
    'retrieval_namespace',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `rn_${nanoid(8)}`),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        name: text('name').notNull(),
        description: text('description'),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        metadata: jsonb('metadata').$defaultFn(() => ({}))
    },
    (t) => [index('retrieval_namespace_name_idx').on(t.name)]
)

export const documents = pgTable(
    'retrieval_documents',
    {
        filePath: text('file_path').primaryKey(),
        fileName: text('file_name').notNull(),
        contentType: text('content_type').notNull(),
        metadata: jsonb('metadata').$defaultFn(() => ({})),
        tags: jsonb('tags').$type<string[]>().default([]),
        namespaceId: text('namespace_id')
            .references(() => retrievalNamespace.id, { onDelete: 'cascade' })
            .notNull(),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [index('retrieval_documents_namespace_id_idx').on(t.namespaceId)]
)
/**
 * TODO - note that we are NOT storing the embeddings since we will use turbopuffer to do that.
 */

export const chunks = pgTable(
    'retrieval_chunks',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `rc_${nanoid(16)}`),
        documentId: text('document_id')
            .references(() => documents.filePath, { onDelete: 'cascade' })
            .notNull(),
        namespaceId: text('namespace_id')
            .references(() => retrievalNamespace.id, { onDelete: 'cascade' })
            .notNull(),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        originalContent: text('original_content').notNull(),
        orderInDocument: integer('order_in_document').notNull(),
        contextualizedContent: text('contextualized_content').notNull(),
        metadata: jsonb('metadata').$defaultFn(() => ({})),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('retrieval_chunks_document_id_idx').on(t.documentId),
        index('retrieval_chunks_namespace_id_idx').on(t.namespaceId),
        //index('retrieval_chunks_embedding_index').using('hnsw', t.embedding.op('vector_cosine_ops')),
        unique('retrieval_chunks_unique_document_order').on(t.documentId, t.orderInDocument)
    ]
)

export const images = pgTable(
    'retrieval_images',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `ri_${nanoid(16)}`),
        url: text('url'),
        namespaceId: text('namespace_id')
            .references(() => retrievalNamespace.id, { onDelete: 'cascade' })
            .notNull(),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        contextualContent: text('contextual_content').notNull(),
        metadata: jsonb('metadata').$defaultFn(() => ({})),
        //embedding: vector('embedding', { dimensions: 3072 }), // Gemini's dimensionality
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('retrieval_images_namespace_id_idx').on(t.namespaceId),
        //index('retrieval_images_embedding_index').using('hnsw', t.embedding.op('vector_cosine_ops')),
        unique('retrieval_images_unique_url').on(t.url, t.namespaceId)
    ]
)

export type Image = typeof images.$inferSelect
export type Chunk = typeof chunks.$inferSelect
export type Document = typeof documents.$inferSelect
export type Namespace = typeof retrievalNamespace.$inferSelect
