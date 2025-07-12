'use server'

import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '../auth/auth'
import { createMcpServerSchema } from '../schemas.isometric'
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

export const createMcpServer = base
    .input(createMcpServerSchema)
    .handler(async ({ input, errors, context }) => {
        const session = await requireSession()
        console.log(`Creating new MCP server for organization ${session.session.activeOrganizationId}`)

        const [newMcpServer] = await db
            .insert(schema.mcpServers)
            .values({
                name: input.name,
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

export const deleteServerAction = base
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
