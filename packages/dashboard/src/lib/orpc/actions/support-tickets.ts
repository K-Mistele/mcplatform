'use server'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '../../auth/auth'
import { base } from '../router'

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
            .innerJoin(
                schema.supportRequests,
                eq(schema.supportTicketActivities.supportRequestId, schema.supportRequests.id)
            )
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
            .innerJoin(
                schema.supportRequests,
                eq(schema.supportTicketActivities.supportRequestId, schema.supportRequests.id)
            )
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
        await db.delete(schema.supportTicketActivities).where(eq(schema.supportTicketActivities.id, input.activityId))

        revalidatePath(`/dashboard/support-tickets/${activity.ticketId}`)
        return { success: true }
    })
    .actionable({})
