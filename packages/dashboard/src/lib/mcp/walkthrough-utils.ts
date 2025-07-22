import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { 
    db,
    type Walkthrough,
    type WalkthroughProgress,
    type WalkthroughStep,
    walkthroughs,
    walkthroughSteps,
    walkthroughProgress,
    mcpServerWalkthroughs
} from 'database'

export interface WalkthroughStepInfo {
    id: string
    title: string
    instructions: string
    displayOrder: number
    isCompleted: boolean
    totalSteps: number
    completedCount: number
    progressPercent: number
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
    mcpServerUserId: string,
    walkthroughId: string
): Promise<WalkthroughStepInfo | null> {
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

    const steps = await db
        .select()
        .from(walkthroughSteps)
        .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
        .orderBy(asc(walkthroughSteps.displayOrder))

    if (steps.length === 0) {
        return null
    }

    const completedStepIds = progress[0]?.completedSteps || []
    const completedCount = completedStepIds.length

    // Find the first step that hasn't been completed
    const nextStep = steps.find(step => !completedStepIds.includes(step.id))
    
    if (!nextStep) {
        // All steps completed, return the last step with completion status
        const lastStep = steps[steps.length - 1]
        return {
            id: lastStep.id,
            title: lastStep.title,
            instructions: lastStep.instructions,
            displayOrder: lastStep.displayOrder,
            isCompleted: true,
            totalSteps: steps.length,
            completedCount,
            progressPercent: 100
        }
    }

    return {
        id: nextStep.id,
        title: nextStep.title,
        instructions: nextStep.instructions,
        displayOrder: nextStep.displayOrder,
        isCompleted: false,
        totalSteps: steps.length,
        completedCount,
        progressPercent: Math.round((completedCount / steps.length) * 100)
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
    stepId: string
): Promise<void> {
    const progress = await getOrInitializeProgress(mcpServerUserId, walkthroughId)
    
    // Ensure step exists and belongs to walkthrough
    const step = await db
        .select()
        .from(walkthroughSteps)
        .where(
            and(
                eq(walkthroughSteps.id, stepId),
                eq(walkthroughSteps.walkthroughId, walkthroughId)
            )
        )
        .limit(1)

    if (!step[0]) {
        throw new Error('Step not found or does not belong to this walkthrough')
    }

    // Add stepId to completedSteps if not already present
    const completedSteps = progress.completedSteps || []
    if (!completedSteps.includes(stepId)) {
        const updatedCompletedSteps = [...completedSteps, stepId]
        
        // Check if all steps are now completed
        const totalSteps = await db
            .select({ count: sql<number>`count(*)` })
            .from(walkthroughSteps)
            .where(eq(walkthroughSteps.walkthroughId, walkthroughId))

        const isCompleted = updatedCompletedSteps.length >= totalSteps[0].count

        await db
            .update(walkthroughProgress)
            .set({
                completedSteps: updatedCompletedSteps,
                lastActivityAt: Date.now(),
                completedAt: isCompleted ? Date.now() : null
            })
            .where(eq(walkthroughProgress.id, progress.id))
    }
}

/**
 * Get all walkthroughs available to an MCP server with progress info
 */
export async function getServerWalkthroughs(
    mcpServerId: string,
    mcpServerUserId?: string
): Promise<WalkthroughListItem[]> {
    const walkthroughsQuery = db
        .select({
            walkthrough: walkthroughs,
            totalSteps: sql<number>`count(${walkthroughSteps.id})`
        })
        .from(walkthroughs)
        .innerJoin(mcpServerWalkthroughs, eq(mcpServerWalkthroughs.walkthroughId, walkthroughs.id))
        .innerJoin(walkthroughSteps, eq(walkthroughSteps.walkthroughId, walkthroughs.id))
        .where(
            and(
                eq(mcpServerWalkthroughs.mcpServerId, mcpServerId),
                eq(walkthroughs.status, 'published')
            )
        )
        .groupBy(walkthroughs.id)
        .orderBy(desc(walkthroughs.createdAt))

    const walkthroughsData = await walkthroughsQuery

    if (!mcpServerUserId) {
        return walkthroughsData.map(({ walkthrough, totalSteps }) => ({
            walkthrough,
            progress: null,
            totalSteps,
            progressPercent: 0
        }))
    }

    // Get progress data for user
    const walkthroughIds = walkthroughsData.map(w => w.walkthrough.id)
    
    if (walkthroughIds.length === 0) {
        return []
    }
    
    const progressData = await db
        .select()
        .from(walkthroughProgress)
        .where(
            and(
                eq(walkthroughProgress.mcpServerUserId, mcpServerUserId),
                inArray(walkthroughProgress.walkthroughId, walkthroughIds)
            )
        )

    const progressMap = new Map(progressData.map(p => [p.walkthroughId, p]))

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
    const walkthrough = await db
        .select()
        .from(walkthroughs)
        .where(eq(walkthroughs.id, walkthroughId))
        .limit(1)

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
        const nextStepInfo = await calculateNextStep(mcpServerUserId, walkthroughId)
        currentStepId = nextStepInfo?.id || null
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

/**
 * Get all steps for a walkthrough with completion status
 */
export async function getWalkthroughStepsWithProgress(
    walkthroughId: string,
    mcpServerUserId?: string
): Promise<WalkthroughStepInfo[]> {
    const steps = await db
        .select()
        .from(walkthroughSteps)
        .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
        .orderBy(asc(walkthroughSteps.displayOrder))

    if (!mcpServerUserId) {
        return steps.map(step => ({
            id: step.id,
            title: step.title,
            instructions: step.instructions,
            displayOrder: step.displayOrder,
            isCompleted: false,
            totalSteps: steps.length,
            completedCount: 0,
            progressPercent: 0
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

    return steps.map(step => ({
        id: step.id,
        title: step.title,
        instructions: step.instructions,
        displayOrder: step.displayOrder,
        isCompleted: completedStepIds.includes(step.id),
        totalSteps: steps.length,
        completedCount,
        progressPercent
    }))
}