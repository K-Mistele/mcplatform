import {
    db,
    mcpServerWalkthroughs,
    walkthroughProgress,
    walkthroughSteps,
    walkthroughs,
    walkthroughStepCompletions,
    type Walkthrough,
    type WalkthroughProgress,
    type WalkthroughStep
} from 'database'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

export interface CalculateNextStepResult {
    step: WalkthroughStep | null
    walkthrough: Walkthrough
    isCompleted: boolean
    totalSteps: number
    completedCount: number
    progressPercent: number
}

// Helper function to render step content from contentFields
function renderStepInstructions(step: WalkthroughStep): string {
    const fields = step.contentFields as any

    let content = ''

    if (fields.introductionForAgent) {
        content += `## Step Context\n${fields.introductionForAgent}\n\n`
    }

    if (fields.contextForAgent) {
        content += `## Background Information\n${fields.contextForAgent}\n\n`
    }

    content += `## User Content\n${fields.contentForUser}\n\n`

    if (fields.operationsForAgent) {
        content += `## Operations to Perform\n${fields.operationsForAgent}\n\n`
    }

    return content
}

export interface WalkthroughInfo extends Omit<Walkthrough, 'organizationId'> {
    totalSteps: number
    completedSteps: number
    progressPercent: number
    currentStepId?: string | null
    isCompleted: boolean
}

export interface WalkthroughListItem {
    walkthrough: Walkthrough
    progress: WalkthroughProgress | null
    totalSteps: number
    progressPercent: number
}

/**
 * Calculate the next step for a user in a walkthrough based on their progress.
 * This algorithm ensures progress is not lost when authors edit walkthroughs.
 */
export async function calculateNextStep(
    walkthroughId: string,
    progress: WalkthroughProgress | null
): Promise<CalculateNextStepResult | null> {
    const result = await db
        .select()
        .from(walkthroughSteps)
        .leftJoin(walkthroughs, eq(walkthroughSteps.walkthroughId, walkthroughs.id))
        .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
        .orderBy(asc(walkthroughSteps.displayOrder))

    if (result.length === 0) {
        return null
    }
    const steps = result.map((r) => r.walkthrough_steps)
    const [walkthrough] = result.map((r) => r.walkthroughs)
    if (!walkthrough) {
        return null
    }

    const completedStepIds = progress?.completedSteps || []
    const completedCount = completedStepIds.length
    const totalSteps = steps.length
    const progressPercent = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0

    // Find the first step that hasn't been completed
    const nextStep = steps.find((step) => !completedStepIds.includes(step.id))

    return {
        step: nextStep || null,
        walkthrough,
        isCompleted: !nextStep,
        totalSteps,
        completedCount,
        progressPercent: nextStep ? progressPercent : 100
    }
}

/**
 * Get or initialize walkthrough progress for a user
 */
export async function getOrInitializeProgress(
    mcpServerUserId: string,
    walkthroughId: string
): Promise<WalkthroughProgress> {
    const existingProgress = await db
        .select()
        .from(walkthroughProgress)
        .where(
            and(
                eq(walkthroughProgress.mcpServerUserId, mcpServerUserId),
                eq(walkthroughProgress.walkthroughId, walkthroughId)
            )
        )
        .limit(1)

    if (existingProgress[0]) {
        return existingProgress[0]
    }

    const [newProgress] = await db
        .insert(walkthroughProgress)
        .values({
            mcpServerUserId,
            walkthroughId,
            completedSteps: [],
            startedAt: Date.now(),
            lastActivityAt: Date.now()
        })
        .returning()

    return newProgress
}

/**
 * Mark a step as completed and update progress
 */
export async function completeStep(
    mcpServerUserId: string,
    walkthroughId: string,
    stepId: string,
    mcpServerId: string,
    mcpServerSessionId: string
): Promise<void> {
    const progress = await getOrInitializeProgress(mcpServerUserId, walkthroughId)

    // Parallelize validation queries - both are independent after we have progress
    const [stepResult, totalStepsResult] = await Promise.all([
        db
            .select()
            .from(walkthroughSteps)
            .where(and(eq(walkthroughSteps.id, stepId), eq(walkthroughSteps.walkthroughId, walkthroughId)))
            .limit(1),
        db
            .select({ count: sql<number>`count(*)` })
            .from(walkthroughSteps)
            .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
    ])

    const step = stepResult
    if (!step[0]) {
        throw new Error('Step not found or does not belong to this walkthrough')
    }

    // Add stepId to completedSteps if not already present
    const completedSteps = progress.completedSteps || []
    if (!completedSteps.includes(stepId)) {
        const updatedCompletedSteps = [...completedSteps, stepId]
        const isCompleted = updatedCompletedSteps.length >= totalStepsResult[0].count

        // Update progress
        await db
            .update(walkthroughProgress)
            .set({
                completedSteps: updatedCompletedSteps,
                lastActivityAt: Date.now(),
                completedAt: isCompleted ? Date.now() : null
            })
            .where(eq(walkthroughProgress.id, progress.id))

        // Insert step completion record for analytics
        try {
            await db.insert(walkthroughStepCompletions).values({
                mcpServerUserId,
                walkthroughId,
                stepId,
                mcpServerId,
                mcpServerSessionId,
                completedAt: Date.now(),
                metadata: {
                    stepOrder: step[0].displayOrder,
                    isLastStep: isCompleted
                }
            })
        } catch (error) {
            // Ignore duplicate key errors (user already completed this step)
            if (error instanceof Error && error.message.includes('duplicate key')) {
                console.log(`Step ${stepId} already completed by user ${mcpServerUserId}`)
            } else {
                throw error
            }
        }
    }
}

/**
 * Get all walkthroughs available to an MCP server with progress info
 */
export async function getServerWalkthroughs(
    mcpServerId: string,
    mcpServerUserId?: string
): Promise<WalkthroughListItem[]> {
    // First, we need to get the walkthrough data to know which IDs to query for progress
    const walkthroughsQuery = db
        .select({
            walkthrough: walkthroughs,
            totalSteps: sql<number>`count(${walkthroughSteps.id})`
        })
        .from(walkthroughs)
        .innerJoin(mcpServerWalkthroughs, eq(mcpServerWalkthroughs.walkthroughId, walkthroughs.id))
        .innerJoin(walkthroughSteps, eq(walkthroughSteps.walkthroughId, walkthroughs.id))
        .where(and(eq(mcpServerWalkthroughs.mcpServerId, mcpServerId), eq(walkthroughs.status, 'published')))
        .groupBy(walkthroughs.id)
        .orderBy(desc(walkthroughs.createdAt))

    const walkthroughsData = await walkthroughsQuery

    if (!mcpServerUserId) {
        return walkthroughsData.map(({ walkthrough, totalSteps }) => ({
            walkthrough,
            progress: null,
            totalSteps: Number(totalSteps),
            progressPercent: 0
        }))
    }

    // Get walkthrough IDs for progress query
    const walkthroughIds = walkthroughsData.map((w) => w.walkthrough.id)

    if (walkthroughIds.length === 0) {
        return []
    }

    // Query for progress data
    const progressData = await db
        .select()
        .from(walkthroughProgress)
        .where(
            and(
                eq(walkthroughProgress.mcpServerUserId, mcpServerUserId),
                inArray(walkthroughProgress.walkthroughId, walkthroughIds)
            )
        )

    // Create map for efficient lookups
    const progressMap = new Map(progressData.map((p) => [p.walkthroughId, p]))

    return walkthroughsData.map(({ walkthrough, totalSteps }) => {
        const progress = progressMap.get(walkthrough.id) || null
        const completedSteps = progress?.completedSteps?.length || 0
        const totalStepsNum = Number(totalSteps) // Convert to number since grouped queries return strings
        const progressPercent = totalStepsNum > 0 ? Math.round((completedSteps / totalStepsNum) * 100) : 0

        return {
            walkthrough,
            progress,
            totalSteps: totalStepsNum,
            progressPercent
        }
    })
}

/**
 * Get detailed walkthrough information with current step and progress
 */
export async function getWalkthroughDetails(
    walkthroughId: string,
    mcpServerUserId?: string
): Promise<WalkthroughInfo | null> {
    const walkthrough = await db.select().from(walkthroughs).where(eq(walkthroughs.id, walkthroughId)).limit(1)

    if (!walkthrough[0]) {
        return null
    }

    const totalStepsQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(walkthroughSteps)
        .where(eq(walkthroughSteps.walkthroughId, walkthroughId))

    const totalSteps = Number(totalStepsQuery[0].count)

    if (!mcpServerUserId) {
        return {
            ...walkthrough[0],
            totalSteps,
            completedSteps: 0,
            progressPercent: 0,
            currentStepId: null,
            isCompleted: false
        }
    }

    const progress = await db
        .select()
        .from(walkthroughProgress)
        .where(
            and(
                eq(walkthroughProgress.mcpServerUserId, mcpServerUserId),
                eq(walkthroughProgress.walkthroughId, walkthroughId)
            )
        )
        .limit(1)

    const completedSteps = progress[0]?.completedSteps?.length || 0
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0
    const isCompleted = completedSteps >= totalSteps && totalSteps > 0

    // Calculate current step
    let currentStepId: string | null = null
    if (!isCompleted && totalSteps > 0) {
        const nextStepInfo = await calculateNextStep(walkthroughId, progress[0] || null)
        currentStepId = nextStepInfo?.step?.id || null
    }

    return {
        ...walkthrough[0],
        totalSteps,
        completedSteps,
        progressPercent,
        currentStepId,
        isCompleted
    }
}

export interface WalkthroughStepInfo {
    id: string
    title: string
    contentFields: WalkthroughStep['contentFields']
    displayOrder: number
    isCompleted: boolean
    totalSteps: number
    completedCount: number
    progressPercent: number
    walkthroughTitle: string
}

/**
 * Get all steps for a walkthrough with completion status
 */
export async function getWalkthroughStepsWithProgress(
    walkthroughId: string,
    mcpServerUserId?: string
): Promise<WalkthroughStepInfo[]> {
    const result = await db
        .select()
        .from(walkthroughSteps)
        .leftJoin(walkthroughs, eq(walkthroughSteps.walkthroughId, walkthroughs.id))
        .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
        .orderBy(asc(walkthroughSteps.displayOrder))

    if (result.length === 0) {
        return []
    }

    const steps = result.map((r) => r.walkthrough_steps)
    const [walkthrough] = result.map((r) => r.walkthroughs)
    if (!walkthrough) {
        return []
    }

    if (!mcpServerUserId) {
        return steps.map((step) => ({
            id: step.id,
            title: step.title,
            contentFields: step.contentFields,
            displayOrder: step.displayOrder,
            isCompleted: false,
            totalSteps: steps.length,
            completedCount: 0,
            progressPercent: 0,
            walkthroughTitle: walkthrough.title
        }))
    }

    const progress = await db
        .select()
        .from(walkthroughProgress)
        .where(
            and(
                eq(walkthroughProgress.mcpServerUserId, mcpServerUserId),
                eq(walkthroughProgress.walkthroughId, walkthroughId)
            )
        )
        .limit(1)

    const completedStepIds = progress[0]?.completedSteps || []
    const completedCount = completedStepIds.length
    const progressPercent = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0

    return steps.map((step) => ({
        id: step.id,
        title: step.title,
        contentFields: step.contentFields,
        displayOrder: step.displayOrder,
        isCompleted: completedStepIds.includes(step.id),
        totalSteps: steps.length,
        completedCount,
        progressPercent,
        walkthroughTitle: walkthrough.title
    }))
}
