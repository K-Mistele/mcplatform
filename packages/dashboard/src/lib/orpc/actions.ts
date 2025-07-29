'use server'

import { db, schema } from 'database'
import { and, eq, inArray, max, sql } from 'drizzle-orm'
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
                    inArray(schema.mcpServerUser.trackingId, input.userIds),
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

// Support Ticket Management Actions

export const updateSupportTicketStatus = base
    .input(
        z.object({
            ticketId: z.string(),
            status: z.enum(['needs_email', 'pending', 'in_progress', 'resolved', 'closed']),
            comment: z.string().optional()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify ticket belongs to user's organization
        const [ticket] = await db
            .select()
            .from(schema.supportRequests)
            .where(
                and(
                    eq(schema.supportRequests.id, input.ticketId),
                    eq(schema.supportRequests.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!ticket) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Support ticket not found'
            })
        }

        // Update ticket status
        const [updatedTicket] = await db
            .update(schema.supportRequests)
            .set({
                status: input.status,
                resolvedAt: input.status === 'resolved' || input.status === 'closed' ? Date.now() : null
            })
            .where(eq(schema.supportRequests.id, input.ticketId))
            .returning()

        // Create activity entry for status change
        const activityContent = {
            oldStatus: ticket.status,
            newStatus: input.status
        }

        await db.insert(schema.supportTicketActivities).values({
            supportRequestId: input.ticketId,
            userId: session.user.id,
            activityType: 'status_change',
            content: activityContent,
            contentType: 'json',
            metadata: input.comment ? { comment: input.comment } : null
        })

        revalidatePath(`/dashboard/support-tickets/${input.ticketId}`)
        revalidatePath('/dashboard/support-tickets')
        return updatedTicket
    })
    .actionable({})

export const addSupportTicketComment = base
    .input(
        z.object({
            ticketId: z.string(),
            content: z.any(),
            contentType: z.enum(['text', 'markdown', 'json']).default('json')
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify ticket belongs to user's organization
        const [ticket] = await db
            .select()
            .from(schema.supportRequests)
            .where(
                and(
                    eq(schema.supportRequests.id, input.ticketId),
                    eq(schema.supportRequests.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!ticket) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Support ticket not found'
            })
        }

        // Create comment activity
        const [activity] = await db
            .insert(schema.supportTicketActivities)
            .values({
                supportRequestId: input.ticketId,
                userId: session.user.id,
                activityType: 'comment',
                content: input.content,
                contentType: input.contentType
            })
            .returning()

        revalidatePath(`/dashboard/support-tickets/${input.ticketId}`)
        return activity
    })
    .actionable({})

export const updateSupportTicketFields = base
    .input(
        z.object({
            ticketId: z.string(),
            title: z.string().optional(),
            conciseSummary: z.string().optional(),
            priority: z.enum(['low', 'medium', 'high', 'critical']).optional()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify ticket belongs to user's organization
        const [ticket] = await db
            .select()
            .from(schema.supportRequests)
            .where(
                and(
                    eq(schema.supportRequests.id, input.ticketId),
                    eq(schema.supportRequests.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!ticket) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Support ticket not found'
            })
        }

        // Build update object with only provided fields
        const updateData: any = {}
        if (input.title !== undefined) updateData.title = input.title
        if (input.conciseSummary !== undefined) updateData.conciseSummary = input.conciseSummary
        if (input.priority !== undefined) updateData.priority = input.priority

        if (Object.keys(updateData).length === 0) {
            return ticket
        }

        // Update ticket fields
        const [updatedTicket] = await db
            .update(schema.supportRequests)
            .set(updateData)
            .where(eq(schema.supportRequests.id, input.ticketId))
            .returning()

        // Create activity entry for field updates
        const changes: Record<string, { old: any; new: any }> = {}
        if (input.title !== undefined && input.title !== ticket.title) {
            changes.title = { old: ticket.title, new: input.title }
        }
        if (input.conciseSummary !== undefined && input.conciseSummary !== ticket.conciseSummary) {
            changes.conciseSummary = { old: ticket.conciseSummary, new: input.conciseSummary }
        }
        if (input.priority !== undefined && input.priority !== ticket.priority) {
            changes.priority = { old: ticket.priority, new: input.priority }
        }

        if (Object.keys(changes).length > 0) {
            await db.insert(schema.supportTicketActivities).values({
                supportRequestId: input.ticketId,
                userId: session.user.id,
                activityType: 'field_update',
                content: changes,
                contentType: 'json'
            })
        }

        revalidatePath(`/dashboard/support-tickets/${input.ticketId}`)
        revalidatePath('/dashboard/support-tickets')
        return updatedTicket
    })
    .actionable({})

export const assignSupportTicket = base
    .input(
        z.object({
            ticketId: z.string(),
            assigneeId: z.string().nullable()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify ticket belongs to user's organization
        const [ticket] = await db
            .select()
            .from(schema.supportRequests)
            .where(
                and(
                    eq(schema.supportRequests.id, input.ticketId),
                    eq(schema.supportRequests.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!ticket) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Support ticket not found'
            })
        }

        // If assigning to someone, verify they're in the same organization
        if (input.assigneeId) {
            const [assignee] = await db
                .select()
                .from(schema.user)
                .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
                .where(
                    and(
                        eq(schema.user.id, input.assigneeId),
                        eq(schema.member.organizationId, session.session.activeOrganizationId)
                    )
                )

            if (!assignee) {
                throw errors.RESOURCE_NOT_FOUND({
                    message: 'Assignee not found in organization'
                })
            }
        }

        // Update ticket assignee
        const [updatedTicket] = await db
            .update(schema.supportRequests)
            .set({ assigneeId: input.assigneeId })
            .where(eq(schema.supportRequests.id, input.ticketId))
            .returning()

        // Create activity entry for assignment change
        const activityContent = {
            oldAssigneeId: ticket.assigneeId,
            newAssigneeId: input.assigneeId
        }

        await db.insert(schema.supportTicketActivities).values({
            supportRequestId: input.ticketId,
            userId: session.user.id,
            activityType: 'assignment',
            content: activityContent,
            contentType: 'json'
        })

        revalidatePath(`/dashboard/support-tickets/${input.ticketId}`)
        revalidatePath('/dashboard/support-tickets')
        return updatedTicket
    })
    .actionable({})

export const addSupportTicketCommentWithStatus = base
    .input(
        z.object({
            ticketId: z.string(),
            content: z.any(),
            contentType: z.enum(['text', 'markdown', 'json']).default('json'),
            status: z.enum(['needs_email', 'pending', 'in_progress', 'resolved', 'closed']).optional()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify ticket belongs to user's organization
        const [ticket] = await db
            .select()
            .from(schema.supportRequests)
            .where(
                and(
                    eq(schema.supportRequests.id, input.ticketId),
                    eq(schema.supportRequests.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!ticket) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Support ticket not found'
            })
        }

        // If status is changing, update the ticket
        let updatedTicket = ticket
        if (input.status && input.status !== ticket.status) {
            const [updated] = await db
                .update(schema.supportRequests)
                .set({
                    status: input.status,
                    resolvedAt: input.status === 'resolved' || input.status === 'closed' ? Date.now() : null
                })
                .where(eq(schema.supportRequests.id, input.ticketId))
                .returning()
            updatedTicket = updated
        }

        // Create comment activity with optional status change metadata
        const activityMetadata =
            input.status && input.status !== ticket.status
                ? {
                      statusChange: {
                          oldStatus: ticket.status,
                          newStatus: input.status
                      }
                  }
                : null

        const [activity] = await db
            .insert(schema.supportTicketActivities)
            .values({
                supportRequestId: input.ticketId,
                userId: session.user.id,
                activityType: 'comment',
                content: input.content,
                contentType: input.contentType,
                metadata: activityMetadata
            })
            .returning()

        revalidatePath(`/dashboard/support-tickets/${input.ticketId}`)
        return { activity, updatedTicket }
    })
    .actionable({})

export const editSupportTicketComment = base
    .input(
        z.object({
            activityId: z.string(),
            content: z.any(),
            contentType: z.enum(['text', 'markdown', 'json']).default('json')
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Find the activity and verify ownership
        const [activity] = await db
            .select({
                activity: schema.supportTicketActivities,
                ticketId: schema.supportRequests.id,
                organizationId: schema.supportRequests.organizationId
            })
            .from(schema.supportTicketActivities)
            .innerJoin(schema.supportRequests, eq(schema.supportTicketActivities.supportRequestId, schema.supportRequests.id))
            .where(eq(schema.supportTicketActivities.id, input.activityId))

        if (!activity) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Comment not found'
            })
        }

        // Verify ticket belongs to user's organization and user owns the comment
        if (activity.organizationId !== session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'Access denied'
            })
        }

        if (activity.activity.userId !== session.user.id) {
            throw errors.UNAUTHORIZED({
                message: 'You can only edit your own comments'
            })
        }

        // Update the comment
        const [updatedActivity] = await db
            .update(schema.supportTicketActivities)
            .set({
                content: input.content,
                contentType: input.contentType
            })
            .where(eq(schema.supportTicketActivities.id, input.activityId))
            .returning()

        revalidatePath(`/dashboard/support-tickets/${activity.ticketId}`)
        return updatedActivity
    })
    .actionable({})

export const deleteSupportTicketComment = base
    .input(
        z.object({
            activityId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Find the activity and verify ownership
        const [activity] = await db
            .select({
                activity: schema.supportTicketActivities,
                ticketId: schema.supportRequests.id,
                organizationId: schema.supportRequests.organizationId
            })
            .from(schema.supportTicketActivities)
            .innerJoin(schema.supportRequests, eq(schema.supportTicketActivities.supportRequestId, schema.supportRequests.id))
            .where(eq(schema.supportTicketActivities.id, input.activityId))

        if (!activity) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Comment not found'
            })
        }

        // Verify ticket belongs to user's organization and user owns the comment
        if (activity.organizationId !== session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'Access denied'
            })
        }

        if (activity.activity.userId !== session.user.id) {
            throw errors.UNAUTHORIZED({
                message: 'You can only delete your own comments'
            })
        }

        // Delete the comment
        await db
            .delete(schema.supportTicketActivities)
            .where(eq(schema.supportTicketActivities.id, input.activityId))

        revalidatePath(`/dashboard/support-tickets/${activity.ticketId}`)
        return { success: true }
    })
    .actionable({})

// Walkthrough Actions

export const createWalkthroughAction = base
    .input(
        z.object({
            title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
            description: z.string().max(500, 'Description must be 500 characters or less').optional(),
            type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
            isPublished: z.boolean().default(false)
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        const [newWalkthrough] = await db
            .insert(schema.walkthroughs)
            .values({
                title: input.title,
                description: input.description,
                type: input.type,
                status: input.isPublished ? 'published' : 'draft',
                organizationId: session.session.activeOrganizationId
            })
            .returning()

        revalidatePath('/dashboard/walkthroughs')
        return newWalkthrough
    })
    .actionable({})

export const updateWalkthroughAction = base
    .input(
        z.object({
            walkthroughId: z.string(),
            title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less').optional(),
            description: z.string().max(500, 'Description must be 500 characters or less').optional(),
            type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']).optional(),
            isPublished: z.boolean().optional()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        const updateData: any = {}
        if (input.title !== undefined) updateData.title = input.title
        if (input.description !== undefined) updateData.description = input.description
        if (input.type !== undefined) updateData.type = input.type
        if (input.isPublished !== undefined) updateData.status = input.isPublished ? 'published' : 'draft'
        updateData.updatedAt = Date.now()

        const [updatedWalkthrough] = await db
            .update(schema.walkthroughs)
            .set(updateData)
            .where(
                and(
                    eq(schema.walkthroughs.id, input.walkthroughId),
                    eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
                )
            )
            .returning()

        if (!updatedWalkthrough) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Walkthrough not found'
            })
        }

        revalidatePath('/dashboard/walkthroughs')
        revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
        return updatedWalkthrough
    })
    .actionable({})

export const deleteWalkthroughAction = base
    .input(z.object({ walkthroughId: z.string() }))
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // First delete all steps (cascaded by database but good to be explicit)
        await db
            .delete(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.walkthroughId, input.walkthroughId))

        // Then delete the walkthrough
        const [deletedWalkthrough] = await db
            .delete(schema.walkthroughs)
            .where(
                and(
                    eq(schema.walkthroughs.id, input.walkthroughId),
                    eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
                )
            )
            .returning()

        if (!deletedWalkthrough) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Walkthrough not found'
            })
        }

        revalidatePath('/dashboard/walkthroughs')
        return { success: true }
    })
    .actionable({})

export const createWalkthroughStepAction = base
    .input(
        z.object({
            walkthroughId: z.string(),
            title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less')
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify walkthrough belongs to organization
        const walkthrough = await db
            .select({ id: schema.walkthroughs.id })
            .from(schema.walkthroughs)
            .where(
                and(
                    eq(schema.walkthroughs.id, input.walkthroughId),
                    eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
                )
            )
            .limit(1)

        if (!walkthrough[0]) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Walkthrough not found'
            })
        }

        // Get the next display order
        const maxOrderResult = await db
            .select({ maxOrder: max(schema.walkthroughSteps.displayOrder) })
            .from(schema.walkthroughSteps)
            .where(eq(schema.walkthroughSteps.walkthroughId, input.walkthroughId))

        const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1

        const [newStep] = await db
            .insert(schema.walkthroughSteps)
            .values({
                walkthroughId: input.walkthroughId,
                title: input.title,
                displayOrder: nextOrder,
                contentFields: {
                    version: 'v1',
                    introductionForAgent: '',
                    contextForAgent: '',
                    contentForUser: '',
                    operationsForAgent: ''
                }
            })
            .returning()

        revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
        return newStep
    })
    .actionable({})

export const updateWalkthroughStepAction = base
    .input(
        z.object({
            stepId: z.string(),
            title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less').optional(),
            contentFields: z
                .object({
                    version: z.literal('v1'),
                    introductionForAgent: z.string().optional(),
                    contextForAgent: z.string().optional(),
                    contentForUser: z.string().optional(),
                    operationsForAgent: z.string().optional()
                })
                .partial()
                .optional()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Get the current step to verify ownership and get current contentFields
        const currentStep = await db
            .select({
                id: schema.walkthroughSteps.id,
                walkthroughId: schema.walkthroughSteps.walkthroughId,
                contentFields: schema.walkthroughSteps.contentFields,
                organizationId: schema.walkthroughs.organizationId
            })
            .from(schema.walkthroughSteps)
            .innerJoin(schema.walkthroughs, eq(schema.walkthroughSteps.walkthroughId, schema.walkthroughs.id))
            .where(eq(schema.walkthroughSteps.id, input.stepId))
            .limit(1)

        if (!currentStep[0]) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Step not found'
            })
        }

        if (currentStep[0].organizationId !== session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'Unauthorized'
            })
        }

        const updateData: any = { updatedAt: Date.now() }
        if (input.title !== undefined) updateData.title = input.title

        if (input.contentFields) {
            // Merge with existing contentFields
            const existingContentFields = currentStep[0].contentFields as any
            updateData.contentFields = {
                ...existingContentFields,
                ...input.contentFields
            }
        }

        const [updatedStep] = await db
            .update(schema.walkthroughSteps)
            .set(updateData)
            .where(eq(schema.walkthroughSteps.id, input.stepId))
            .returning()

        revalidatePath(`/dashboard/walkthroughs/${currentStep[0].walkthroughId}`)
        return updatedStep
    })
    .actionable({})

export const deleteWalkthroughStepAction = base
    .input(z.object({ stepId: z.string() }))
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Get the step to verify ownership and get walkthroughId for revalidation
        const step = await db
            .select({
                id: schema.walkthroughSteps.id,
                walkthroughId: schema.walkthroughSteps.walkthroughId,
                organizationId: schema.walkthroughs.organizationId
            })
            .from(schema.walkthroughSteps)
            .innerJoin(schema.walkthroughs, eq(schema.walkthroughSteps.walkthroughId, schema.walkthroughs.id))
            .where(eq(schema.walkthroughSteps.id, input.stepId))
            .limit(1)

        if (!step[0]) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Step not found'
            })
        }

        if (step[0].organizationId !== session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'Unauthorized'
            })
        }

        await db.delete(schema.walkthroughSteps).where(eq(schema.walkthroughSteps.id, input.stepId))

        revalidatePath(`/dashboard/walkthroughs/${step[0].walkthroughId}`)
        return { success: true }
    })
    .actionable({})

export const reorderWalkthroughStepsAction = base
    .input(
        z.object({
            walkthroughId: z.string(),
            stepIds: z.array(z.string())
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify walkthrough belongs to organization
        const walkthrough = await db
            .select({ id: schema.walkthroughs.id })
            .from(schema.walkthroughs)
            .where(
                and(
                    eq(schema.walkthroughs.id, input.walkthroughId),
                    eq(schema.walkthroughs.organizationId, session.session.activeOrganizationId)
                )
            )
            .limit(1)

        if (!walkthrough[0]) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Walkthrough not found'
            })
        }

        // Update display order for each step
        const updatePromises = input.stepIds.map((stepId, index) =>
            db
                .update(schema.walkthroughSteps)
                .set({ displayOrder: index + 1 })
                .where(
                    and(
                        eq(schema.walkthroughSteps.id, stepId),
                        eq(schema.walkthroughSteps.walkthroughId, input.walkthroughId)
                    )
                )
        )

        await Promise.all(updatePromises)

        revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}`)
        return { success: true }
    })
    .actionable({})
