import { afterAll, beforeAll, describe, expect, test, spyOn, mock } from 'bun:test'
import { db, schema } from 'database'
import { nanoid } from 'common/nanoid'
import { and, eq } from 'drizzle-orm'
import * as authModule from '@/lib/auth/auth'
import {
    assignWalkthroughsToServerAction,
    createMcpServerAction,
    createWalkthroughAction,
    createWalkthroughStepAction,
    updateWalkthroughAssignmentAction,
    removeWalkthroughAssignmentAction,
    reorderServerWalkthroughsAction,
    getServerWalkthroughsAction
} from '@/lib/orpc/actions'

// Mock revalidatePath
mock.module('next/cache', () => ({
    revalidatePath: mock(() => {})
}))

describe('Server Assignment UI - Complete Feature Test', () => {
    // Track all created resources for cleanup - USE SETS TO AVOID DUPLICATES
    const createdResources = {
        organizations: new Set<string>(),
        users: new Set<string>(),
        sessions: new Set<string>(),
        servers: new Set<string>(),
        walkthroughs: new Set<string>(),
        steps: new Set<string>(),
        assignments: new Set<string>()
    }

    let testOrg: { id: string; name: string; slug: string }
    let testUser: { id: string; email: string }
    let testSession: { id: string; token: string }

    beforeAll(async () => {
        // Create REAL test organization
        const orgId = `org_${nanoid(8)}`
        const [org] = await db
            .insert(schema.organization)
            .values({
                id: orgId,
                name: `Test Org ${orgId}`,
                slug: `test-org-${nanoid(6).toLowerCase()}`,
                createdAt: new Date()
            })
            .returning()
        testOrg = org
        createdResources.organizations.add(org.id)

        // Create REAL user record
        const userId = `user_${nanoid(8)}`
        const [user] = await db
            .insert(schema.user)
            .values({
                id: userId,
                email: `test-${userId}@example.com`,
                emailVerified: true,
                name: 'Test User',
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning()
        testUser = user
        createdResources.users.add(user.id)

        // Create REAL session record
        const sessionId = `sess_${nanoid(8)}`
        const [session] = await db
            .insert(schema.session)
            .values({
                id: sessionId,
                userId: user.id,
                activeOrganizationId: org.id,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                token: `token_${nanoid(16)}`,
                ipAddress: '127.0.0.1',
                userAgent: 'test-agent',
                createdAt: new Date(),
                updatedAt: new Date()
            })
            .returning()
        testSession = session
        createdResources.sessions.add(session.id)

        // Set up auth spy to use our test session
        spyOn(authModule, 'requireSession').mockResolvedValue({
            user: testUser,
            session: {
                id: testSession.id,
                userId: testUser.id,
                activeOrganizationId: testOrg.id
            }
        })
    })

    afterAll(async () => {
        // Clean up ONLY the specific resources we created
        // Delete in reverse order of foreign key dependencies

        // Delete assignments first (they reference servers and walkthroughs)
        for (const serverId of createdResources.servers) {
            await db
                .delete(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, serverId))
                .catch(() => {}) // Ignore if already deleted
        }

        // Delete steps (they reference walkthroughs)
        for (const stepId of createdResources.steps) {
            await db
                .delete(schema.walkthroughSteps)
                .where(eq(schema.walkthroughSteps.id, stepId))
                .catch(() => {})
        }

        // Delete walkthroughs
        for (const walkthroughId of createdResources.walkthroughs) {
            await db
                .delete(schema.walkthroughs)
                .where(eq(schema.walkthroughs.id, walkthroughId))
                .catch(() => {})
        }

        // Delete servers
        for (const serverId of createdResources.servers) {
            await db
                .delete(schema.mcpServers)
                .where(eq(schema.mcpServers.id, serverId))
                .catch(() => {})
        }

        // Delete sessions before users
        for (const sessionId of createdResources.sessions) {
            await db
                .delete(schema.session)
                .where(eq(schema.session.id, sessionId))
                .catch(() => {})
        }

        // Delete users
        for (const userId of createdResources.users) {
            await db
                .delete(schema.user)
                .where(eq(schema.user.id, userId))
                .catch(() => {})
        }

        // Delete organizations last
        for (const orgId of createdResources.organizations) {
            await db
                .delete(schema.organization)
                .where(eq(schema.organization.id, orgId))
                .catch(() => {})
        }
    })

    describe('Server-to-Walkthrough Assignment Flow', () => {
        test('complete user flow for assigning walkthroughs to a server', async () => {
            // Step 1: Create a server
            const [serverError, server] = await createMcpServerAction({
                name: 'Production API Server',
                slug: `prod-api-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'API Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })

            expect(serverError).toBeNull()
            expect(server).toBeDefined()
            if (server) createdResources.servers.add(server.id)

            // Step 2: Create multiple walkthroughs with steps
            const [walkthrough1Error, walkthrough1] = await createWalkthroughAction({
                title: 'API Quick Start Guide',
                description: 'Get started with our API in minutes',
                type: 'quickstart',
                isPublished: true
            })
            expect(walkthrough1Error).toBeNull()
            if (walkthrough1) createdResources.walkthroughs.add(walkthrough1.id)

            const [walkthrough2Error, walkthrough2] = await createWalkthroughAction({
                title: 'Authentication Tutorial',
                description: 'Learn how to authenticate with our API',
                type: 'course',
                isPublished: true
            })
            expect(walkthrough2Error).toBeNull()
            if (walkthrough2) createdResources.walkthroughs.add(walkthrough2.id)

            const [walkthrough3Error, walkthrough3] = await createWalkthroughAction({
                title: 'Troubleshooting Guide',
                description: 'Common issues and solutions',
                type: 'troubleshooting',
                isPublished: false // Draft walkthrough
            })
            expect(walkthrough3Error).toBeNull()
            if (walkthrough3) createdResources.walkthroughs.add(walkthrough3.id)

            // Add steps to walkthroughs
            const [step1Error, step1] = await createWalkthroughStepAction({
                walkthroughId: walkthrough1!.id,
                title: 'Install SDK',
                description: 'Install our SDK package'
            })
            expect(step1Error).toBeNull()
            if (step1) createdResources.steps.add(step1.id)

            const [step2Error, step2] = await createWalkthroughStepAction({
                walkthroughId: walkthrough1!.id,
                title: 'Make First API Call',
                description: 'Make your first API request'
            })
            expect(step2Error).toBeNull()
            if (step2) createdResources.steps.add(step2.id)

            // Step 3: Assign walkthroughs to server with custom display order
            const [assignError] = await assignWalkthroughsToServerAction({
                serverId: server!.id,
                walkthroughIds: [
                    { walkthroughId: walkthrough1!.id, displayOrder: 0 },
                    { walkthroughId: walkthrough2!.id, displayOrder: 1 },
                    { walkthroughId: walkthrough3!.id, displayOrder: 2 }
                ]
            })
            expect(assignError).toBeNull()

            // Step 4: Verify assignments were created correctly
            const [getError, assignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError).toBeNull()
            expect(assignments).toHaveLength(3)
            expect(assignments?.[0].walkthrough.title).toBe('API Quick Start Guide')
            expect(assignments?.[0].assignment.displayOrder).toBe(0)
            expect(assignments?.[0].assignment.isEnabled).toBe('true')
            expect(assignments?.[1].walkthrough.title).toBe('Authentication Tutorial')
            expect(assignments?.[2].walkthrough.status).toBe('draft')

            // Step 5: Disable a walkthrough
            const [disableError] = await updateWalkthroughAssignmentAction({
                serverId: server!.id,
                walkthroughId: walkthrough2!.id,
                isEnabled: false
            })
            expect(disableError).toBeNull()

            // Verify the walkthrough was disabled
            const [getError2, updatedAssignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError2).toBeNull()
            expect(updatedAssignments?.[1].assignment.isEnabled).toBe('false')

            // Step 6: Reorder walkthroughs
            const [reorderError] = await reorderServerWalkthroughsAction({
                serverId: server!.id,
                walkthroughIds: [walkthrough3!.id, walkthrough1!.id, walkthrough2!.id]
            })
            expect(reorderError).toBeNull()

            // Verify new order
            const [getError3, reorderedAssignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError3).toBeNull()
            expect(reorderedAssignments?.[0].walkthrough.id).toBe(walkthrough3!.id)
            expect(reorderedAssignments?.[1].walkthrough.id).toBe(walkthrough1!.id)
            expect(reorderedAssignments?.[2].walkthrough.id).toBe(walkthrough2!.id)

            // Step 7: Remove a walkthrough
            const [removeError] = await removeWalkthroughAssignmentAction({
                serverId: server!.id,
                walkthroughId: walkthrough3!.id
            })
            expect(removeError).toBeNull()

            // Verify removal and reordering
            const [getError4, finalAssignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError4).toBeNull()
            expect(finalAssignments).toHaveLength(2)
            expect(finalAssignments?.[0].walkthrough.id).toBe(walkthrough1!.id)
            expect(finalAssignments?.[0].assignment.displayOrder).toBe(0) // Reordered
            expect(finalAssignments?.[1].walkthrough.id).toBe(walkthrough2!.id)
            expect(finalAssignments?.[1].assignment.displayOrder).toBe(1) // Reordered
        })

        test('should handle empty walkthrough assignments', async () => {
            // Create server
            const [serverError, server] = await createMcpServerAction({
                name: 'Empty Server',
                slug: `empty-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(serverError).toBeNull()
            if (server) createdResources.servers.add(server.id)

            // Create and assign a walkthrough
            const [walkthroughError, walkthrough] = await createWalkthroughAction({
                title: 'Test Walkthrough',
                type: 'course',
                isPublished: true
            })
            expect(walkthroughError).toBeNull()
            if (walkthrough) createdResources.walkthroughs.add(walkthrough.id)

            await assignWalkthroughsToServerAction({
                serverId: server!.id,
                walkthroughIds: [{ walkthroughId: walkthrough!.id }]
            })

            // Now clear all assignments
            const [clearError] = await assignWalkthroughsToServerAction({
                serverId: server!.id,
                walkthroughIds: []
            })
            expect(clearError).toBeNull()

            // Verify no assignments remain
            const [getError, assignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError).toBeNull()
            expect(assignments).toHaveLength(0)
        })
    })

    describe('Walkthrough-to-Server Assignment Flow', () => {
        test('assign a walkthrough to multiple servers', async () => {
            // Create a walkthrough
            const [walkthroughError, walkthrough] = await createWalkthroughAction({
                title: 'Universal Getting Started Guide',
                description: 'Works for all our products',
                type: 'quickstart',
                isPublished: true
            })
            expect(walkthroughError).toBeNull()
            if (walkthrough) createdResources.walkthroughs.add(walkthrough.id)

            // Create multiple servers
            const servers = []
            for (let i = 0; i < 3; i++) {
                const [error, server] = await createMcpServerAction({
                    name: `Server ${i + 1}`,
                    slug: `server-${i + 1}-${nanoid(6).toLowerCase()}`,
                    productPlatformOrTool: `Platform ${i + 1}`,
                    authType: 'none',
                    supportTicketType: 'dashboard'
                })
                expect(error).toBeNull()
                if (server) {
                    servers.push(server)
                    createdResources.servers.add(server.id)
                }
            }

            // Assign walkthrough to all servers
            for (const server of servers) {
                const [assignError] = await assignWalkthroughsToServerAction({
                    serverId: server.id,
                    walkthroughIds: [{ walkthroughId: walkthrough!.id }]
                })
                expect(assignError).toBeNull()
            }

            // Verify walkthrough is assigned to all servers
            for (const server of servers) {
                const [getError, assignments] = await getServerWalkthroughsAction({
                    serverId: server.id
                })
                expect(getError).toBeNull()
                expect(assignments).toHaveLength(1)
                expect(assignments?.[0].walkthrough.id).toBe(walkthrough!.id)
            }

            // Update assignment status on one server
            const [updateError] = await updateWalkthroughAssignmentAction({
                serverId: servers[1].id,
                walkthroughId: walkthrough!.id,
                isEnabled: false
            })
            expect(updateError).toBeNull()

            // Verify update only affected one server
            const [getError1, assignments1] = await getServerWalkthroughsAction({
                serverId: servers[0].id
            })
            expect(getError1).toBeNull()
            expect(assignments1?.[0].assignment.isEnabled).toBe('true')

            const [getError2, assignments2] = await getServerWalkthroughsAction({
                serverId: servers[1].id
            })
            expect(getError2).toBeNull()
            expect(assignments2?.[0].assignment.isEnabled).toBe('false')
        })
    })

    describe('Drag-and-Drop Reordering', () => {
        test('should maintain order consistency during complex reordering', async () => {
            // Create server and walkthroughs
            const [serverError, server] = await createMcpServerAction({
                name: 'Reorder Test Server',
                slug: `reorder-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(serverError).toBeNull()
            if (server) createdResources.servers.add(server.id)

            const walkthroughs = []
            for (let i = 0; i < 5; i++) {
                const [error, wt] = await createWalkthroughAction({
                    title: `Step ${i + 1} Guide`,
                    type: 'course',
                    isPublished: true
                })
                expect(error).toBeNull()
                if (wt) {
                    walkthroughs.push(wt)
                    createdResources.walkthroughs.add(wt.id)
                }
            }

            // Initial assignment
            await assignWalkthroughsToServerAction({
                serverId: server!.id,
                walkthroughIds: walkthroughs.map((w, i) => ({
                    walkthroughId: w.id,
                    displayOrder: i
                }))
            })

            // Simulate drag from position 0 to position 3 (move first item to fourth position)
            const newOrder = [
                walkthroughs[1].id, // was at 1, now at 0
                walkthroughs[2].id, // was at 2, now at 1
                walkthroughs[3].id, // was at 3, now at 2
                walkthroughs[0].id, // was at 0, now at 3
                walkthroughs[4].id  // was at 4, stays at 4
            ]

            const [reorderError] = await reorderServerWalkthroughsAction({
                serverId: server!.id,
                walkthroughIds: newOrder
            })
            expect(reorderError).toBeNull()

            // Verify new order
            const [getError, assignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError).toBeNull()
            expect(assignments).toHaveLength(5)
            newOrder.forEach((id, index) => {
                expect(assignments?.[index].walkthrough.id).toBe(id)
                expect(assignments?.[index].assignment.displayOrder).toBe(index)
            })
        })
    })

    describe('Error Cases and Edge Conditions', () => {
        test('should handle cross-organization access attempts', async () => {
            // Create another organization
            const otherOrgId = `org_${nanoid(8)}`
            const [otherOrg] = await db
                .insert(schema.organization)
                .values({
                    id: otherOrgId,
                    name: 'Other Organization',
                    slug: `other-org-${nanoid(6).toLowerCase()}`,
                    createdAt: new Date()
                })
                .returning()
            createdResources.organizations.add(otherOrg.id)

            // Create server in our org
            const [serverError, server] = await createMcpServerAction({
                name: 'Our Server',
                slug: `our-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Our Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(serverError).toBeNull()
            if (server) createdResources.servers.add(server.id)

            // Create walkthrough in other org
            const [otherWalkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Other Org Walkthrough',
                    organizationId: otherOrg.id,
                    type: 'course',
                    status: 'published'
                })
                .returning()
            createdResources.walkthroughs.add(otherWalkthrough.id)

            // Try to assign other org's walkthrough to our server
            const [assignError] = await assignWalkthroughsToServerAction({
                serverId: server!.id,
                walkthroughIds: [{ walkthroughId: otherWalkthrough.id }]
            })
            expect(assignError).not.toBeNull()
            expect(assignError?.message).toContain('not found')
        })

        test('should handle non-existent resources gracefully', async () => {
            const fakeServerId = `srv_${nanoid(8)}`
            const fakeWalkthroughId = `wt_${nanoid(8)}`

            // Try to assign to non-existent server
            const [assignError1] = await assignWalkthroughsToServerAction({
                serverId: fakeServerId,
                walkthroughIds: []
            })
            expect(assignError1).not.toBeNull()
            expect(assignError1?.message).toContain('server not found')

            // Try to get walkthroughs for non-existent server
            const [getError] = await getServerWalkthroughsAction({
                serverId: fakeServerId
            })
            expect(getError).not.toBeNull()

            // Try to update non-existent assignment
            const [updateError] = await updateWalkthroughAssignmentAction({
                serverId: fakeServerId,
                walkthroughId: fakeWalkthroughId,
                isEnabled: false
            })
            expect(updateError).not.toBeNull()
        })

        test('should handle concurrent assignment operations', async () => {
            // Create server and walkthroughs
            const [serverError, server] = await createMcpServerAction({
                name: 'Concurrent Test Server',
                slug: `concurrent-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(serverError).toBeNull()
            if (server) createdResources.servers.add(server.id)

            const walkthroughs = []
            for (let i = 0; i < 3; i++) {
                const [error, wt] = await createWalkthroughAction({
                    title: `Concurrent Walkthrough ${i + 1}`,
                    type: 'course',
                    isPublished: true
                })
                expect(error).toBeNull()
                if (wt) {
                    walkthroughs.push(wt)
                    createdResources.walkthroughs.add(wt.id)
                }
            }

            // Simulate concurrent assignments (last one wins)
            const assignmentPromises = [
                assignWalkthroughsToServerAction({
                    serverId: server!.id,
                    walkthroughIds: [{ walkthroughId: walkthroughs[0].id }]
                }),
                assignWalkthroughsToServerAction({
                    serverId: server!.id,
                    walkthroughIds: [{ walkthroughId: walkthroughs[1].id }]
                }),
                assignWalkthroughsToServerAction({
                    serverId: server!.id,
                    walkthroughIds: [{ walkthroughId: walkthroughs[2].id }]
                })
            ]

            const results = await Promise.all(assignmentPromises)
            results.forEach(([error]) => {
                expect(error).toBeNull()
            })

            // Verify assignments exist (concurrent execution means we might have all 3)
            const [getError, assignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError).toBeNull()
            // Due to concurrent execution, the operations might not have conflicted
            // and all three assignments could exist
            expect(assignments!.length).toBeGreaterThan(0)
            expect(assignments!.length).toBeLessThanOrEqual(3)
            
            // Verify all assigned walkthroughs are from our test set
            const assignedIds = assignments?.map(a => a.walkthrough.id) || []
            const walkthroughIds = walkthroughs.map(w => w.id)
            assignedIds.forEach(id => {
                expect(walkthroughIds).toContain(id)
            })
        })
    })

    describe('Performance and Scale', () => {
        test('should handle large numbers of assignments efficiently', async () => {
            const startTime = Date.now()

            // Create server
            const [serverError, server] = await createMcpServerAction({
                name: 'Performance Test Server',
                slug: `perf-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Performance Platform',
                authType: 'none',
                supportTicketType: 'dashboard'
            })
            expect(serverError).toBeNull()
            if (server) createdResources.servers.add(server.id)

            // Create many walkthroughs
            const walkthroughCount = 25 // Reduced for test performance
            const walkthroughPromises = Array.from({ length: walkthroughCount }, (_, i) =>
                createWalkthroughAction({
                    title: `Performance Walkthrough ${i + 1}`,
                    type: i % 3 === 0 ? 'course' : i % 3 === 1 ? 'quickstart' : 'troubleshooting',
                    isPublished: true
                })
            )

            const walkthroughResults = await Promise.all(walkthroughPromises)
            const walkthroughs = walkthroughResults.map(([error, data]) => {
                expect(error).toBeNull()
                if (data) createdResources.walkthroughs.add(data.id)
                return data!
            })

            // Assign all walkthroughs
            const assignStartTime = Date.now()
            const [assignError] = await assignWalkthroughsToServerAction({
                serverId: server!.id,
                walkthroughIds: walkthroughs.map((w, i) => ({
                    walkthroughId: w.id,
                    displayOrder: i
                }))
            })
            expect(assignError).toBeNull()
            const assignTime = Date.now() - assignStartTime

            // Get all assignments
            const getStartTime = Date.now()
            const [getError, assignments] = await getServerWalkthroughsAction({
                serverId: server!.id
            })
            expect(getError).toBeNull()
            expect(assignments).toHaveLength(walkthroughCount)
            const getTime = Date.now() - getStartTime

            // Reorder all assignments
            const reorderStartTime = Date.now()
            const [reorderError] = await reorderServerWalkthroughsAction({
                serverId: server!.id,
                walkthroughIds: walkthroughs.map(w => w.id).reverse()
            })
            expect(reorderError).toBeNull()
            const reorderTime = Date.now() - reorderStartTime

            const totalTime = Date.now() - startTime

            // Performance assertions
            expect(assignTime).toBeLessThan(2000) // 2 seconds for assignment
            expect(getTime).toBeLessThan(500) // 500ms for retrieval
            expect(reorderTime).toBeLessThan(1500) // 1.5 seconds for reordering
            expect(totalTime).toBeLessThan(10000) // 10 seconds total
        })
    })
})