'use server'
import { db, schema } from 'database'
import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '../../auth/auth'
import { base } from '../router'

export const assignWalkthroughsToServerAction = base
    .input(
        z.object({
            serverId: z.string(),
            walkthroughIds: z.array(
                z.object({
                    walkthroughId: z.string(),
                    displayOrder: z.number().optional()
                })
            )
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify server belongs to organization
        const [server] = await db
            .select({ id: schema.mcpServers.id })
            .from(schema.mcpServers)
            .where(
                and(
                    eq(schema.mcpServers.id, input.serverId),
                    eq(schema.mcpServers.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!server) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'MCP server not found'
            })
        }

        // Verify all walkthroughs belong to organization
        const walkthroughIdsToAssign = input.walkthroughIds.map((w) => w.walkthroughId)
        const walkthroughs = await db
            .select({ id: schema.walkthroughs.id })
            .from(schema.walkthroughs)
            .where(
                and(
                    inArray(schema.walkthroughs.id, walkthroughIdsToAssign),
                    eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
                )
            )

        if (walkthroughs.length !== walkthroughIdsToAssign.length) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'One or more walkthroughs not found'
            })
        }

        // Clear existing assignments
        await db
            .delete(schema.mcpServerWalkthroughs)
            .where(eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId))

        // Create new assignments
        if (input.walkthroughIds.length > 0) {
            const assignments = input.walkthroughIds.map((w, index) => ({
                mcpServerId: input.serverId,
                walkthroughId: w.walkthroughId,
                displayOrder: w.displayOrder ?? index,
                isEnabled: 'true' as const
            }))

            await db.insert(schema.mcpServerWalkthroughs).values(assignments)
        }

        revalidatePath(`/dashboard/mcp-servers/${input.serverId}`)
        return { success: true }
    })
    .actionable({})

export const updateWalkthroughAssignmentAction = base
    .input(
        z.object({
            serverId: z.string(),
            walkthroughId: z.string(),
            displayOrder: z.number().optional(),
            isEnabled: z.boolean().optional()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify assignment exists and user has access
        const [assignment] = await db
            .select({
                assignment: schema.mcpServerWalkthroughs,
                organizationId: schema.mcpServers.organizationId
            })
            .from(schema.mcpServerWalkthroughs)
            .innerJoin(schema.mcpServers, eq(schema.mcpServerWalkthroughs.mcpServerId, schema.mcpServers.id))
            .where(
                and(
                    eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId),
                    eq(schema.mcpServerWalkthroughs.walkthroughId, input.walkthroughId)
                )
            )

        if (!assignment || assignment.organizationId !== session.session.activeOrganizationId) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Assignment not found'
            })
        }

        // Update specified fields
        const updateData: any = {}
        if (input.displayOrder !== undefined) updateData.displayOrder = input.displayOrder
        if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled ? 'true' : 'false'

        if (Object.keys(updateData).length === 0) {
            return assignment.assignment
        }

        const [updatedAssignment] = await db
            .update(schema.mcpServerWalkthroughs)
            .set(updateData)
            .where(
                and(
                    eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId),
                    eq(schema.mcpServerWalkthroughs.walkthroughId, input.walkthroughId)
                )
            )
            .returning()

        revalidatePath(`/dashboard/mcp-servers/${input.serverId}`)
        return updatedAssignment
    })
    .actionable({})

export const removeWalkthroughAssignmentAction = base
    .input(
        z.object({
            serverId: z.string(),
            walkthroughId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify assignment exists and user has access
        const [assignment] = await db
            .select({
                assignment: schema.mcpServerWalkthroughs,
                organizationId: schema.mcpServers.organizationId,
                displayOrder: schema.mcpServerWalkthroughs.displayOrder
            })
            .from(schema.mcpServerWalkthroughs)
            .innerJoin(schema.mcpServers, eq(schema.mcpServerWalkthroughs.mcpServerId, schema.mcpServers.id))
            .where(
                and(
                    eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId),
                    eq(schema.mcpServerWalkthroughs.walkthroughId, input.walkthroughId)
                )
            )

        if (!assignment || assignment.organizationId !== session.session.activeOrganizationId) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Assignment not found'
            })
        }

        // Delete the assignment
        await db
            .delete(schema.mcpServerWalkthroughs)
            .where(
                and(
                    eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId),
                    eq(schema.mcpServerWalkthroughs.walkthroughId, input.walkthroughId)
                )
            )

        // Reorder remaining assignments
        const remainingAssignments = await db
            .select()
            .from(schema.mcpServerWalkthroughs)
            .where(eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId))
            .orderBy(schema.mcpServerWalkthroughs.displayOrder)

        const updatePromises = remainingAssignments.map((assignment, index) =>
            db
                .update(schema.mcpServerWalkthroughs)
                .set({ displayOrder: index })
                .where(
                    and(
                        eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId),
                        eq(schema.mcpServerWalkthroughs.walkthroughId, assignment.walkthroughId)
                    )
                )
        )

        await Promise.all(updatePromises)

        revalidatePath(`/dashboard/mcp-servers/${input.serverId}`)
        return { success: true }
    })
    .actionable({})

export const reorderServerWalkthroughsAction = base
    .input(
        z.object({
            serverId: z.string(),
            walkthroughIds: z.array(z.string())
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify server belongs to organization
        const [server] = await db
            .select({ id: schema.mcpServers.id })
            .from(schema.mcpServers)
            .where(
                and(
                    eq(schema.mcpServers.id, input.serverId),
                    eq(schema.mcpServers.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!server) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'MCP server not found'
            })
        }

        // Verify all walkthroughs are assigned to the server
        const assignments = await db
            .select({ walkthroughId: schema.mcpServerWalkthroughs.walkthroughId })
            .from(schema.mcpServerWalkthroughs)
            .where(eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId))

        const assignedWalkthroughIds = new Set(assignments.map((a) => a.walkthroughId))
        const allWalkthroughsAssigned = input.walkthroughIds.every((id) => assignedWalkthroughIds.has(id))

        if (!allWalkthroughsAssigned) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'One or more walkthroughs are not assigned to this server'
            })
        }

        // Update display order for each walkthrough
        const updatePromises = input.walkthroughIds.map((walkthroughId, index) =>
            db
                .update(schema.mcpServerWalkthroughs)
                .set({ displayOrder: index })
                .where(
                    and(
                        eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId),
                        eq(schema.mcpServerWalkthroughs.walkthroughId, walkthroughId)
                    )
                )
        )

        await Promise.all(updatePromises)

        revalidatePath(`/dashboard/mcp-servers/${input.serverId}`)
        return { success: true }
    })
    .actionable({})

export const getServerWalkthroughsAction = base
    .input(z.object({ serverId: z.string() }))
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify server belongs to organization
        const [server] = await db
            .select({ id: schema.mcpServers.id })
            .from(schema.mcpServers)
            .where(
                and(
                    eq(schema.mcpServers.id, input.serverId),
                    eq(schema.mcpServers.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!server) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'MCP server not found'
            })
        }

        // Get assigned walkthroughs with their details
        const walkthroughs = await db
            .select({
                walkthrough: schema.walkthroughs,
                assignment: {
                    displayOrder: schema.mcpServerWalkthroughs.displayOrder,
                    isEnabled: schema.mcpServerWalkthroughs.isEnabled
                }
            })
            .from(schema.mcpServerWalkthroughs)
            .innerJoin(schema.walkthroughs, eq(schema.mcpServerWalkthroughs.walkthroughId, schema.walkthroughs.id))
            .where(eq(schema.mcpServerWalkthroughs.mcpServerId, input.serverId))
            .orderBy(schema.mcpServerWalkthroughs.displayOrder)

        return walkthroughs
    })
    .actionable({})
