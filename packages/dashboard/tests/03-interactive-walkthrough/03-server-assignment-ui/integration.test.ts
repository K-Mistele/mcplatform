import { createMcpServerAction, deleteMcpServerAction } from '@/lib/orpc/actions/mcp-servers'
import {
    assignWalkthroughsToServerAction,
    getServerWalkthroughsAction,
    removeWalkthroughAssignmentAction,
    reorderServerWalkthroughsAction,
    updateWalkthroughAssignmentAction
} from '@/lib/orpc/actions/walkthrough-assignment'
import { createWalkthroughAction, deleteWalkthroughAction } from '@/lib/orpc/actions/walkthroughs'
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import { db, schema } from 'database'
import { and, eq } from 'drizzle-orm'

// Mock dependencies
mock.module('../../../src/lib/auth/auth', () => ({
    requireSession: mock(() => ({
        session: {
            activeOrganizationId: 'test-org-id'
        },
        user: {
            id: 'test-user-id'
        }
    }))
}))

// Mock revalidatePath
mock.module('next/cache', () => ({
    revalidatePath: mock(() => {})
}))

describe('Walkthrough Assignment Integration Tests', () => {
    // Track all created resources for cleanup
    const createdResources = {
        organizations: new Set<string>(),
        servers: new Set<string>(),
        walkthroughs: new Set<string>(),
        assignments: new Set<string>(),
        steps: new Set<string>()
    }

    let testOrganization: any
    let testServer1: any
    let testServer2: any
    let testWalkthrough1: any
    let testWalkthrough2: any

    beforeAll(async () => {
        // Create test organization with unique ID
        const orgId = `org_${nanoid(8)}`
        const [org] = await db
            .insert(schema.organization)
            .values({
                id: orgId,
                name: 'Test Organization',
                slug: `test-org-${nanoid(6).toLowerCase()}`,
                createdAt: new Date()
            })
            .returning()
        testOrganization = org
        createdResources.organizations.add(org.id)

        // Update mock to use the actual org ID
        mock.module('../../../src/lib/auth/auth', () => ({
            requireSession: mock(() => ({
                session: {
                    activeOrganizationId: org.id
                },
                user: {
                    id: 'test-user-id'
                }
            }))
        }))
    })

    afterAll(async () => {
        // Clean up all created resources in reverse order of dependencies
        // Delete assignments first
        if (createdResources.assignments.size > 0) {
            await db
                .delete(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, [...createdResources.servers][0]))
        }

        // Delete steps
        for (const stepId of createdResources.steps) {
            await db.delete(schema.walkthroughSteps).where(eq(schema.walkthroughSteps.id, stepId))
        }

        // Delete walkthroughs
        for (const walkthroughId of createdResources.walkthroughs) {
            await db.delete(schema.walkthroughs).where(eq(schema.walkthroughs.id, walkthroughId))
        }

        // Delete servers
        for (const serverId of createdResources.servers) {
            await db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, serverId))
        }

        // Delete organization
        for (const orgId of createdResources.organizations) {
            await db.delete(schema.organization).where(eq(schema.organization.id, orgId))
        }
    })

    beforeEach(() => {
        // Reset test variables
        testServer1 = undefined
        testServer2 = undefined
        testWalkthrough1 = undefined
        testWalkthrough2 = undefined
    })

    describe('Complete Assignment Lifecycle', () => {
        test('should handle full assignment workflow', async () => {
            // Step 1: Create servers with unique slugs
            const [error1, server1] = await createMcpServerAction({
                name: 'Production Server',
                slug: `prod-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(error1).toBeNull()
            testServer1 = server1
            if (server1) createdResources.servers.add(server1.id)

            const [error2, server2] = await createMcpServerAction({
                name: 'Development Server',
                slug: `dev-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(error2).toBeNull()
            testServer2 = server2
            if (server2) createdResources.servers.add(server2.id)

            // Step 2: Create walkthroughs
            const [errorW1, walkthrough1] = await createWalkthroughAction({
                title: 'Getting Started Guide',
                description: 'A comprehensive guide for new users',
                type: 'quickstart',
                isPublished: true
            })
            expect(errorW1).toBeNull()
            testWalkthrough1 = walkthrough1
            if (walkthrough1) createdResources.walkthroughs.add(walkthrough1.id)

            const [errorW2, walkthrough2] = await createWalkthroughAction({
                title: 'Advanced Features',
                description: 'Learn about advanced features',
                type: 'course',
                isPublished: true
            })
            expect(errorW2).toBeNull()
            testWalkthrough2 = walkthrough2
            if (walkthrough2) createdResources.walkthroughs.add(walkthrough2.id)

            // Step 3: Assign walkthroughs to servers
            const [assignError1] = await assignWalkthroughsToServerAction({
                serverId: testServer1!.id,
                walkthroughIds: [
                    { walkthroughId: testWalkthrough1!.id, displayOrder: 0 },
                    { walkthroughId: testWalkthrough2!.id, displayOrder: 1 }
                ]
            })
            expect(assignError1).toBeNull()

            const [assignError2] = await assignWalkthroughsToServerAction({
                serverId: testServer2!.id,
                walkthroughIds: [{ walkthroughId: testWalkthrough1!.id, displayOrder: 0 }]
            })
            expect(assignError2).toBeNull()

            // Step 4: Verify assignments
            const server1Result = await getServerWalkthroughsAction({
                serverId: testServer1!.id
            })
            const [server1Error, server1Walkthroughs] = server1Result
            expect(server1Error).toBeNull()
            expect(server1Walkthroughs).toHaveLength(2)

            const server2Result = await getServerWalkthroughsAction({
                serverId: testServer2!.id
            })
            const [server2Error, server2Walkthroughs] = server2Result
            expect(server2Error).toBeNull()
            expect(server2Walkthroughs).toHaveLength(1)

            // Step 5: Update assignment
            const [updateError] = await updateWalkthroughAssignmentAction({
                serverId: testServer1!.id,
                walkthroughId: testWalkthrough2!.id,
                isEnabled: false
            })
            expect(updateError).toBeNull()

            // Step 6: Verify update
            const updatedResult = await getServerWalkthroughsAction({
                serverId: testServer1!.id
            })
            const [errorUpdate, updatedWalkthroughs] = updatedResult
            expect(errorUpdate).toBeNull()
            expect(updatedWalkthroughs?.[1].assignment.isEnabled).toBe('false')

            // Step 7: Reorder walkthroughs
            const [reorderError] = await reorderServerWalkthroughsAction({
                serverId: testServer1!.id,
                walkthroughIds: [testWalkthrough2!.id, testWalkthrough1!.id]
            })
            expect(reorderError).toBeNull()

            // Step 8: Verify reorder
            const reorderedResult = await getServerWalkthroughsAction({
                serverId: testServer1!.id
            })
            const [errorReorder, reorderedWalkthroughs] = reorderedResult
            expect(errorReorder).toBeNull()
            expect(reorderedWalkthroughs?.[0].walkthrough.id).toBe(testWalkthrough2.id)
            expect(reorderedWalkthroughs?.[1].walkthrough.id).toBe(testWalkthrough1.id)

            // Step 9: Remove assignment
            const [removeError] = await removeWalkthroughAssignmentAction({
                serverId: testServer1!.id,
                walkthroughId: testWalkthrough2!.id
            })
            expect(removeError).toBeNull()

            // Step 10: Verify removal
            const finalResult = await getServerWalkthroughsAction({
                serverId: testServer1!.id
            })
            const [errorFinal, finalWalkthroughs] = finalResult
            expect(errorFinal).toBeNull()
            expect(finalWalkthroughs).toHaveLength(1)
            expect(finalWalkthroughs?.[0].walkthrough.id).toBe(testWalkthrough1.id)
        })
    })

    describe('Cascade Delete Operations', () => {
        beforeEach(async () => {
            // Create test data with unique slug
            const [errorS, server] = await createMcpServerAction({
                name: 'Test Server',
                slug: `test-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(errorS).toBeNull()
            testServer1 = server
            if (server) createdResources.servers.add(server.id)

            const [errorW, walkthrough] = await createWalkthroughAction({
                title: 'Test Walkthrough',
                type: 'course',
                isPublished: true
            })
            expect(errorW).toBeNull()
            testWalkthrough1 = walkthrough
            if (walkthrough) createdResources.walkthroughs.add(walkthrough.id)

            // Create assignment
            await assignWalkthroughsToServerAction({
                serverId: testServer1.id,
                walkthroughIds: [{ walkthroughId: testWalkthrough1.id }]
            })
        })

        test('should cascade delete assignments when server is deleted', async () => {
            // Verify assignment exists
            const assignmentsBefore = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer1.id))
            expect(assignmentsBefore).toHaveLength(1)

            // Delete server
            await deleteMcpServerAction({ serverId: testServer1.id })

            // Verify assignments were deleted
            const assignmentsAfter = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer1.id))
            expect(assignmentsAfter).toHaveLength(0)
        })

        test('should cascade delete assignments when walkthrough is deleted', async () => {
            // Verify assignment exists
            const assignmentsBefore = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.walkthroughId, testWalkthrough1.id))
            expect(assignmentsBefore).toHaveLength(1)

            // Delete walkthrough
            await deleteWalkthroughAction({ walkthroughId: testWalkthrough1.id })

            // Verify assignments were deleted
            const assignmentsAfter = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.walkthroughId, testWalkthrough1.id))
            expect(assignmentsAfter).toHaveLength(0)
        })
    })

    describe('Data Integrity', () => {
        test('should not create duplicate assignments', async () => {
            // Create test data with unique slug
            const [errorS1, server1] = await createMcpServerAction({
                name: 'Integrity Test Server',
                slug: `integrity-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(errorS1).toBeNull()
            testServer1 = server1

            const [errorW1, walkthrough1] = await createWalkthroughAction({
                title: 'Integrity Test Walkthrough',
                type: 'course',
                isPublished: true
            })
            expect(errorW1).toBeNull()
            testWalkthrough1 = walkthrough1

            // Assign walkthrough
            await assignWalkthroughsToServerAction({
                serverId: testServer1.id,
                walkthroughIds: [{ walkthroughId: testWalkthrough1.id }]
            })

            // The assignWalkthroughsToServerAction clears existing assignments before adding new ones,
            // so calling it again should just replace the existing assignment
            await assignWalkthroughsToServerAction({
                serverId: testServer1.id,
                walkthroughIds: [{ walkthroughId: testWalkthrough1.id, displayOrder: 99 }]
            })

            // Verify only one assignment exists
            const assignments = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(
                    and(
                        eq(schema.mcpServerWalkthroughs.mcpServerId, testServer1.id),
                        eq(schema.mcpServerWalkthroughs.walkthroughId, testWalkthrough1.id)
                    )
                )

            expect(assignments).toHaveLength(1)
            expect(assignments[0].displayOrder).toBe(99)
        })

        test('should maintain consistent display order', async () => {
            // Create test data with unique slug
            const [errorOrder, serverOrder] = await createMcpServerAction({
                name: 'Order Test Server',
                slug: `order-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(errorOrder).toBeNull()
            testServer1 = serverOrder

            const walkthroughResults = await Promise.all(
                Array.from({ length: 5 }, (_, i) =>
                    createWalkthroughAction({
                        title: `Walkthrough ${i + 1}`,
                        type: 'course',
                        isPublished: true
                    })
                )
            )

            const walkthroughs = walkthroughResults.map(([error, data]) => {
                expect(error).toBeNull()
                return data!
            })

            // Assign all walkthroughs
            await assignWalkthroughsToServerAction({
                serverId: testServer1.id,
                walkthroughIds: walkthroughs.map((w, i) => ({
                    walkthroughId: w.id,
                    displayOrder: i
                }))
            })

            // Remove middle walkthrough
            await removeWalkthroughAssignmentAction({
                serverId: testServer1.id,
                walkthroughId: walkthroughs[2].id
            })

            // Verify order is maintained
            const result = await getServerWalkthroughsAction({
                serverId: testServer1.id
            })
            const [error, assignments] = result
            expect(error).toBeNull()

            expect(assignments).toHaveLength(4)
            assignments.forEach((assignment, index) => {
                expect(assignment.assignment.displayOrder).toBe(index)
            })
        })
    })

    describe('Performance with Large Data Sets', () => {
        test('should handle many walkthroughs efficiently', async () => {
            // Create server with unique slug
            const [errorPerf, serverPerf] = await createMcpServerAction({
                name: 'Performance Test Server',
                slug: `perf-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(errorPerf).toBeNull()
            testServer1 = serverPerf

            // Create many walkthroughs
            const walkthroughCount = 50
            const walkthroughResults = await Promise.all(
                Array.from({ length: walkthroughCount }, (_, i) =>
                    createWalkthroughAction({
                        title: `Performance Test Walkthrough ${i + 1}`,
                        type: i % 2 === 0 ? 'course' : 'quickstart',
                        isPublished: true
                    })
                )
            )

            const walkthroughs = walkthroughResults.map(([error, data]) => {
                expect(error).toBeNull()
                return data!
            })

            // Measure assignment time
            const startTime = Date.now()
            await assignWalkthroughsToServerAction({
                serverId: testServer1.id,
                walkthroughIds: walkthroughs.map((w, i) => ({
                    walkthroughId: w.id,
                    displayOrder: i
                }))
            })
            const assignTime = Date.now() - startTime

            // Measure retrieval time
            const retrieveStartTime = Date.now()
            const result = await getServerWalkthroughsAction({
                serverId: testServer1.id
            })
            const [error, assignments] = result
            expect(error).toBeNull()
            const retrieveTime = Date.now() - retrieveStartTime

            // Verify all assignments were created
            expect(assignments).toHaveLength(walkthroughCount)

            // Performance assertions (adjust as needed based on your requirements)
            expect(assignTime).toBeLessThan(5000) // 5 seconds
            expect(retrieveTime).toBeLessThan(1000) // 1 second

            // Test reordering performance
            const reorderStartTime = Date.now()
            await reorderServerWalkthroughsAction({
                serverId: testServer1.id,
                walkthroughIds: walkthroughs.map((w) => w.id).reverse()
            })
            const reorderTime = Date.now() - reorderStartTime

            expect(reorderTime).toBeLessThan(3000) // 3 seconds
        })
    })
})
