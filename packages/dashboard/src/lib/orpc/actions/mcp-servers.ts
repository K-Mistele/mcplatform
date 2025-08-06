'use server'
import { db, schema } from 'database'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '../../auth/auth'
import { createMcpServerSchema, validateSubdomainSchema } from '../../schemas.isometric'
import { base } from '../router'

export const createMcpServerAction = base
    .input(createMcpServerSchema)
    .handler(async ({ input, errors, context }) => {
        const session = await requireSession()
        console.log(`Creating new MCP server for organization ${session.session.activeOrganizationId}`)

        const [newMcpServer] = await db
            .insert(schema.mcpServers)
            .values({
                ...input,
                organizationId: session.session.activeOrganizationId
            })
            .returning()
        revalidatePath('/dashboard/mcp-servers')
        return newMcpServer
    })
    .actionable({})

export const deleteMcpServerAction = base
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ input, errors, context }) => {
        const session = await requireSession()
        console.log(`Deleting MCP server ${input.serverId}`)

        const [deletedServer] = await db
            .delete(schema.mcpServers)
            .where(
                and(
                    eq(schema.mcpServers.id, input.serverId),
                    eq(schema.mcpServers.organizationId, session.session.activeOrganizationId)
                )
            )
            .returning()

        if (!deletedServer) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'MCP server not found'
            })
        }

        revalidatePath('/dashboard/mcp-servers')
        revalidatePath(`/dashboard/mcp-servers/${input.serverId}`)
        return { success: true }
    })
    .actionable({})

export const validateSubdomainAction = base
    .input(validateSubdomainSchema)
    .handler(async ({ input, errors, context }) => {
        await requireSession()

        const sanitizedSubdomain = input.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '')
        if (sanitizedSubdomain !== input.subdomain)
            throw errors.INVALID_SUBDOMAIN({
                message: 'Invalid server slug. Server slugs may only contain letters, numbers, and hyphens.'
            })

        if (sanitizedSubdomain.length > 36)
            throw errors.INVALID_SUBDOMAIN({
                message: 'Invalid server slug. Server slugs may only be 36 characters or less.'
            })

        if (sanitizedSubdomain.length < 6)
            throw errors.INVALID_SUBDOMAIN({
                message: 'Invalid server slug. Server slugs must be at least 6 characters long.'
            })

        const [server] = await db.select().from(schema.mcpServers).where(eq(schema.mcpServers.slug, input.subdomain))
        if (server)
            throw errors.SUBDOMAIN_ALREADY_EXISTS({
                message: 'Server slug already exists. Server slugs must be globally unique.'
            })
        return { success: true }
    })
    .actionable()

export const updateMcpServerConfiguration = base
    .input(
        z.object({
            serverId: z.string(),
            authType: z.enum(['platform_oauth', 'custom_oauth', 'none', 'collect_email']),
            supportTicketType: z.enum(['slack', 'linear', 'dashboard', 'none'])
        })
    )
    .handler(async ({ input, errors, context }) => {
        const session = await requireSession()
        console.log(`Updating configuration for MCP server ${input.serverId}`)

        const [updatedServer] = await db
            .update(schema.mcpServers)
            .set({
                authType: input.authType,
                supportTicketType: input.supportTicketType
            })
            .where(
                and(
                    eq(schema.mcpServers.id, input.serverId),
                    eq(schema.mcpServers.organizationId, session.session.activeOrganizationId)
                )
            )
            .returning()

        if (!updatedServer) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'MCP server not found'
            })
        }

        revalidatePath(`/dashboard/mcp-servers/${input.serverId}`)
        return updatedServer
    })
    .actionable({})

export const deleteMcpUsersAction = base
    .input(z.object({ userIds: z.array(z.string()) }))
    .handler(async ({ input, errors, context }) => {
        const session = await requireSession()
        console.log(`Deleting MCP users: ${input.userIds.join(', ')}`)

        if (input.userIds.length === 0) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'No users specified for deletion'
            })
        }

        // Delete users where their ID is in the array AND they belong to the current organization
        // We use a subquery to get all user IDs that belong to the current organization
        const userIdsInOrganization = db
            .select({ id: schema.mcpServerUser.id })
            .from(schema.mcpServerUser)
            .innerJoin(schema.mcpServerSession, eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id))
            .innerJoin(schema.mcpServers, eq(schema.mcpServerSession.mcpServerSlug, schema.mcpServers.slug))
            .where(eq(schema.mcpServers.organizationId, session.session.activeOrganizationId))

        const deletedUsers = await db
            .delete(schema.mcpServerUser)
            .where(
                and(
                    inArray(schema.mcpServerUser.id, input.userIds),
                    inArray(schema.mcpServerUser.id, userIdsInOrganization)
                )
            )
            .returning()

        if (deletedUsers.length === 0) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'No users found or you do not have permission to delete these users'
            })
        }

        console.log(`Successfully deleted ${deletedUsers.length} users`)

        revalidatePath('/dashboard/users')
        return {
            deletedCount: deletedUsers.length,
            deletedUserIds: deletedUsers.map((user) => user.trackingId).filter(Boolean)
        }
    })
    .actionable({})
