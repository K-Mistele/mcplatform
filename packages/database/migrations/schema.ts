import { pgTable, foreignKey, text, bigint, unique, timestamp, boolean, jsonb, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const mcpServerAuthType = pgEnum("mcp_server_auth_type", ['platform_oauth', 'custom_oauth', 'none', 'collect_email'])
export const supportRequestMethod = pgEnum("support_request_method", ['slack', 'linear', 'dashboard', 'none'])
export const supportRequestStatus = pgEnum("support_request_status", ['needs_email', 'pending', 'in_progress', 'resolved', 'closed'])


export const supportRequests = pgTable("support_requests", {
	id: text().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
	conciseSummary: text("concise_summary"),
	context: text(),
	supportRequestMethod: supportRequestMethod("support_request_method").default('dashboard'),
	status: supportRequestStatus().default('pending'),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	resolvedAt: bigint("resolved_at", { mode: "number" }),
	email: text().notNull(),
	organizationId: text("organization_id").notNull(),
	mcpServerId: text("mcp_server_id"),
	title: text(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "support_requests_organization_id_organization_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.mcpServerId],
			foreignColumns: [mcpServers.id],
			name: "support_requests_mcp_server_id_mcp_servers_id_fk"
		}).onDelete("cascade"),
]);

export const oauthAccessToken = pgTable("oauth_access_token", {
	id: text().primaryKey().notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	clientId: text("client_id"),
	userId: text("user_id"),
	scopes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	unique("oauth_access_token_access_token_unique").on(table.accessToken),
	unique("oauth_access_token_refresh_token_unique").on(table.refreshToken),
]);

export const oauthApplication = pgTable("oauth_application", {
	id: text().primaryKey().notNull(),
	name: text(),
	icon: text(),
	metadata: text(),
	clientId: text("client_id"),
	clientSecret: text("client_secret"),
	redirectURLs: text("redirect_u_r_ls"),
	type: text(),
	disabled: boolean(),
	userId: text("user_id"),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [
	unique("oauth_application_client_id_unique").on(table.clientId),
]);

export const oauthConsent = pgTable("oauth_consent", {
	id: text().primaryKey().notNull(),
	clientId: text("client_id"),
	userId: text("user_id"),
	scopes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	consentGiven: boolean("consent_given"),
});

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const organization = pgTable("organization", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text(),
	logo: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	metadata: text(),
}, (table) => [
	unique("organization_slug_unique").on(table.slug),
]);

export const invitation = pgTable("invitation", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	email: text().notNull(),
	role: text(),
	status: text().default('pending').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	inviterId: text("inviter_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "invitation_organization_id_organization_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.inviterId],
			foreignColumns: [user.id],
			name: "invitation_inviter_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const member = pgTable("member", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id").notNull(),
	role: text().default('member').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "member_organization_id_organization_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "member_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
	activeOrganizationId: text("active_organization_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const mcpServerConnect = pgTable("mcp_server_connect", {
	transport: text(),
	slug: text(),
	email: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
	mcpServerDistinctId: text("mcp_server_distinct_id"),
}, (table) => [
	foreignKey({
			columns: [table.slug],
			foreignColumns: [mcpServers.slug],
			name: "mcp_server_connect_slug_mcp_servers_slug_fk"
		}),
]);

export const mcpServers = pgTable("mcp_servers", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	name: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
	authType: mcpServerAuthType("auth_type").default('none'),
	supportTicketType: supportRequestMethod("support_ticket_type").default('dashboard'),
	slug: text().notNull(),
	productPlatformOrTool: text("product_platform_or_tool").notNull(),
	oauthIssuerUrl: text("oauth_issuer_url"),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "mcp_servers_organization_id_organization_id_fk"
		}).onDelete("cascade"),
	unique("mcp_servers_slug_unique").on(table.slug),
]);

export const mcpServerUser = pgTable("mcp_server_user", {
	distinctId: text("distinct_id"),
	email: text(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	firstSeenAt: bigint("first_seen_at", { mode: "number" }),
	id: text().primaryKey().notNull(),
}, (table) => [
	unique("mcp_server_user_distinct_id_unique").on(table.distinctId),
]);

export const mcpToolCalls = pgTable("mcp_tool_calls", {
	id: text().primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	createdAt: bigint("created_at", { mode: "number" }),
	mcpServerId: text("mcp_server_id").notNull(),
	toolName: text("tool_name").notNull(),
	input: jsonb(),
	output: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.mcpServerId],
			foreignColumns: [mcpServers.id],
			name: "mcp_tool_calls_mcp_server_id_mcp_servers_id_fk"
		}),
]);
