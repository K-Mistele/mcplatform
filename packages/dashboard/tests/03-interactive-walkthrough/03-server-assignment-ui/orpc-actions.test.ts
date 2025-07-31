import {
    assignWalkthroughsToServerAction,
    getServerWalkthroughsAction,
    removeWalkthroughAssignmentAction,
    reorderServerWalkthroughsAction,
    updateWalkthroughAssignmentAction
} from '@/lib/orpc/actions/walkthrough-assignment'
import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'

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

describe('Walkthrough Assignment oRPC Actions', () => {
    // Track created resources for cleanup
    const createdResources = {
        organizations: new Set<string>(),
        servers: new Set<string>(),
        walkthroughs: new Set<string>(),
        assignments: new Set<string>()
    }

    let testOrganization: any
    let testServer: any
    let testWalkthrough1: any
    let testWalkthrough2: any
    let testWalkthrough3: any

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
        // Clean up created resources in reverse order
        // Delete assignments
        for (const serverId of createdResources.servers) {
            await db.delete(schema.mcpServerWalkthroughs).where(eq(schema.mcpServerWalkthroughs.mcpServerId, serverId))
        }

        // Delete walkthroughs
        for (const walkthroughId of createdResources.walkthroughs) {
            try {
                await db.delete(schema.walkthroughs).where(eq(schema.walkthroughs.id, walkthroughId))
            } catch (err) {
                // Ignore if already deleted
            }
        }

        // Delete servers
        for (const serverId of createdResources.servers) {
            try {
                await db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, serverId))
            } catch (err) {
                // Ignore if already deleted
            }
        }

        // Delete organization if we created it
        for (const orgId of createdResources.organizations) {
            try {
                await db.delete(schema.organization).where(eq(schema.organization.id, orgId))
            } catch (err) {
                // Ignore if already deleted
            }
        }
    })

    beforeEach(async () => {
        // Create test server with unique slug
        const [server] = await db
            .insert(schema.mcpServers)
            .values({
                id: `srv_${nanoid(8)}`,
                name: 'Test Server',
                slug: `test-server-${nanoid(6).toLowerCase()}`,
                productPlatformOrTool: 'Test Platform',
                organizationId: testOrganization.id
            })
            .returning()
        testServer = server
        createdResources.servers.add(server.id)

        // Create test walkthroughs
        const walkthroughs = await db
            .insert(schema.walkthroughs)
            .values([
                {
                    id: `wt_${nanoid(8)}`,
                    title: 'Walkthrough 1',
                    organizationId: testOrganization.id,
                    type: 'course',
                    status: 'published'
                },
                {
                    id: `wt_${nanoid(8)}`,
                    title: 'Walkthrough 2',
                    organizationId: testOrganization.id,
                    type: 'installer',
                    status: 'published'
                },
                {
                    id: `wt_${nanoid(8)}`,
                    title: 'Walkthrough 3',
                    organizationId: testOrganization.id,
                    type: 'quickstart',
                    status: 'draft'
                }
            ])
            .returning()

        testWalkthrough1 = walkthroughs[0]
        testWalkthrough2 = walkthroughs[1]
        testWalkthrough3 = walkthroughs[2]

        walkthroughs.forEach((w) => createdResources.walkthroughs.add(w.id))
    })

    describe('assignWalkthroughsToServerAction', () => {
        test('should assign walkthroughs to server successfully', async () => {
            const result = await assignWalkthroughsToServerAction({
                serverId: testServer.id,
                walkthroughIds: [
                    { walkthroughId: testWalkthrough1.id },
                    { walkthroughId: testWalkthrough2.id, displayOrder: 5 }
                ]
            })

            const [error, data] = result
            expect(error).toBeNull()
            expect(data?.success).toBe(true)

            // Verify assignments were created
            const assignments = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer.id))
                .orderBy(schema.mcpServerWalkthroughs.displayOrder)

            expect(assignments).toHaveLength(2)
            expect(assignments[0].walkthroughId).toBe(testWalkthrough1.id)
            expect(assignments[0].displayOrder).toBe(0)
            expect(assignments[0].isEnabled).toBe('true')
            expect(assignments[1].walkthroughId).toBe(testWalkthrough2.id)
            expect(assignments[1].displayOrder).toBe(5)
            expect(assignments[1].isEnabled).toBe('true')
        })

        test('should clear existing assignments when assigning new ones', async () => {
            // Create existing assignment
            await db.insert(schema.mcpServerWalkthroughs).values({
                mcpServerId: testServer.id,
                walkthroughId: testWalkthrough3.id,
                displayOrder: 0,
                isEnabled: 'true'
            })

            // Assign new walkthroughs
            const result = await assignWalkthroughsToServerAction({
                serverId: testServer.id,
                walkthroughIds: [{ walkthroughId: testWalkthrough1.id }]
            })

            const [error] = result
            expect(error).toBeNull()

            // Verify old assignment was removed
            const assignments = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer.id))

            expect(assignments).toHaveLength(1)
            expect(assignments[0].walkthroughId).toBe(testWalkthrough1.id)
        })

        test('should handle empty walkthrough list', async () => {
            // Create existing assignment
            await db.insert(schema.mcpServerWalkthroughs).values({
                mcpServerId: testServer.id,
                walkthroughId: testWalkthrough1.id,
                displayOrder: 0,
                isEnabled: 'true'
            })

            // Clear all assignments
            const result = await assignWalkthroughsToServerAction({
                serverId: testServer.id,
                walkthroughIds: []
            })

            const [error] = result
            expect(error).toBeNull()

            // Verify all assignments were removed
            const assignments = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer.id))

            expect(assignments).toHaveLength(0)
        })

        test('should throw error for non-existent server', async () => {
            const result = await assignWalkthroughsToServerAction({
                serverId: 'non-existent-id',
                walkthroughIds: [{ walkthroughId: testWalkthrough1.id }]
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('MCP server not found')
        })

        test('should throw error for non-existent walkthrough', async () => {
            const result = await assignWalkthroughsToServerAction({
                serverId: testServer.id,
                walkthroughIds: [{ walkthroughId: 'non-existent-walkthrough' }]
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('One or more walkthroughs not found')
        })

        test('should throw error for cross-organization access', async () => {
            // Create another organization and walkthrough
            const [otherOrg] = await db
                .insert(schema.organization)
                .values({
                    id: `org_${nanoid(8)}`,
                    name: 'Other Organization',
                    slug: `other-org-${nanoid(6).toLowerCase()}`,
                    createdAt: new Date()
                })
                .returning()
            createdResources.organizations.add(otherOrg.id)

            const [otherWalkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Other Org Walkthrough',
                    organizationId: otherOrg.id,
                    type: 'course',
                    status: 'published'
                })
                .returning()

            const result = await assignWalkthroughsToServerAction({
                serverId: testServer.id,
                walkthroughIds: [{ walkthroughId: otherWalkthrough.id }]
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('One or more walkthroughs not found')
        })
    })

    describe('updateWalkthroughAssignmentAction', () => {
        beforeEach(async () => {
            // Create test assignment
            await db.insert(schema.mcpServerWalkthroughs).values({
                mcpServerId: testServer.id,
                walkthroughId: testWalkthrough1.id,
                displayOrder: 0,
                isEnabled: 'true'
            })
        })

        test('should update display order', async () => {
            const result = await updateWalkthroughAssignmentAction({
                serverId: testServer.id,
                walkthroughId: testWalkthrough1.id,
                displayOrder: 10
            })

            const [error, data] = result
            expect(error).toBeNull()
            expect(data?.displayOrder).toBe(10)

            if (!data) {
                throw new Error('data is null')
            }

            // Verify in database
            const [assignment] = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer.id))

            expect(assignment.displayOrder).toBe(10)
        })

        test('should update isEnabled status', async () => {
            const result = await updateWalkthroughAssignmentAction({
                serverId: testServer.id,
                walkthroughId: testWalkthrough1.id,
                isEnabled: false
            })

            const [error, data] = result
            expect(error).toBeNull()
            expect(data?.isEnabled).toBe('false')

            // Verify in database
            const [assignment] = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer.id))

            expect(assignment.isEnabled).toBe('false')
        })

        test('should update both fields', async () => {
            const result = await updateWalkthroughAssignmentAction({
                serverId: testServer.id,
                walkthroughId: testWalkthrough1.id,
                displayOrder: 5,
                isEnabled: false
            })

            const [error, data] = result
            expect(error).toBeNull()
            expect(data?.displayOrder).toBe(5)
            expect(data?.isEnabled).toBe('false')
        })

        test('should return existing assignment when no updates provided', async () => {
            const result = await updateWalkthroughAssignmentAction({
                serverId: testServer.id,
                walkthroughId: testWalkthrough1.id
            })

            const [error, data] = result
            expect(error).toBeNull()
            expect(data?.displayOrder).toBe(0)
            expect(data?.isEnabled).toBe('true')
        })

        test('should throw error for non-existent assignment', async () => {
            const result = await updateWalkthroughAssignmentAction({
                serverId: testServer.id,
                walkthroughId: testWalkthrough2.id,
                displayOrder: 5
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('Assignment not found')
        })
    })

    describe('removeWalkthroughAssignmentAction', () => {
        beforeEach(async () => {
            // Create multiple assignments
            await db.insert(schema.mcpServerWalkthroughs).values([
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough1.id,
                    displayOrder: 0,
                    isEnabled: 'true'
                },
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough2.id,
                    displayOrder: 1,
                    isEnabled: 'true'
                },
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough3.id,
                    displayOrder: 2,
                    isEnabled: 'false'
                }
            ])
        })

        test('should remove assignment and reorder remaining ones', async () => {
            const result = await removeWalkthroughAssignmentAction({
                serverId: testServer.id,
                walkthroughId: testWalkthrough2.id
            })

            const [error] = result
            expect(error).toBeNull()

            // Verify assignment was removed
            const assignments = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer.id))
                .orderBy(schema.mcpServerWalkthroughs.displayOrder)

            expect(assignments).toHaveLength(2)
            expect(assignments[0].walkthroughId).toBe(testWalkthrough1.id)
            expect(assignments[0].displayOrder).toBe(0)
            expect(assignments[1].walkthroughId).toBe(testWalkthrough3.id)
            expect(assignments[1].displayOrder).toBe(1) // Reordered from 2 to 1
        })

        test('should throw error for non-existent assignment', async () => {
            const result = await removeWalkthroughAssignmentAction({
                serverId: testServer.id,
                walkthroughId: 'non-existent-walkthrough'
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('Assignment not found')
        })
    })

    describe('reorderServerWalkthroughsAction', () => {
        beforeEach(async () => {
            // Create assignments with specific order
            await db.insert(schema.mcpServerWalkthroughs).values([
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough1.id,
                    displayOrder: 0,
                    isEnabled: 'true'
                },
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough2.id,
                    displayOrder: 1,
                    isEnabled: 'true'
                },
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough3.id,
                    displayOrder: 2,
                    isEnabled: 'true'
                }
            ])
        })

        test('should reorder walkthroughs successfully', async () => {
            const result = await reorderServerWalkthroughsAction({
                serverId: testServer.id,
                walkthroughIds: [testWalkthrough3.id, testWalkthrough1.id, testWalkthrough2.id]
            })

            const [error] = result
            expect(error).toBeNull()

            // Verify new order
            const assignments = await db
                .select()
                .from(schema.mcpServerWalkthroughs)
                .where(eq(schema.mcpServerWalkthroughs.mcpServerId, testServer.id))
                .orderBy(schema.mcpServerWalkthroughs.displayOrder)

            expect(assignments[0].walkthroughId).toBe(testWalkthrough3.id)
            expect(assignments[0].displayOrder).toBe(0)
            expect(assignments[1].walkthroughId).toBe(testWalkthrough1.id)
            expect(assignments[1].displayOrder).toBe(1)
            expect(assignments[2].walkthroughId).toBe(testWalkthrough2.id)
            expect(assignments[2].displayOrder).toBe(2)
        })

        test('should throw error if walkthrough not assigned to server', async () => {
            // Create another walkthrough not assigned to the server
            const [unassignedWalkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Unassigned Walkthrough',
                    organizationId: testOrganization.id,
                    type: 'course',
                    status: 'published'
                })
                .returning()

            const result = await reorderServerWalkthroughsAction({
                serverId: testServer.id,
                walkthroughIds: [testWalkthrough1.id, unassignedWalkthrough.id]
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('One or more walkthroughs are not assigned to this server')
        })

        test('should throw error for non-existent server', async () => {
            const result = await reorderServerWalkthroughsAction({
                serverId: 'non-existent-server',
                walkthroughIds: [testWalkthrough1.id]
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('MCP server not found')
        })
    })

    describe('getServerWalkthroughsAction', () => {
        beforeEach(async () => {
            // Create assignments with different states
            await db.insert(schema.mcpServerWalkthroughs).values([
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough2.id,
                    displayOrder: 1,
                    isEnabled: 'false'
                },
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough1.id,
                    displayOrder: 0,
                    isEnabled: 'true'
                },
                {
                    mcpServerId: testServer.id,
                    walkthroughId: testWalkthrough3.id,
                    displayOrder: 2,
                    isEnabled: 'true'
                }
            ])
        })

        test('should return walkthroughs in display order', async () => {
            const result = await getServerWalkthroughsAction({
                serverId: testServer.id
            })

            const [error, data] = result
            expect(error).toBeNull()
            expect(data).toHaveLength(3)
            expect(data?.[0].walkthrough.id).toBe(testWalkthrough1.id)
            expect(data?.[0].assignment.displayOrder).toBe(0)
            expect(data?.[0].assignment.isEnabled).toBe('true')
            expect(data?.[1].walkthrough.id).toBe(testWalkthrough2.id)
            expect(data?.[1].assignment.displayOrder).toBe(1)
            expect(data?.[1].assignment.isEnabled).toBe('false')
            expect(data?.[2].walkthrough.id).toBe(testWalkthrough3.id)
            expect(data?.[2].assignment.displayOrder).toBe(2)
            expect(data?.[2].assignment.isEnabled).toBe('true')
        })

        test('should return empty array for server with no assignments', async () => {
            // Create another server without assignments
            const [emptyServer] = await db
                .insert(schema.mcpServers)
                .values({
                    name: 'Empty Server',
                    slug: `empty-server-${nanoid(6).toLowerCase()}`,
                    productPlatformOrTool: 'Test Platform',
                    organizationId: testOrganization.id
                })
                .returning()
            createdResources.servers.add(emptyServer.id)

            const result = await getServerWalkthroughsAction({
                serverId: emptyServer.id
            })

            const [error, data] = result
            expect(error).toBeNull()
            expect(data).toHaveLength(0)
        })

        test('should throw error for non-existent server', async () => {
            const result = await getServerWalkthroughsAction({
                serverId: 'non-existent-server'
            })

            const [error] = result
            expect(error).not.toBeNull()
            expect(error?.message).toBe('MCP server not found')
        })

        test('should include all walkthrough details', async () => {
            const result = await getServerWalkthroughsAction({
                serverId: testServer.id
            })

            const [error, data] = result
            expect(error).toBeNull()
            const firstResult = data?.[0]
            expect(firstResult?.walkthrough).toHaveProperty('title')
            expect(firstResult?.walkthrough).toHaveProperty('description')
            expect(firstResult?.walkthrough).toHaveProperty('type')
            expect(firstResult?.walkthrough).toHaveProperty('status')
            expect(firstResult?.walkthrough).toHaveProperty('createdAt')
            expect(firstResult?.walkthrough).toHaveProperty('updatedAt')
        })
    })
})
