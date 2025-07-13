import { relations } from "drizzle-orm/relations";
import { organization, supportRequests, mcpServers, user, account, invitation, member, session, mcpServerConnect, mcpToolCalls } from "./schema";

export const supportRequestsRelations = relations(supportRequests, ({one}) => ({
	organization: one(organization, {
		fields: [supportRequests.organizationId],
		references: [organization.id]
	}),
	mcpServer: one(mcpServers, {
		fields: [supportRequests.mcpServerId],
		references: [mcpServers.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	supportRequests: many(supportRequests),
	invitations: many(invitation),
	members: many(member),
	mcpServers: many(mcpServers),
}));

export const mcpServersRelations = relations(mcpServers, ({one, many}) => ({
	supportRequests: many(supportRequests),
	mcpServerConnects: many(mcpServerConnect),
	organization: one(organization, {
		fields: [mcpServers.organizationId],
		references: [organization.id]
	}),
	mcpToolCalls: many(mcpToolCalls),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	accounts: many(account),
	invitations: many(invitation),
	members: many(member),
	sessions: many(session),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id]
	}),
}));

export const memberRelations = relations(member, ({one}) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const mcpServerConnectRelations = relations(mcpServerConnect, ({one}) => ({
	mcpServer: one(mcpServers, {
		fields: [mcpServerConnect.slug],
		references: [mcpServers.slug]
	}),
}));

export const mcpToolCallsRelations = relations(mcpToolCalls, ({one}) => ({
	mcpServer: one(mcpServers, {
		fields: [mcpToolCalls.mcpServerId],
		references: [mcpServers.id]
	}),
}));