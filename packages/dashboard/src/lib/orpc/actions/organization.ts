'use server'

import { db, schema } from 'database'
import { and, count, desc, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth, requireSession } from '../../auth/auth'
import { base } from '../router'

export const getOrganizationMembersAction = base
    .input(
        z.object({
            page: z.number().min(1).default(1),
            pageSize: z.number().min(1).max(100).default(20)
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        if (!session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'No active organization'
            })
        }

        const offset = (input.page - 1) * input.pageSize

        // Get organization members with user details
        const members = await db
            .select({
                id: schema.member.id,
                userId: schema.member.userId,
                role: schema.member.role,
                createdAt: schema.member.createdAt,
                name: schema.user.name,
                email: schema.user.email,
                image: schema.user.image
            })
            .from(schema.member)
            .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
            .where(eq(schema.member.organizationId, session.session.activeOrganizationId))
            .orderBy(desc(schema.member.createdAt))
            .limit(input.pageSize)
            .offset(offset)

        // Get total count for pagination
        const [{ totalCount }] = await db
            .select({ totalCount: count(schema.member.id) })
            .from(schema.member)
            .where(eq(schema.member.organizationId, session.session.activeOrganizationId))

        return {
            members,
            totalCount,
            page: input.page,
            pageSize: input.pageSize,
            totalPages: Math.ceil(totalCount / input.pageSize)
        }
    })
    .actionable({})

export const getOrganizationInvitationsAction = base
    .input(
        z.object({
            page: z.number().min(1).default(1),
            pageSize: z.number().min(1).max(100).default(20)
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        if (!session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'No active organization'
            })
        }

        const offset = (input.page - 1) * input.pageSize

        // Get pending invitations with inviter details
        const invitations = await db
            .select({
                id: schema.invitation.id,
                email: schema.invitation.email,
                role: schema.invitation.role,
                status: schema.invitation.status,
                expiresAt: schema.invitation.expiresAt,
                inviterName: schema.user.name,
                inviterEmail: schema.user.email
            })
            .from(schema.invitation)
            .innerJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
            .where(eq(schema.invitation.organizationId, session.session.activeOrganizationId))
            .orderBy(desc(schema.invitation.expiresAt))
            .limit(input.pageSize)
            .offset(offset)

        // Get total count for pagination
        const [{ totalCount }] = await db
            .select({ totalCount: count(schema.invitation.id) })
            .from(schema.invitation)
            .where(eq(schema.invitation.organizationId, session.session.activeOrganizationId))

        return {
            invitations,
            totalCount,
            page: input.page,
            pageSize: input.pageSize,
            totalPages: Math.ceil(totalCount / input.pageSize)
        }
    })
    .actionable({})

export const updateMemberRoleAction = base
    .input(
        z.object({
            memberId: z.string(),
            role: z.enum(['owner', 'admin', 'member'])
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        if (!session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'No active organization'
            })
        }

        // Get current user's role
        const [currentUserMember] = await db
            .select({ role: schema.member.role })
            .from(schema.member)
            .where(
                and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
            throw errors.UNAUTHORIZED({
                message: 'Insufficient permissions to update member roles'
            })
        }

        // Get the member being updated
        const [targetMember] = await db
            .select()
            .from(schema.member)
            .where(
                and(
                    eq(schema.member.id, input.memberId),
                    eq(schema.member.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!targetMember) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Member not found'
            })
        }

        // Prevent demotion of last owner
        if (targetMember.role === 'owner' && input.role !== 'owner') {
            const [{ ownerCount }] = await db
                .select({ ownerCount: count(schema.member.id) })
                .from(schema.member)
                .where(
                    and(
                        eq(schema.member.organizationId, session.session.activeOrganizationId),
                        eq(schema.member.role, 'owner')
                    )
                )

            if (ownerCount <= 1) {
                throw errors.UNAUTHORIZED({
                    message: 'Cannot demote the last owner of the organization'
                })
            }
        }

        // Use Better Auth API to update member role
        try {
            const result = await auth.api.updateMemberRole({
                body: {
                    memberId: input.memberId,
                    role: input.role
                },
                headers: await headers()
            })

            if (!result) {
                throw new Error('Failed to update member role')
            }

            revalidatePath('/dashboard/team/members')
            return result
        } catch (error) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Failed to update member role'
            })
        }
    })
    .actionable({})

export const inviteUserToOrganizationAction = base
    .input(
        z.object({
            email: z.string().email('Invalid email format'),
            role: z.enum(['owner', 'admin', 'member'])
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        if (!session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'No active organization'
            })
        }

        // Get current user's role to verify permissions
        const [currentUserMember] = await db
            .select({ role: schema.member.role })
            .from(schema.member)
            .where(
                and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
            throw errors.UNAUTHORIZED({
                message: 'Insufficient permissions to invite members'
            })
        }

        // Check if user is already a member
        const [existingMember] = await db
            .select()
            .from(schema.member)
            .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
            .where(
                and(
                    eq(schema.user.email, input.email),
                    eq(schema.member.organizationId, session.session.activeOrganizationId)
                )
            )

        if (existingMember) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'User is already a member of this organization'
            })
        }

        // Check for existing pending invitation
        const [existingInvitation] = await db
            .select()
            .from(schema.invitation)
            .where(
                and(
                    eq(schema.invitation.email, input.email),
                    eq(schema.invitation.organizationId, session.session.activeOrganizationId),
                    eq(schema.invitation.status, 'pending')
                )
            )

        if (existingInvitation) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'An invitation for this email already exists'
            })
        }

        try {
            // Create invitation in database
            const [newInvitation] = await db
                .insert(schema.invitation)
                .values({
                    id: crypto.randomUUID(),
                    organizationId: session.session.activeOrganizationId,
                    email: input.email,
                    role: input.role,
                    status: 'pending',
                    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
                    inviterId: session.user.id
                })
                .returning()

            revalidatePath('/dashboard/team/invitations')
            revalidatePath('/dashboard/team')
            return newInvitation
        } catch (error) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Failed to send invitation'
            })
        }
    })
    .actionable({})

export const resendInvitationAction = base
    .input(
        z.object({
            invitationId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        if (!session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'No active organization'
            })
        }

        // Verify invitation belongs to user's organization
        const [invitation] = await db
            .select()
            .from(schema.invitation)
            .where(
                and(
                    eq(schema.invitation.id, input.invitationId),
                    eq(schema.invitation.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!invitation) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Invitation not found'
            })
        }

        try {
            // Update invitation expiry to extend it (effectively resending)
            const [updatedInvitation] = await db
                .update(schema.invitation)
                .set({
                    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours from now
                    status: 'pending' // Reset status to pending if needed
                })
                .where(eq(schema.invitation.id, input.invitationId))
                .returning()

            revalidatePath('/dashboard/team/invitations')
            revalidatePath('/dashboard/team')
            return updatedInvitation
        } catch (error) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Failed to resend invitation'
            })
        }
    })
    .actionable({})

export const cancelInvitationAction = base
    .input(
        z.object({
            invitationId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        if (!session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'No active organization'
            })
        }

        // Verify invitation belongs to user's organization and user has permissions
        const [invitation] = await db
            .select()
            .from(schema.invitation)
            .where(
                and(
                    eq(schema.invitation.id, input.invitationId),
                    eq(schema.invitation.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!invitation) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Invitation not found'
            })
        }

        // Get current user's role to verify permissions
        const [currentUserMember] = await db
            .select({ role: schema.member.role })
            .from(schema.member)
            .where(
                and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
            throw errors.UNAUTHORIZED({
                message: 'Insufficient permissions to cancel invitations'
            })
        }

        try {
            // Use Better Auth API to cancel invitation
            await auth.api.cancelInvitation({
                body: {
                    invitationId: input.invitationId
                },
                headers: await headers()
            })

            revalidatePath('/dashboard/team/invitations')
            revalidatePath('/dashboard/team')
            return { success: true }
        } catch (error) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Failed to cancel invitation'
            })
        }
    })
    .actionable({})

export const removeMemberFromOrganizationAction = base
    .input(
        z.object({
            memberId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        if (!session.session.activeOrganizationId) {
            throw errors.UNAUTHORIZED({
                message: 'No active organization'
            })
        }

        // Get current user's role to verify permissions
        const [currentUserMember] = await db
            .select({ role: schema.member.role })
            .from(schema.member)
            .where(
                and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!currentUserMember || (currentUserMember.role !== 'owner' && currentUserMember.role !== 'admin')) {
            throw errors.UNAUTHORIZED({
                message: 'Insufficient permissions to remove members'
            })
        }

        // Get the member being removed
        const [targetMember] = await db
            .select({
                id: schema.member.id,
                userId: schema.member.userId,
                organizationId: schema.member.organizationId,
                role: schema.member.role,
                createdAt: schema.member.createdAt,
                email: schema.user.email
            })
            .from(schema.member)
            .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
            .where(
                and(
                    eq(schema.member.id, input.memberId),
                    eq(schema.member.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!targetMember) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Member not found'
            })
        }

        // Prevent users from removing themselves
        if (targetMember.userId === session.user.id) {
            throw errors.UNAUTHORIZED({
                message: 'You cannot remove yourself from the organization'
            })
        }

        // Prevent removal of last owner
        if (targetMember.role === 'owner') {
            const [{ ownerCount }] = await db
                .select({ ownerCount: count(schema.member.id) })
                .from(schema.member)
                .where(
                    and(
                        eq(schema.member.organizationId, session.session.activeOrganizationId),
                        eq(schema.member.role, 'owner')
                    )
                )

            if (ownerCount <= 1) {
                throw errors.UNAUTHORIZED({
                    message: 'Cannot remove the last owner of the organization'
                })
            }
        }

        try {
            console.log('Attempting to remove member:', {
                memberId: input.memberId,
                targetMember: targetMember,
                userId: targetMember.userId,
                organizationId: session.session.activeOrganizationId
            })

            // Use Better Auth API to remove member
            await auth.api.removeMember({
                body: {
                    memberIdOrEmail: targetMember.email,
                    organizationId: session.session.activeOrganizationId
                },
                headers: await headers()
            })

            // Revoke all active sessions for removed user
            await db
                .delete(schema.session)
                .where(eq(schema.session.userId, targetMember.userId))

            revalidatePath('/dashboard/team/members')
            return { success: true }
        } catch (error) {
            console.error('Error removing member:', error)
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Failed to remove member'
            })
        }
    })
    .actionable({})

export const acceptInvitationAction = base
    .input(
        z.object({
            invitationId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession({ data: { organizationRequired: false } })

        // Get the invitation
        const [invitation] = await db
            .select()
            .from(schema.invitation)
            .where(eq(schema.invitation.id, input.invitationId))

        if (!invitation) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Invitation not found'
            })
        }

        // Check if invitation is valid
        if (invitation.status !== 'pending') {
            throw errors.UNAUTHORIZED({
                message: 'Invitation has already been used or cancelled'
            })
        }

        // Check if invitation is expired
        const now = new Date()
        if (now > invitation.expiresAt) {
            throw errors.UNAUTHORIZED({
                message: 'Invitation has expired'
            })
        }

        // Check if the logged-in user's email matches the invitation
        if (session.user.email !== invitation.email) {
            throw errors.UNAUTHORIZED({
                message: 'This invitation was not sent to your email address'
            })
        }

        // Check if user is already a member of the organization
        const [existingMember] = await db
            .select()
            .from(schema.member)
            .where(
                and(
                    eq(schema.member.userId, session.user.id),
                    eq(schema.member.organizationId, invitation.organizationId)
                )
            )

        if (existingMember) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'You are already a member of this organization'
            })
        }

        if (!invitation.role) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Invitation has no role assigned'
            })
        }

        try {
            // Create member record
            const [newMember] = await db
                .insert(schema.member)
                .values({
                    id: crypto.randomUUID(),
                    organizationId: invitation.organizationId,
                    userId: session.user.id,
                    role: invitation.role,
                    createdAt: new Date()
                })
                .returning()

            // Mark invitation as accepted
            await db
                .update(schema.invitation)
                .set({ status: 'accepted' })
                .where(eq(schema.invitation.id, input.invitationId))

            // Set the organization as active so user doesn't need to select it
            try {
                await auth.api.setActiveOrganization({
                    headers: await headers(),
                    body: {
                        organizationId: invitation.organizationId
                    }
                })
            } catch (error) {
                // If setting active org fails, log but don't fail the invitation acceptance
                console.error('Failed to set active organization after invitation acceptance:', error)
            }

            revalidatePath('/dashboard/team/members')
            return newMember
        } catch (error) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Failed to accept invitation'
            })
        }
    })
    .actionable({})