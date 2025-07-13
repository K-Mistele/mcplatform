'use server'

import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '../auth/auth'
import { createMcpServerSchema, validateSubdomainSchema } from '../schemas.isometric'
import { base } from './router'

export const redirectExample = base
    .handler(async ({ input, errors }) => {
        throw errors.UNAUTHORIZED({
            message: 'Unauthorized'
        })
    })
    .actionable({
        context: async () => ({}) // Optional: provide initial context if needed
    })

export const createMcpServerAction = base
    .input(createMcpServerSchema)
    .handler(async ({ input, errors, context }) => {
        const session = await requireSession()
        console.log(`Creating new MCP server for organization ${session.session.activeOrganizationId}`)

        const [newMcpServer] = await db
            .insert(schema.mcpServers)
            .values({
                name: input.name,
                slug: input.slug,
                authType: input.authType,
                supportTicketType: input.supportTicketType,
                informationMessage: input.informationMessage,
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

export const setMcpInformationMessage = base
    .input(z.object({ serverId: z.string(), informationMessage: z.string() }))
    .handler(async ({ input, errors, context }) => {
        const session = await requireSession()
        console.log(`Setting instructions for MCP server ${input.serverId}`)

        const [updatedServer] = await db
            .update(schema.mcpServers)
            .set({
                informationMessage: input.informationMessage
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
