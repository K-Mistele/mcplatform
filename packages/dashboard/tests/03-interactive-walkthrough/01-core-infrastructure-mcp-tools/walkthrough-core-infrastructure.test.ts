import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import {
    db,
    mcpServerUser,
    mcpServerWalkthroughs,
    mcpServers,
    organization,
    walkthroughProgress,
    walkthroughSteps,
    walkthroughs
} from 'database'
import { and, eq } from 'drizzle-orm'
import {
    calculateNextStep,
    completeStep,
    getOrInitializeProgress,
    getServerWalkthroughs,
    getWalkthroughDetails,
    getWalkthroughStepsWithProgress
} from '../../../src/lib/mcp/walkthrough-utils'

describe('Walkthrough Core Infrastructure', () => {
    let testOrganizationId: string
    let testMcpServerId: string
    let testWalkthroughId: string
    let testMcpServerUserId: string
    let testStepIds: string[]

    // Track created resources for cleanup
    const createdOrganizations: string[] = []
    const createdMcpServers: string[] = []
    const createdWalkthroughs: string[] = []
    const createdMcpServerUsers: string[] = []
    const createdWalkthroughSteps: string[] = []
    const createdMcpServerWalkthroughs: Array<{ mcpServerId: string; walkthroughId: string }> = []
    const createdWalkthroughProgress: Array<{ mcpServerUserId: string; walkthroughId: string }> = []

    beforeEach(async () => {
        // Create test organization
        testOrganizationId = `org_${nanoid(8)}`
        await db.insert(organization).values({
            id: testOrganizationId,
            name: 'Test Organization',
            createdAt: new Date()
        })
        createdOrganizations.push(testOrganizationId)

        // Create test MCP server
        testMcpServerId = `mcp_${nanoid(8)}`
        await db.insert(mcpServers).values({
            id: testMcpServerId,
            organizationId: testOrganizationId,
            name: 'Test Server',
            productPlatformOrTool: 'Test Platform',
            slug: `test-${nanoid(4)}`,
            walkthroughToolsEnabled: 'true'
        })
        createdMcpServers.push(testMcpServerId)

        // Create test MCP server user
        testMcpServerUserId = `mcpu_${nanoid(12)}`
        await db.insert(mcpServerUser).values({
            id: testMcpServerUserId,
            trackingId: `track_${nanoid(8)}`,
            email: 'test@example.com'
        })
        createdMcpServerUsers.push(testMcpServerUserId)

        // Create test walkthrough
        testWalkthroughId = `wt_${nanoid(8)}`
        await db.insert(walkthroughs).values({
            id: testWalkthroughId,
            organizationId: testOrganizationId,
            title: 'Test Walkthrough',
            description: 'A test walkthrough for testing',
            status: 'published',
            estimatedDurationMinutes: 30
        })
        createdWalkthroughs.push(testWalkthroughId)

        // Link walkthrough to server
        await db.insert(mcpServerWalkthroughs).values({
            mcpServerId: testMcpServerId,
            walkthroughId: testWalkthroughId
        })
        createdMcpServerWalkthroughs.push({ mcpServerId: testMcpServerId, walkthroughId: testWalkthroughId })

        // Create test steps in order
        testStepIds = []
        for (let i = 1; i <= 3; i++) {
            const stepId = `wts_${nanoid(8)}`
            testStepIds.push(stepId)
            createdWalkthroughSteps.push(stepId)

            await db.insert(walkthroughSteps).values({
                id: stepId,
                walkthroughId: testWalkthroughId,
                title: `Step ${i}`,
                instructions: `Instructions for step ${i}`,
                displayOrder: i,
                nextStepId: i < 3 ? testStepIds[i - 1] : null // Will be set in next iteration
            })
        }

        // Update next step IDs correctly
        await db
            .update(walkthroughSteps)
            .set({ nextStepId: testStepIds[1] })
            .where(eq(walkthroughSteps.id, testStepIds[0]))

        await db
            .update(walkthroughSteps)
            .set({ nextStepId: testStepIds[2] })
            .where(eq(walkthroughSteps.id, testStepIds[1]))
    })

    afterEach(async () => {
        // Clean up only the resources created in this test
        for (const progress of createdWalkthroughProgress) {
            await db
                .delete(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, progress.mcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, progress.walkthroughId)
                    )
                )
        }

        for (const id of createdWalkthroughSteps) {
            await db.delete(walkthroughSteps).where(eq(walkthroughSteps.id, id))
        }

        for (const link of createdMcpServerWalkthroughs) {
            await db
                .delete(mcpServerWalkthroughs)
                .where(
                    and(
                        eq(mcpServerWalkthroughs.mcpServerId, link.mcpServerId),
                        eq(mcpServerWalkthroughs.walkthroughId, link.walkthroughId)
                    )
                )
        }

        for (const id of createdWalkthroughs) {
            await db.delete(walkthroughs).where(eq(walkthroughs.id, id))
        }

        for (const id of createdMcpServerUsers) {
            await db.delete(mcpServerUser).where(eq(mcpServerUser.id, id))
        }

        for (const id of createdMcpServers) {
            await db.delete(mcpServers).where(eq(mcpServers.id, id))
        }

        for (const id of createdOrganizations) {
            await db.delete(organization).where(eq(organization.id, id))
        }

        // Clear tracking arrays
        createdOrganizations.length = 0
        createdMcpServers.length = 0
        createdWalkthroughs.length = 0
        createdMcpServerUsers.length = 0
        createdWalkthroughSteps.length = 0
        createdMcpServerWalkthroughs.length = 0
        createdWalkthroughProgress.length = 0
    })

    describe('calculateNextStep', () => {
        test('should return first step for new user', async () => {
            const nextStep = await calculateNextStep(testWalkthroughId, null)

            expect(nextStep).toBeDefined()
            expect(nextStep!.step).toBeDefined()
            expect(nextStep!.step!.id).toBe(testStepIds[0])
            expect(nextStep!.step!.title).toBe('Step 1')
            expect(nextStep!.step!.displayOrder).toBe(1)
            expect(nextStep!.isCompleted).toBe(false)
            expect(nextStep!.totalSteps).toBe(3)
            expect(nextStep!.completedCount).toBe(0)
            expect(nextStep!.progressPercent).toBe(0)
        })

        test('should return second step after completing first step', async () => {
            // Complete first step
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])
            
            // Get updated progress
            const progress = await db
                .select()
                .from(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, testMcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, testWalkthroughId)
                    )
                )
                .limit(1)

            const nextStep = await calculateNextStep(testWalkthroughId, progress[0])

            expect(nextStep).toBeDefined()
            expect(nextStep!.step).toBeDefined()
            expect(nextStep!.step!.id).toBe(testStepIds[1])
            expect(nextStep!.step!.title).toBe('Step 2')
            expect(nextStep!.step!.displayOrder).toBe(2)
            expect(nextStep!.isCompleted).toBe(false)
            expect(nextStep!.completedCount).toBe(1)
            expect(nextStep!.progressPercent).toBe(33) // 1/3 rounded
        })

        test('should return last step as completed when all steps done', async () => {
            // Complete all steps
            for (const stepId of testStepIds) {
                await completeStep(testMcpServerUserId, testWalkthroughId, stepId)
            }
            
            // Get updated progress
            const progress = await db
                .select()
                .from(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, testMcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, testWalkthroughId)
                    )
                )
                .limit(1)

            const nextStep = await calculateNextStep(testWalkthroughId, progress[0])

            expect(nextStep).toBeDefined()
            expect(nextStep!.step).toBeNull() // No more steps
            expect(nextStep!.isCompleted).toBe(true)
            expect(nextStep!.completedCount).toBe(3)
            expect(nextStep!.progressPercent).toBe(100)
        })

        test('should handle walkthrough with no steps', async () => {
            // Create empty walkthrough
            const emptyWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: emptyWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Empty Walkthrough',
                status: 'published'
            })
            createdWalkthroughs.push(emptyWalkthroughId)

            const nextStep = await calculateNextStep(emptyWalkthroughId, null)
            expect(nextStep).toBeNull()
        })
    })

    describe('completeStep', () => {
        test('should mark step as completed and update progress', async () => {
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])

            const progress = await db
                .select()
                .from(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, testMcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, testWalkthroughId)
                    )
                )
                .limit(1)

            expect(progress).toHaveLength(1)
            expect(progress[0].completedSteps).toContain(testStepIds[0])
            expect(progress[0].completedAt).toBeNull() // Not fully completed yet
        })

        test('should set completedAt when all steps are done', async () => {
            // Complete all steps
            for (const stepId of testStepIds) {
                await completeStep(testMcpServerUserId, testWalkthroughId, stepId)
            }

            const progress = await db
                .select()
                .from(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, testMcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, testWalkthroughId)
                    )
                )
                .limit(1)

            expect(progress[0].completedSteps).toHaveLength(3)
            expect(progress[0].completedAt).toBeDefined()
            expect(progress[0].completedAt).toBeGreaterThan(0)
        })

        test('should not duplicate completed steps', async () => {
            // Complete same step twice
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])

            const progress = await db
                .select()
                .from(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, testMcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, testWalkthroughId)
                    )
                )
                .limit(1)

            expect(progress[0].completedSteps).toHaveLength(1)
            expect(progress[0].completedSteps?.[0]).toBe(testStepIds[0])
        })

        test('should throw error for invalid step', async () => {
            const invalidStepId = `invalid_${nanoid(8)}`

            await expect(completeStep(testMcpServerUserId, testWalkthroughId, invalidStepId)).rejects.toThrow()
        })
    })

    describe('getOrInitializeProgress', () => {
        test('should create new progress for first-time user', async () => {
            const progress = await getOrInitializeProgress(testMcpServerUserId, testWalkthroughId)

            expect(progress).toBeDefined()
            expect(progress.mcpServerUserId).toBe(testMcpServerUserId)
            expect(progress.walkthroughId).toBe(testWalkthroughId)
            expect(progress.completedSteps).toEqual([])
            expect(progress.startedAt).toBeGreaterThan(0)
        })

        test('should return existing progress for returning user', async () => {
            // Create initial progress
            const initialProgress = await getOrInitializeProgress(testMcpServerUserId, testWalkthroughId)

            // Get progress again
            const returnedProgress = await getOrInitializeProgress(testMcpServerUserId, testWalkthroughId)

            expect(returnedProgress.id).toBe(initialProgress.id)
            expect(returnedProgress.startedAt).toBe(initialProgress.startedAt)
        })
    })

    describe('getServerWalkthroughs', () => {
        test('should return walkthroughs linked to server', async () => {
            const walkthroughs = await getServerWalkthroughs(testMcpServerId, testMcpServerUserId)

            expect(walkthroughs).toHaveLength(1)
            expect(walkthroughs[0].walkthrough.id).toBe(testWalkthroughId)
            expect(walkthroughs[0].walkthrough.title).toBe('Test Walkthrough')
            expect(walkthroughs[0].totalSteps).toBe(3)
            expect(walkthroughs[0].progressPercent).toBe(0)
        })

        test('should show progress for user with existing progress', async () => {
            // Complete one step
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])

            const walkthroughs = await getServerWalkthroughs(testMcpServerId, testMcpServerUserId)

            expect(walkthroughs[0].progressPercent).toBe(33)
            expect(walkthroughs[0].progress).toBeDefined()
        })

        test('should not show draft walkthroughs', async () => {
            // Create draft walkthrough
            const draftWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: draftWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Draft Walkthrough',
                status: 'draft'
            })
            createdWalkthroughs.push(draftWalkthroughId)

            await db.insert(mcpServerWalkthroughs).values({
                mcpServerId: testMcpServerId,
                walkthroughId: draftWalkthroughId
            })
            createdMcpServerWalkthroughs.push({ mcpServerId: testMcpServerId, walkthroughId: draftWalkthroughId })

            const serverWalkthroughs = await getServerWalkthroughs(testMcpServerId, testMcpServerUserId)

            // Should only return published walkthrough
            expect(serverWalkthroughs).toHaveLength(1)
            expect(serverWalkthroughs[0].walkthrough.status).toBe('published')
        })
    })

    describe('getWalkthroughDetails', () => {
        test('should return detailed walkthrough info with progress', async () => {
            const details = await getWalkthroughDetails(testWalkthroughId, testMcpServerUserId)

            expect(details).toBeDefined()
            expect(details!.id).toBe(testWalkthroughId)
            expect(details!.title).toBe('Test Walkthrough')
            expect(details!.totalSteps).toBe(3)
            expect(details!.completedSteps).toBe(0)
            expect(details!.progressPercent).toBe(0)
            expect(details!.isCompleted).toBe(false)
            expect(details!.currentStepId).toBe(testStepIds[0])
        })

        test('should return null for nonexistent walkthrough', async () => {
            const details = await getWalkthroughDetails(`invalid_${nanoid(8)}`, testMcpServerUserId)
            expect(details).toBeNull()
        })
    })

    describe('getWalkthroughStepsWithProgress', () => {
        test('should return all steps with completion status', async () => {
            // Complete first step
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])

            const steps = await getWalkthroughStepsWithProgress(testWalkthroughId, testMcpServerUserId)

            expect(steps).toHaveLength(3)
            expect(steps[0].isCompleted).toBe(true)
            expect(steps[1].isCompleted).toBe(false)
            expect(steps[2].isCompleted).toBe(false)
            expect(steps[0].completedCount).toBe(1)
            expect(steps[0].progressPercent).toBe(33)
        })

        test('should return steps without progress when no userId provided', async () => {
            const steps = await getWalkthroughStepsWithProgress(testWalkthroughId)

            expect(steps).toHaveLength(3)
            expect(steps.every((step) => step.isCompleted === false)).toBe(true)
            expect(steps[0].completedCount).toBe(0)
            expect(steps[0].progressPercent).toBe(0)
        })
    })

    describe('Progress Algorithm Resilience', () => {
        test('should handle step reordering without losing progress', async () => {
            // Complete first two steps
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[1])

            // Simulate reordering by changing display order
            await db.update(walkthroughSteps).set({ displayOrder: 3 }).where(eq(walkthroughSteps.id, testStepIds[0]))

            await db.update(walkthroughSteps).set({ displayOrder: 1 }).where(eq(walkthroughSteps.id, testStepIds[2]))

            // Get updated progress
            const progress = await db
                .select()
                .from(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, testMcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, testWalkthroughId)
                    )
                )
                .limit(1)
                
            // Should still calculate next step correctly based on completed array
            const nextStep = await calculateNextStep(testWalkthroughId, progress[0])

            // Should return the step that hasn't been completed (original step 3, now reordered to position 1)
            expect(nextStep!.step).toBeDefined()
            expect(nextStep!.step!.id).toBe(testStepIds[2])
            expect(nextStep!.completedCount).toBe(2)
        })

        test('should handle new steps being added without affecting progress', async () => {
            // Complete first step
            await completeStep(testMcpServerUserId, testWalkthroughId, testStepIds[0])

            // Update existing steps to make room for insertion
            await db.update(walkthroughSteps).set({ displayOrder: 3 }).where(eq(walkthroughSteps.id, testStepIds[1]))
            await db.update(walkthroughSteps).set({ displayOrder: 4 }).where(eq(walkthroughSteps.id, testStepIds[2]))

            // Add a new step in the middle
            const newStepId = `wts_${nanoid(8)}`
            await db.insert(walkthroughSteps).values({
                id: newStepId,
                walkthroughId: testWalkthroughId,
                title: 'New Step 1.5',
                instructions: 'New step inserted between 1 and 2',
                displayOrder: 2
            })
            createdWalkthroughSteps.push(newStepId)

            // Get updated progress
            const progress = await db
                .select()
                .from(walkthroughProgress)
                .where(
                    and(
                        eq(walkthroughProgress.mcpServerUserId, testMcpServerUserId),
                        eq(walkthroughProgress.walkthroughId, testWalkthroughId)
                    )
                )
                .limit(1)
                
            const nextStep = await calculateNextStep(testWalkthroughId, progress[0])

            // Should find the new step as next (lowest display order among uncompleted)
            expect(nextStep!.step).toBeDefined()
            expect(nextStep!.step!.id).toBe(newStepId)
            expect(nextStep!.completedCount).toBe(1) // Original step still completed
            expect(nextStep!.totalSteps).toBe(4) // Now 4 total steps
        })
    })
})
