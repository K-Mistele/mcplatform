import { nanoid } from 'common/nanoid'
import {
    type AnyPgColumn,
    bigint,
    date,
    foreignKey,
    index,
    integer,
    jsonb,
    pgEnum,
    pgTable,
    primaryKey,
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
export type WalkthroughStepContentFieldVersion1 = z.infer<typeof walkthroughStepContentFieldVersion1>
export const walkthroughStepContentField = z.discriminatedUnion('version', [walkthroughStepContentFieldVersion1])

const supportRequestStatusValues = ['needs_email', 'pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard', 'none'] as const
const mcpServerAuthTypeValues = ['platform_oauth', 'custom_oauth', 'none', 'collect_email'] as const
const activityTypeValues = ['comment', 'status_change', 'assignment', 'field_update', 'system'] as const
const priorityValues = ['low', 'medium', 'high', 'critical'] as const
const walkthroughStatusValues = ['draft', 'published', 'archived'] as const
const walkthroughTypeValues = ['course', 'installer', 'troubleshooting', 'integration', 'quickstart'] as const
const ingestionJobStatusValues = ['pending', 'in_progress', 'completed', 'failed'] as const

export const supportRequestStatus = pgEnum('support_request_status', supportRequestStatusValues)
export const supportRequestMethod = pgEnum('support_request_method', supportRequestMethodValues)
export const mcpServerAuthType = pgEnum('mcp_server_auth_type', mcpServerAuthTypeValues)
export const supportTicketActivityType = pgEnum('support_ticket_activity_type', activityTypeValues)
export const supportTicketPriority = pgEnum('support_ticket_priority', priorityValues)
export const walkthroughStatus = pgEnum('walkthrough_status', walkthroughStatusValues)
export const walkthroughType = pgEnum('walkthrough_type', walkthroughTypeValues)
export const ingestionJobStatus = pgEnum('ingestion_job_status', ingestionJobStatusValues)

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

// Custom OAuth Configuration Tables - Defined before mcpServers to avoid circular dependency
export const customOAuthConfigs = pgTable(
    'custom_oauth_configs',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `coac_${nanoid(8)}`),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        name: text('name').notNull(),
        authorizationUrl: text('authorization_url').notNull(),
        tokenUrl: text('token_url'),
        metadataUrl: text('metadata_url').notNull(),
        clientId: text('client_id').notNull(),
        clientSecret: text('client_secret').notNull(), // Will be encrypted in future
        scopes: text('scopes').default('openid profile email').notNull(),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('custom_oauth_configs_organization_id_idx').on(t.organizationId),
        unique('custom_oauth_configs_org_name_unique').on(t.organizationId, t.name)
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
        walkthroughToolsEnabled: text('walkthrough_tools_enabled').$type<'true' | 'false'>().default('true'),
        customOAuthConfigId: text('custom_oauth_config_id').references(() => customOAuthConfigs.id, { 
            onDelete: 'set null' 
        })
    },
    (t) => [index('mcp_server_slug_idx').on(t.slug)]
)

export const mcpServerUser = pgTable(
    'mcp_server_user',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `mcpu_${nanoid(12)}`),
        trackingId: text('distinct_id').unique('mcp_server_user_distinct_id_unique', { nulls: 'distinct' }),
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
        type: walkthroughType('type').default('course').notNull(),
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

export const walkthroughStepCompletions = pgTable(
    'walkthrough_step_completions',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `wtsc_${nanoid(8)}`),
        mcpServerUserId: text('mcp_server_user_id')
            .references(() => mcpServerUser.id, { onDelete: 'cascade' })
            .notNull(),
        walkthroughId: text('walkthrough_id')
            .references(() => walkthroughs.id, { onDelete: 'cascade' })
            .notNull(),
        stepId: text('step_id')
            .references(() => walkthroughSteps.id, { onDelete: 'cascade' })
            .notNull(),
        mcpServerId: text('mcp_server_id')
            .references(() => mcpServers.id, { onDelete: 'cascade' })
            .notNull(),
        mcpServerSessionId: text('mcp_server_session_id')
            .references(() => mcpServerSession.mcpServerSessionId, { onDelete: 'cascade' })
            .notNull(),
        completedAt: bigint('completed_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        metadata: jsonb('metadata')
    },
    (t) => [
        // Primary analytics query pattern: organization-wide time series via server JOIN
        index('wtsc_server_time_idx').on(t.mcpServerId, t.completedAt),
        // Sankey diagram queries: flow analysis within walkthrough
        index('wtsc_walkthrough_step_time_idx').on(t.walkthroughId, t.stepId, t.completedAt),
        // User progress queries: what has this user completed
        index('wtsc_user_walkthrough_idx').on(t.mcpServerUserId, t.walkthroughId),
        // Session analysis: completions within a session
        index('wtsc_session_idx').on(t.mcpServerSessionId),
        // Organization-wide walkthrough analytics
        index('wtsc_server_walkthrough_idx').on(t.mcpServerId, t.walkthroughId),
        // Prevent duplicate completions
        unique('wtsc_user_step_unique').on(t.mcpServerUserId, t.walkthroughId, t.stepId)
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
export type WalkthroughStepCompletion = typeof walkthroughStepCompletions.$inferSelect

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
        title: text('title'),
        filePath: text('file_path').notNull(),
        contentType: text('content_type'),
        metadata: jsonb('metadata').$defaultFn(() => ({})),
        tags: jsonb('tags').$type<string[]>().default([]),
        namespaceId: text('namespace_id')
            .references(() => retrievalNamespace.id, { onDelete: 'cascade' })
            .notNull(),
        organizationId: text('organization_id')
            .references(() => organization.id, { onDelete: 'cascade' })
            .notNull(),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        contentHash: text('content_hash').notNull()
    },
    (t) => [
        index('retrieval_documents_namespace_id_idx').on(t.namespaceId),
        unique('retrieval_documents_namespace_organization_unique').on(t.namespaceId, t.organizationId, t.filePath),
        primaryKey({
            columns: [t.filePath, t.organizationId, t.namespaceId],
            name: 'retrieval_documents_unique_file_path'
        })
    ]
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
        documentPath: text('document_path').notNull(),
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
        index('retrieval_chunks_document_path_order_idx').on(t.documentPath, t.namespaceId, t.organizationId),
        index('retrieval_chunks_namespace_id_idx').on(t.namespaceId),
        //index('retrieval_chunks_embedding_index').using('hnsw', t.embedding.op('vector_cosine_ops')),
        unique('retrieval_chunks_unique_document_order').on(
            t.documentPath,
            t.orderInDocument,
            t.namespaceId,
            t.organizationId
        ),
        foreignKey({
            columns: [t.documentPath, t.namespaceId, t.organizationId],
            foreignColumns: [documents.filePath, documents.namespaceId, documents.organizationId],
            name: 'retrieval_chunks_document_namespace_organization_fk'
        }).onDelete('cascade')
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

// Additional OAuth Tables for Proxy Implementation
export const upstreamOAuthTokens = pgTable(
    'upstream_oauth_tokens',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `uoat_${nanoid(8)}`),
        mcpServerUserId: text('mcp_server_user_id')
            .references(() => mcpServerUser.id, { onDelete: 'cascade' })
            .notNull(),
        oauthConfigId: text('oauth_config_id')
            .references(() => customOAuthConfigs.id, { onDelete: 'cascade' })
            .notNull(),
        accessToken: text('access_token').notNull(), // Will be encrypted in future
        refreshToken: text('refresh_token'), // Will be encrypted in future
        expiresAt: bigint('expires_at', { mode: 'number' }),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('upstream_oauth_tokens_mcp_server_user_id_idx').on(t.mcpServerUserId),
        index('upstream_oauth_tokens_oauth_config_id_idx').on(t.oauthConfigId),
        index('upstream_oauth_tokens_expires_at_idx').on(t.expiresAt)
    ]
)

// MCP Client Registration for Dynamic Client Registration
export const mcpClientRegistrations = pgTable(
    'mcp_client_registrations',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `mcr_${nanoid(8)}`),
        mcpServerId: text('mcp_server_id')
            .references(() => mcpServers.id, { onDelete: 'cascade' })
            .notNull(),
        clientId: text('client_id').notNull().unique(),
        clientSecret: text('client_secret'), // Nullable for public clients using 'none' auth method
        redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
        clientMetadata: jsonb('client_metadata'),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('mcp_client_registrations_mcp_server_id_idx').on(t.mcpServerId),
        index('mcp_client_registrations_client_id_idx').on(t.clientId)
    ]
)

// Authorization Sessions for tracking OAuth flow
export const mcpAuthorizationSessions = pgTable(
    'mcp_authorization_sessions',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `mas_${nanoid(8)}`),
        mcpClientRegistrationId: text('mcp_client_registration_id')
            .references(() => mcpClientRegistrations.id, { onDelete: 'cascade' })
            .notNull(),
        customOAuthConfigId: text('custom_oauth_config_id')
            .references(() => customOAuthConfigs.id, { onDelete: 'cascade' })
            .notNull(),
        state: text('state').notNull().unique(),
        clientState: text('client_state'),
        redirectUri: text('redirect_uri').notNull(),
        scope: text('scope').notNull(),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
        expiresAt: bigint('expires_at', { mode: 'number' }).notNull()
    },
    (t) => [
        index('mcp_authorization_sessions_state_idx').on(t.state),
        index('mcp_authorization_sessions_expires_at_idx').on(t.expiresAt)
    ]
)

// Authorization Codes we issue
export const mcpAuthorizationCodes = pgTable(
    'mcp_authorization_codes',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `mac_${nanoid(8)}`),
        mcpClientRegistrationId: text('mcp_client_registration_id')
            .references(() => mcpClientRegistrations.id, { onDelete: 'cascade' })
            .notNull(),
        upstreamTokenId: text('upstream_token_id')
            .references(() => upstreamOAuthTokens.id, { onDelete: 'cascade' })
            .notNull(),
        code: text('code').notNull().unique(),
        expiresAt: bigint('expires_at', { mode: 'number' }).notNull(),
        used: text('used').$type<'true' | 'false'>().notNull().default('false'),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('mcp_authorization_codes_code_idx').on(t.code),
        index('mcp_authorization_codes_expires_at_idx').on(t.expiresAt)
    ]
)

// Proxy Tokens we issue to MCP clients
export const mcpProxyTokens = pgTable(
    'mcp_proxy_tokens',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => `mpt_${nanoid(8)}`),
        mcpClientRegistrationId: text('mcp_client_registration_id')
            .references(() => mcpClientRegistrations.id, { onDelete: 'cascade' })
            .notNull(),
        upstreamTokenId: text('upstream_token_id')
            .references(() => upstreamOAuthTokens.id, { onDelete: 'cascade' })
            .notNull(),
        accessToken: text('access_token').notNull().unique(),
        refreshToken: text('refresh_token').unique(),
        expiresAt: bigint('expires_at', { mode: 'number' }),
        createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now())
    },
    (t) => [
        index('mcp_proxy_tokens_access_token_idx').on(t.accessToken),
        index('mcp_proxy_tokens_refresh_token_idx').on(t.refreshToken),
        index('mcp_proxy_tokens_expires_at_idx').on(t.expiresAt)
    ]
)

export type CustomOAuthConfig = typeof customOAuthConfigs.$inferSelect
export type UpstreamOAuthToken = typeof upstreamOAuthTokens.$inferSelect
export type McpClientRegistration = typeof mcpClientRegistrations.$inferSelect
export type McpAuthorizationSession = typeof mcpAuthorizationSessions.$inferSelect
export type McpAuthorizationCode = typeof mcpAuthorizationCodes.$inferSelect
export type McpProxyToken = typeof mcpProxyTokens.$inferSelect

export const ingestionJob = pgTable('retrieval_ingestion_job', {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
        .references(() => organization.id, { onDelete: 'cascade' })
        .notNull(),
    namespaceId: text('namespace_id')
        .references(() => retrievalNamespace.id, { onDelete: 'cascade' })
        .notNull(),
    status: ingestionJobStatus('status').default('pending'),
    createdAt: bigint('created_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    updatedAt: bigint('updated_at', { mode: 'number' }).$defaultFn(() => Date.now()),
    totalDocuments: integer('total_documents').notNull().default(0),
    documentsProcessed: integer('documents_processed').notNull().default(0),
    documentsFailed: integer('documents_failed').notNull().default(0)
})
