import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import {
    db,
    mcpServerSession,
    mcpServerUser,
    mcpServerWalkthroughs,
    mcpServers,
    organization,
    toolCalls,
    walkthroughProgress,
    walkthroughSteps,
    walkthroughs
} from 'database'
import { and, eq } from 'drizzle-orm'
import {
    handleGetNextStep,
    handleGetWalkthroughDetails,
    handleListWalkthroughs
} from '../../../src/lib/mcp/tools/walkthrough'

describe('Walkthrough MCP Tools', () => {
    let testOrganizationId: string
    let testMcpServerId: string
    let testWalkthroughId: string
    let testMcpServerUserId: string
    let testServerSessionId: string
    let testStepIds: string[]

    // Track created resources for cleanup
    const createdOrganizations: string[] = []
    const createdMcpServers: string[] = []
    const createdWalkthroughs: string[] = []
    const createdMcpServerUsers: string[] = []
    const createdWalkthroughSteps: string[] = []
    const createdMcpServerWalkthroughs: Array<{ mcpServerId: string; walkthroughId: string }> = []
    const createdWalkthroughProgress: Array<{ mcpServerUserId: string; walkthroughId: string }> = []
    const createdToolCalls: string[] = []
    const createdMcpServerSessions: string[] = []

    const createTestContext = () => ({
        mcpServerId: testMcpServerId,
        mcpServerUserId: testMcpServerUserId,
        serverSessionId: testServerSessionId
    })

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
        const serverSlug = `test-${nanoid(4)}`
        await db.insert(mcpServers).values({
            id: testMcpServerId,
            organizationId: testOrganizationId,
            name: 'Test Server',
            productPlatformOrTool: 'Test Platform',
            slug: serverSlug,
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

        testServerSessionId = `sess_${nanoid(12)}`
        
        // Create test MCP server session
        await db.insert(mcpServerSession).values({
            mcpServerSessionId: testServerSessionId,
            mcpServerSlug: serverSlug,
            mcpServerUserId: testMcpServerUserId
        })
        createdMcpServerSessions.push(testServerSessionId)

        // Create test walkthrough
        testWalkthroughId = `wt_${nanoid(8)}`
        await db.insert(walkthroughs).values({
            id: testWalkthroughId,
            organizationId: testOrganizationId,
            title: 'Test Walkthrough',
            description: 'A comprehensive test walkthrough',
            type: 'course',
            status: 'published',
            estimatedDurationMinutes: 45,
            tags: ['test', 'example']
        })
        createdWalkthroughs.push(testWalkthroughId)

        // Link walkthrough to server
        await db.insert(mcpServerWalkthroughs).values({
            mcpServerId: testMcpServerId,
            walkthroughId: testWalkthroughId
        })
        createdMcpServerWalkthroughs.push({ mcpServerId: testMcpServerId, walkthroughId: testWalkthroughId })

        // Create test steps
        testStepIds = []
        for (let i = 1; i <= 3; i++) {
            const stepId = `wts_${nanoid(8)}`
            testStepIds.push(stepId)
            createdWalkthroughSteps.push(stepId)

            await db.insert(walkthroughSteps).values({
                id: stepId,
                walkthroughId: testWalkthroughId,
                title: `Test Step ${i}`,
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: `Context for step ${i}`,
                    contextForAgent: `Background for step ${i}`,
                    contentForUser: `Detailed instructions for step ${i}. This step teaches you how to do X.`,
                    operationsForAgent: `Operations for step ${i}`
                },
                displayOrder: i
            })
        }
    })

    afterEach(async () => {
        // Clean up only the resources created in this test
        for (const id of createdToolCalls) {
            await db.delete(toolCalls).where(eq(toolCalls.id, id))
        }
        
        for (const id of createdMcpServerSessions) {
            await db.delete(mcpServerSession).where(eq(mcpServerSession.mcpServerSessionId, id))
        }

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
        createdToolCalls.length = 0
        createdMcpServerSessions.length = 0
    })

    describe('list_walkthroughs tool', () => {
        test('should list available walkthroughs with progress info', async () => {
            const request = {
                method: 'tools/call',
                params: {
                    name: 'list_walkthroughs',
                    arguments: {}
                }
            }

            const response = await handleListWalkthroughs(request, createTestContext())
            const result = JSON.parse(response.content[0].text)

            expect(result.walkthroughs).toHaveLength(1)
            expect(result.walkthroughs[0].id).toBe(testWalkthroughId)
            expect(result.walkthroughs[0].title).toBe('Test Walkthrough')
            expect(result.walkthroughs[0].description).toBe('A comprehensive test walkthrough')
            expect(result.walkthroughs[0].totalSteps).toBe(3)
            expect(result.walkthroughs[0].progressPercent).toBe(0)
            expect(result.walkthroughs[0].isStarted).toBe(false)
            expect(result.walkthroughs[0].isCompleted).toBe(false)
            expect(result.walkthroughs[0].estimatedDurationMinutes).toBe(45)
            expect(result.walkthroughs[0].tags).toEqual(['test', 'example'])

            // Verify tool call was tracked
            const trackedCall = await db
                .select()
                .from(toolCalls)
                .where(eq(toolCalls.toolName, 'list_walkthroughs'))
                .limit(1)

            expect(trackedCall).toHaveLength(1)
            expect(trackedCall[0].mcpServerId).toBe(testMcpServerId)
            expect(trackedCall[0].mcpServerUserId).toBe(testMcpServerUserId)
        })

        test('should show progress for walkthrough with existing progress', async () => {
            // Create some progress first
            await db.insert(walkthroughProgress).values({
                mcpServerUserId: testMcpServerUserId,
                walkthroughId: testWalkthroughId,
                completedSteps: [testStepIds[0]],
                startedAt: Date.now(),
                lastActivityAt: Date.now()
            })
            createdWalkthroughProgress.push({ mcpServerUserId: testMcpServerUserId, walkthroughId: testWalkthroughId })

            const request = {
                method: 'tools/call',
                params: {
                    name: 'list_walkthroughs',
                    arguments: {}
                }
            }

            const response = await handleListWalkthroughs(request, createTestContext())
            const result = JSON.parse(response.content[0].text)

            expect(result.walkthroughs[0].progressPercent).toBe(33) // 1/3 rounded
            expect(result.walkthroughs[0].isStarted).toBe(true)
            expect(result.walkthroughs[0].isCompleted).toBe(false)
        })
    })

    describe('get_walkthrough_details tool', () => {
        test('should return detailed walkthrough information', async () => {
            const request = {
                method: 'tools/call',
                params: {
                    name: 'get_walkthrough_details',
                    arguments: {
                        walkthroughId: testWalkthroughId
                    }
                }
            }

            const response = await handleGetWalkthroughDetails(request, createTestContext())
            const result = JSON.parse(response.content[0].text)

            expect(result.walkthrough.id).toBe(testWalkthroughId)
            expect(result.walkthrough.title).toBe('Test Walkthrough')
            expect(result.walkthrough.totalSteps).toBe(3)
            expect(result.walkthrough.completedSteps).toBe(0)
            expect(result.walkthrough.progressPercent).toBe(0)
            expect(result.walkthrough.currentStepId).toBe(testStepIds[0])
            expect(result.walkthrough.isCompleted).toBe(false)

            // Verify tool call was tracked
            const trackedCall = await db
                .select()
                .from(toolCalls)
                .where(eq(toolCalls.toolName, 'get_walkthrough_details'))
                .limit(1)

            expect(trackedCall).toHaveLength(1)
        })

        test('should throw error for nonexistent walkthrough', async () => {
            const request = {
                method: 'tools/call',
                params: {
                    name: 'get_walkthrough_details',
                    arguments: {
                        walkthroughId: `invalid_${nanoid(8)}`
                    }
                }
            }

            await expect(handleGetWalkthroughDetails(request, createTestContext())).rejects.toThrow()
        })
    })

    describe('get_next_step tool', () => {
        test('should return first step for new user without completing any step', async () => {
            const request = {
                method: 'tools/call',
                params: {
                    name: 'get_next_step',
                    arguments: {
                        walkthroughId: testWalkthroughId
                    }
                }
            }

            const response = await handleGetNextStep(request, createTestContext())
            const result = JSON.parse(response.content[0].text)

            expect(result.nextStep.id).toBe(testStepIds[0])
            expect(result.nextStep.title).toBe('Test Step 1')
            expect(result.nextStep.instructions).toContain('Detailed instructions for step 1')
            expect(result.nextStep.displayOrder).toBe(1)
            expect(result.progress.totalSteps).toBe(3)
            expect(result.progress.completedCount).toBe(0)
            expect(result.progress.progressPercent).toBe(0)
            expect(result.progress.isWalkthroughCompleted).toBe(false)
            expect(result.completedStep).toBeUndefined()

            // Should have created progress record
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
        })

        test('should complete current step and return next step', async () => {
            const request = {
                method: 'tools/call',
                params: {
                    name: 'get_next_step',
                    arguments: {
                        walkthroughId: testWalkthroughId,
                        currentStepId: testStepIds[0]
                    }
                }
            }

            const response = await handleGetNextStep(request, createTestContext())
            const result = JSON.parse(response.content[0].text)

            expect(result.completedStep.stepId).toBe(testStepIds[0])
            expect(result.completedStep.walkthroughId).toBe(testWalkthroughId)
            expect(result.nextStep.id).toBe(testStepIds[1])
            expect(result.nextStep.title).toBe('Test Step 2')
            expect(result.progress.completedCount).toBe(1)
            expect(result.progress.progressPercent).toBe(33)
            expect(result.progress.isWalkthroughCompleted).toBe(false)

            // Verify progress was actually saved
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

            expect(progress[0].completedSteps).toContain(testStepIds[0])

            // Verify tool call was tracked
            const trackedCall = await db
                .select()
                .from(toolCalls)
                .where(eq(toolCalls.toolName, 'get_next_step'))
                .limit(1)

            expect(trackedCall[0].output).toEqual({
                completedStepId: testStepIds[0],
                nextStepId: testStepIds[1],
                isWalkthroughCompleted: false
            })
        })

        test('should return next uncompleted step for user with existing progress', async () => {
            // Complete first step manually
            await db.insert(walkthroughProgress).values({
                mcpServerUserId: testMcpServerUserId,
                walkthroughId: testWalkthroughId,
                completedSteps: [testStepIds[0]],
                startedAt: Date.now(),
                lastActivityAt: Date.now()
            })
            createdWalkthroughProgress.push({ mcpServerUserId: testMcpServerUserId, walkthroughId: testWalkthroughId })

            const request = {
                method: 'tools/call',
                params: {
                    name: 'get_next_step',
                    arguments: {
                        walkthroughId: testWalkthroughId
                    }
                }
            }

            const response = await handleGetNextStep(request, createTestContext())
            const result = JSON.parse(response.content[0].text)

            expect(result.nextStep.id).toBe(testStepIds[1])
            expect(result.nextStep.title).toBe('Test Step 2')
            expect(result.progress.completedCount).toBe(1)
            expect(result.progress.progressPercent).toBe(33)
            expect(result.completedStep).toBeUndefined()
        })

        test('should indicate completion when completing final step', async () => {
            // Complete first two steps manually
            await db.insert(walkthroughProgress).values({
                mcpServerUserId: testMcpServerUserId,
                walkthroughId: testWalkthroughId,
                completedSteps: [testStepIds[0], testStepIds[1]],
                startedAt: Date.now(),
                lastActivityAt: Date.now()
            })
            createdWalkthroughProgress.push({ mcpServerUserId: testMcpServerUserId, walkthroughId: testWalkthroughId })

            // Complete final step via tool
            const request = {
                method: 'tools/call',
                params: {
                    name: 'get_next_step',
                    arguments: {
                        walkthroughId: testWalkthroughId,
                        currentStepId: testStepIds[2]
                    }
                }
            }

            const response = await handleGetNextStep(request, createTestContext())
            const result = JSON.parse(response.content[0].text)

            expect(result.completedStep.stepId).toBe(testStepIds[2])
            expect(result.nextStep).toBeNull()
            expect(result.progress.completedCount).toBe(3)
            expect(result.progress.progressPercent).toBe(100)
            expect(result.progress.isWalkthroughCompleted).toBe(true)

            // Verify completedAt timestamp was set
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

            expect(progress[0].completedAt).toBeGreaterThan(0)
        })

        test('should throw error for invalid step', async () => {
            const request = {
                method: 'tools/call',
                params: {
                    name: 'get_next_step',
                    arguments: {
                        walkthroughId: testWalkthroughId,
                        currentStepId: `invalid_${nanoid(8)}`
                    }
                }
            }

            await expect(handleGetNextStep(request, createTestContext())).rejects.toThrow()
        })
    })


    describe('Tool Integration', () => {
        test('should work together for a complete walkthrough flow', async () => {
            // 1. List walkthroughs
            let request = {
                method: 'tools/call',
                params: { name: 'list_walkthroughs', arguments: {} }
            }
            let response = await handleListWalkthroughs(request, createTestContext())
            let result = JSON.parse(response.content[0].text)
            expect(result.walkthroughs[0].progressPercent).toBe(0)

            // 2. Get walkthrough details
            request = {
                method: 'tools/call',
                params: {
                    name: 'get_walkthrough_details',
                    arguments: { walkthroughId: testWalkthroughId }
                }
            }
            response = await handleGetWalkthroughDetails(request, createTestContext())
            result = JSON.parse(response.content[0].text)
            expect(result.walkthrough.currentStepId).toBe(testStepIds[0])

            // 3. Get next step (first step for new user)
            request = {
                method: 'tools/call',
                params: {
                    name: 'get_next_step',
                    arguments: { walkthroughId: testWalkthroughId }
                }
            }
            response = await handleGetNextStep(request, createTestContext())
            result = JSON.parse(response.content[0].text)
            expect(result.nextStep.id).toBe(testStepIds[0])

            // 4. Complete first step and get next
            request = {
                method: 'tools/call',
                params: {
                    name: 'get_next_step',
                    arguments: {
                        walkthroughId: testWalkthroughId,
                        currentStepId: testStepIds[0]
                    }
                }
            }
            response = await handleGetNextStep(request, createTestContext())
            result = JSON.parse(response.content[0].text)
            expect(result.completedStep.stepId).toBe(testStepIds[0])
            expect(result.nextStep.id).toBe(testStepIds[1])
            expect(result.progress.progressPercent).toBe(33)

            // 5. Verify updated list shows progress
            request = {
                method: 'tools/call',
                params: { name: 'list_walkthroughs', arguments: {} }
            }
            response = await handleListWalkthroughs(request, createTestContext())
            result = JSON.parse(response.content[0].text)
            expect(result.walkthroughs[0].progressPercent).toBe(33)
            expect(result.walkthroughs[0].isStarted).toBe(true)
        })
    })
})
