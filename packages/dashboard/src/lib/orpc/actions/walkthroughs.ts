'use server'
import { db, schema } from 'database'
import { and, eq, max } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireSession } from '../../auth/auth'
import { base } from '../router'

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
        revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}/edit`)
        revalidatePath(`/dashboard/walkthroughs/${input.walkthroughId}/settings`)
        return updatedWalkthrough
    })
    .actionable({})

export const deleteWalkthroughAction = base
    .input(z.object({ walkthroughId: z.string() }))
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // First delete all steps (cascaded by database but good to be explicit)
        await db.delete(schema.walkthroughSteps).where(eq(schema.walkthroughSteps.walkthroughId, input.walkthroughId))

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
