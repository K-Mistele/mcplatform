import * as authModule from '@/lib/auth/auth'
import {
    createWalkthroughAction,
    createWalkthroughStepAction,
    deleteWalkthroughAction,
    deleteWalkthroughStepAction,
    reorderWalkthroughStepsAction,
    updateWalkthroughAction,
    updateWalkthroughStepAction
} from '@/lib/orpc/actions'
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { db, schema } from 'database'
import { eq } from 'drizzle-orm'
import * as nextCache from 'next/cache'

describe('Walkthrough oRPC Actions - Comprehensive Tests', () => {
    // Track created resources for cleanup
    const createdWalkthroughs: string[] = []
    const createdWalkthroughSteps: string[] = []

    // Mock session
    let mockSession: any = {
        user: {
            id: 'user_123',
            name: 'Test User',
            email: 'test@example.com'
        },
        session: {
            activeOrganizationId: 'org_123'
        }
    }

    // Track revalidated paths
    let mockRevalidatePaths: string[] = []

    beforeAll(async () => {
        // Ensure test organization exists
        const existingOrg = await db
            .select()
            .from(schema.organization)
            .where(eq(schema.organization.id, 'org_123'))
            .limit(1)

        if (existingOrg.length === 0) {
            await db.insert(schema.organization).values({
                id: 'org_123',
                name: 'Test Organization',
                slug: 'test-org',
                createdAt: new Date()
            })
        }
    })

    afterAll(async () => {
        // Cleanup in reverse order due to foreign key constraints
        // Delete steps first
        for (const stepId of createdWalkthroughSteps) {
            try {
                await db.delete(schema.walkthroughSteps).where(eq(schema.walkthroughSteps.id, stepId))
            } catch (error) {
                console.error(`Failed to delete step ${stepId}:`, error)
            }
        }

        // Then delete walkthroughs
        for (const walkthroughId of createdWalkthroughs) {
            try {
                await db.delete(schema.walkthroughs).where(eq(schema.walkthroughs.id, walkthroughId))
            } catch (error) {
                console.error(`Failed to delete walkthrough ${walkthroughId}:`, error)
            }
        }

        // Clean up test organization
        await db.delete(schema.organization).where(eq(schema.organization.id, 'org_123'))
    })

    beforeEach(() => {
        // Reset mocks
        mockRevalidatePaths = []
        mockSession = {
            user: {
                id: 'user_123',
                name: 'Test User',
                email: 'test@example.com'
            },
            session: {
                activeOrganizationId: 'org_123'
            }
        }
        spyOn(authModule, 'requireSession').mockResolvedValue(mockSession)
        spyOn(nextCache, 'revalidatePath').mockImplementation((path: string) => {
            mockRevalidatePaths.push(path)
        })
    })

    describe('createWalkthroughAction', () => {
        test('should create walkthrough with all valid fields', async () => {
            const [error, result] = await createWalkthroughAction({
                title: 'Complete Integration Guide',
                description: 'A comprehensive guide for API integration',
                type: 'integration',
                isPublished: false
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                createdWalkthroughs.push(result.id)

                // Verify returned data
                expect(result.id).toBeDefined()
                expect(result.title).toBe('Complete Integration Guide')
                expect(result.description).toBe('A comprehensive guide for API integration')
                expect(result.type).toBe('integration')
                expect(result.status).toBe('draft')
                expect(result.organizationId).toBe('org_123')

                // Verify database record
                const [dbRecord] = await db
                    .select()
                    .from(schema.walkthroughs)
                    .where(eq(schema.walkthroughs.id, result.id))

                expect(dbRecord).toBeDefined()
                expect(dbRecord.title).toBe('Complete Integration Guide')

                // Verify revalidation
                expect(mockRevalidatePaths).toContain('/dashboard/walkthroughs')
            }
        })

        test('should create published walkthrough when isPublished is true', async () => {
            const [error, result] = await createWalkthroughAction({
                title: 'Quick Start Guide',
                description: 'Get started in 5 minutes',
                type: 'quickstart',
                isPublished: true
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.status).toBe('published')
                createdWalkthroughs.push(result.id)

                // Verify in database
                const [dbRecord] = await db
                    .select()
                    .from(schema.walkthroughs)
                    .where(eq(schema.walkthroughs.id, result.id))

                expect(dbRecord.status).toBe('published')
            }
        })

        test('should create walkthrough with minimal fields', async () => {
            const [error, result] = await createWalkthroughAction({
                title: 'Minimal Walkthrough',
                type: 'course',
                isPublished: false
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.title).toBe('Minimal Walkthrough')
                expect(result.description).toBeNull()
                expect(result.type).toBe('course')
                createdWalkthroughs.push(result.id)
            }
        })

        test('should fail with empty title', async () => {
            const [error, result] = await createWalkthroughAction({
                title: '',
                type: 'course',
                isPublished: false
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('BAD_REQUEST')
        })

        test('should fail with title over 100 characters', async () => {
            const [error, result] = await createWalkthroughAction({
                title: 'A'.repeat(101),
                type: 'course',
                isPublished: false
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('BAD_REQUEST')
        })

        test('should fail with description over 500 characters', async () => {
            const [error, result] = await createWalkthroughAction({
                title: 'Valid Title',
                description: 'A'.repeat(501),
                type: 'course',
                isPublished: false
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('BAD_REQUEST')
        })

        test('should fail with invalid type', async () => {
            const [error, result] = await createWalkthroughAction({
                title: 'Valid Title',
                type: 'invalid-type' as any,
                isPublished: false
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('BAD_REQUEST')
        })

        test('should fail without session', async () => {
            mockSession = null
            spyOn(authModule, 'requireSession').mockRejectedValue(new Error('Unauthorized'))

            const [error, result] = await createWalkthroughAction({
                title: 'No Session',
                type: 'course',
                isPublished: false
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
        })
    })

    describe('updateWalkthroughAction', () => {
        let walkthroughId: string

        beforeEach(async () => {
            // Create a walkthrough to update
            const [walkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Original Title',
                    description: 'Original description',
                    type: 'course',
                    status: 'draft',
                    organizationId: 'org_123'
                })
                .returning()
            walkthroughId = walkthrough.id
            createdWalkthroughs.push(walkthroughId)
        })

        test('should update title only', async () => {
            const [error, result] = await updateWalkthroughAction({
                walkthroughId,
                title: 'Updated Title'
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.title).toBe('Updated Title')
                expect(result.description).toBe('Original description')
                expect(result.type).toBe('course')

                // Verify in database
                const [dbRecord] = await db
                    .select()
                    .from(schema.walkthroughs)
                    .where(eq(schema.walkthroughs.id, walkthroughId))

                expect(dbRecord.title).toBe('Updated Title')
                expect(dbRecord.updatedAt).toBeGreaterThan(dbRecord.createdAt as number)

                // Verify revalidation
                expect(mockRevalidatePaths).toContain('/dashboard/walkthroughs')
                expect(mockRevalidatePaths).toContain(`/dashboard/walkthroughs/${walkthroughId}`)
            }
        })

        test('should update multiple fields', async () => {
            const [error, result] = await updateWalkthroughAction({
                walkthroughId,
                title: 'New Title',
                description: 'New description',
                type: 'installer',
                isPublished: true
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.title).toBe('New Title')
                expect(result.description).toBe('New description')
                expect(result.type).toBe('installer')
                expect(result.status).toBe('published')
            }
        })

        test('should handle empty description', async () => {
            const [error, result] = await updateWalkthroughAction({
                walkthroughId,
                description: ''
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.description).toBe('')
            }
        })

        test('should fail for non-existent walkthrough', async () => {
            const [error, result] = await updateWalkthroughAction({
                walkthroughId: 'wt_nonexistent',
                title: 'New Title'
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('RESOURCE_NOT_FOUND')
            expect(error?.message).toBe('Walkthrough not found')
        })

        test('should fail for walkthrough from different organization', async () => {
            // Create the different organization first
            await db.insert(schema.organization).values({
                id: 'org_different',
                name: 'Different Organization',
                slug: 'different-org',
                createdAt: new Date()
            })

            // Create walkthrough in different org
            const [otherWalkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Other Org Walkthrough',
                    type: 'course',
                    status: 'draft',
                    organizationId: 'org_different'
                })
                .returning()
            createdWalkthroughs.push(otherWalkthrough.id)

            const [error, result] = await updateWalkthroughAction({
                walkthroughId: otherWalkthrough.id,
                title: 'Should Fail'
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('RESOURCE_NOT_FOUND')

            // Clean up the other organization
            await db.delete(schema.organization).where(eq(schema.organization.id, 'org_different'))
        })
    })

    describe('deleteWalkthroughAction', () => {
        test('should delete walkthrough and cascade steps', async () => {
            // Create walkthrough with steps
            const [walkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'To Be Deleted',
                    type: 'course',
                    status: 'draft',
                    organizationId: 'org_123'
                })
                .returning()

            // Add some steps
            const stepIds: string[] = []
            for (let i = 1; i <= 3; i++) {
                const [step] = await db
                    .insert(schema.walkthroughSteps)
                    .values({
                        walkthroughId: walkthrough.id,
                        title: `Step ${i}`,
                        displayOrder: i,
                        contentFields: {
                            version: 'v1',
                            introductionForAgent: '',
                            contextForAgent: '',
                            contentForUser: '',
                            operationsForAgent: ''
                        }
                    })
                    .returning()
                stepIds.push(step.id)
            }

            // Delete walkthrough
            const [error, result] = await deleteWalkthroughAction({
                walkthroughId: walkthrough.id
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            // Verify walkthrough is deleted
            const deletedWalkthrough = await db
                .select()
                .from(schema.walkthroughs)
                .where(eq(schema.walkthroughs.id, walkthrough.id))

            expect(deletedWalkthrough.length).toBe(0)

            // Verify steps are deleted
            const deletedSteps = await db
                .select()
                .from(schema.walkthroughSteps)
                .where(eq(schema.walkthroughSteps.walkthroughId, walkthrough.id))

            expect(deletedSteps.length).toBe(0)

            // Verify revalidation
            expect(mockRevalidatePaths).toContain('/dashboard/walkthroughs')
        })

        test('should fail for non-existent walkthrough', async () => {
            const [error, result] = await deleteWalkthroughAction({
                walkthroughId: 'wt_nonexistent'
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('RESOURCE_NOT_FOUND')
        })
    })

    describe('createWalkthroughStepAction', () => {
        let walkthroughId: string

        beforeEach(async () => {
            const [walkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Walkthrough for Steps',
                    type: 'course',
                    status: 'draft',
                    organizationId: 'org_123'
                })
                .returning()
            walkthroughId = walkthrough.id
            createdWalkthroughs.push(walkthroughId)
        })

        test('should create step with auto-generated display order', async () => {
            const [error, result] = await createWalkthroughStepAction({
                walkthroughId,
                title: 'First Step'
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.id).toBeDefined()
                expect(result.title).toBe('First Step')
                expect(result.displayOrder).toBe(1)
                expect(result.contentFields).toEqual({
                    version: 'v1',
                    introductionForAgent: '',
                    contextForAgent: '',
                    contentForUser: '',
                    operationsForAgent: ''
                })

                createdWalkthroughSteps.push(result.id)

                // Verify revalidation
                expect(mockRevalidatePaths).toContain(`/dashboard/walkthroughs/${walkthroughId}`)
            }
        })

        test('should increment display order for subsequent steps', async () => {
            // Create first step
            const [step1] = await db
                .insert(schema.walkthroughSteps)
                .values({
                    walkthroughId,
                    title: 'Step 1',
                    displayOrder: 1,
                    contentFields: {
                        version: 'v1',
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: '',
                        operationsForAgent: ''
                    }
                })
                .returning()
            createdWalkthroughSteps.push(step1.id)

            // Create second step via action
            const [error, result] = await createWalkthroughStepAction({
                walkthroughId,
                title: 'Step 2'
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.displayOrder).toBe(2)
                createdWalkthroughSteps.push(result.id)
            }
        })

        test('should fail with empty title', async () => {
            const [error, result] = await createWalkthroughStepAction({
                walkthroughId,
                title: ''
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('BAD_REQUEST')
        })

        test('should fail for non-existent walkthrough', async () => {
            const [error, result] = await createWalkthroughStepAction({
                walkthroughId: 'wt_nonexistent',
                title: 'New Step'
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('RESOURCE_NOT_FOUND')
        })
    })

    describe('updateWalkthroughStepAction', () => {
        let walkthroughId: string
        let stepId: string

        beforeEach(async () => {
            // Create walkthrough
            const [walkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Walkthrough with Step',
                    type: 'course',
                    status: 'draft',
                    organizationId: 'org_123'
                })
                .returning()
            walkthroughId = walkthrough.id
            createdWalkthroughs.push(walkthroughId)

            // Create step
            const [step] = await db
                .insert(schema.walkthroughSteps)
                .values({
                    walkthroughId,
                    title: 'Original Step Title',
                    displayOrder: 1,
                    contentFields: {
                        version: 'v1',
                        introductionForAgent: 'Original intro',
                        contextForAgent: 'Original context',
                        contentForUser: 'Original content',
                        operationsForAgent: 'Original operations'
                    }
                })
                .returning()
            stepId = step.id
            createdWalkthroughSteps.push(stepId)
        })

        test('should update title only', async () => {
            const [error, result] = await updateWalkthroughStepAction({
                stepId,
                title: 'Updated Step Title'
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.title).toBe('Updated Step Title')
                expect(result.contentFields.contentForUser).toBe('Original content')
            }
        })

        test('should update individual content fields', async () => {
            const [error, result] = await updateWalkthroughStepAction({
                stepId,
                contentFields: {
                    contentForUser: 'New user content',
                    operationsForAgent: 'New operations'
                }
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.contentFields.contentForUser).toBe('New user content')
                expect(result.contentFields.operationsForAgent).toBe('New operations')
                expect(result.contentFields.introductionForAgent).toBe('Original intro')
                expect(result.contentFields.contextForAgent).toBe('Original context')
            }
        })

        test('should update both title and content', async () => {
            const [error, result] = await updateWalkthroughStepAction({
                stepId,
                title: 'New Title',
                contentFields: {
                    introductionForAgent: 'New intro',
                    contentForUser: 'New content'
                }
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            if (result) {
                expect(result.title).toBe('New Title')
                expect(result.contentFields.introductionForAgent).toBe('New intro')
                expect(result.contentFields.contentForUser).toBe('New content')
                expect(result.updatedAt).toBeGreaterThan(result.createdAt as number)
            }
        })

        test('should fail for non-existent step', async () => {
            const [error, result] = await updateWalkthroughStepAction({
                stepId: 'wts_nonexistent',
                title: 'New Title'
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('RESOURCE_NOT_FOUND')
        })
    })

    describe('reorderWalkthroughStepsAction', () => {
        let walkthroughId: string
        let stepIds: string[] = []

        beforeEach(async () => {
            // Create walkthrough
            const [walkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Walkthrough for Reordering',
                    type: 'course',
                    status: 'draft',
                    organizationId: 'org_123'
                })
                .returning()
            walkthroughId = walkthrough.id
            createdWalkthroughs.push(walkthroughId)

            // Create 4 steps
            stepIds = []
            for (let i = 1; i <= 4; i++) {
                const [step] = await db
                    .insert(schema.walkthroughSteps)
                    .values({
                        walkthroughId,
                        title: `Step ${i}`,
                        displayOrder: i,
                        contentFields: {
                            version: 'v1',
                            introductionForAgent: '',
                            contextForAgent: '',
                            contentForUser: '',
                            operationsForAgent: ''
                        }
                    })
                    .returning()
                stepIds.push(step.id)
                createdWalkthroughSteps.push(step.id)
            }
        })

        test('should reorder steps correctly', async () => {
            // Reverse the order
            const newOrder = [...stepIds].reverse()

            const [error, result] = await reorderWalkthroughStepsAction({
                walkthroughId,
                stepIds: newOrder
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            // Verify new order in database
            const steps = await db
                .select()
                .from(schema.walkthroughSteps)
                .where(eq(schema.walkthroughSteps.walkthroughId, walkthroughId))
                .orderBy(schema.walkthroughSteps.displayOrder)

            expect(steps[0].title).toBe('Step 4')
            expect(steps[1].title).toBe('Step 3')
            expect(steps[2].title).toBe('Step 2')
            expect(steps[3].title).toBe('Step 1')

            // Verify revalidation
            expect(mockRevalidatePaths).toContain(`/dashboard/walkthroughs/${walkthroughId}`)
        })

        test('should handle partial reorder', async () => {
            // Move first to last: [2, 3, 4, 1]
            const newOrder = [stepIds[1], stepIds[2], stepIds[3], stepIds[0]]

            const [error, result] = await reorderWalkthroughStepsAction({
                walkthroughId,
                stepIds: newOrder
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            const steps = await db
                .select()
                .from(schema.walkthroughSteps)
                .where(eq(schema.walkthroughSteps.walkthroughId, walkthroughId))
                .orderBy(schema.walkthroughSteps.displayOrder)

            expect(steps[0].title).toBe('Step 2')
            expect(steps[1].title).toBe('Step 3')
            expect(steps[2].title).toBe('Step 4')
            expect(steps[3].title).toBe('Step 1')
        })

        test('should succeed with correct number of steps', async () => {
            // This should succeed as we're providing all steps
            const [error, result] = await reorderWalkthroughStepsAction({
                walkthroughId,
                stepIds: stepIds
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()
        })

        test('should succeed even with extra or missing steps', async () => {
            // The action doesn't validate the exact count, it just updates what it can
            const [error, result] = await reorderWalkthroughStepsAction({
                walkthroughId,
                stepIds: [stepIds[0], stepIds[1]]
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()
        })
    })

    describe('deleteWalkthroughStepAction', () => {
        let walkthroughId: string
        let stepId: string

        beforeEach(async () => {
            // Create walkthrough
            const [walkthrough] = await db
                .insert(schema.walkthroughs)
                .values({
                    title: 'Walkthrough for Step Deletion',
                    type: 'course',
                    status: 'draft',
                    organizationId: 'org_123'
                })
                .returning()
            walkthroughId = walkthrough.id
            createdWalkthroughs.push(walkthroughId)

            // Create step
            const [step] = await db
                .insert(schema.walkthroughSteps)
                .values({
                    walkthroughId,
                    title: 'Step to Delete',
                    displayOrder: 1,
                    contentFields: {
                        version: 'v1',
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: '',
                        operationsForAgent: ''
                    }
                })
                .returning()
            stepId = step.id
            createdWalkthroughSteps.push(stepId)
        })

        test('should delete step successfully', async () => {
            const [error, result] = await deleteWalkthroughStepAction({
                stepId
            })

            expect(error).toBeNull()
            expect(result).toBeDefined()

            // Verify step is deleted
            const deletedStep = await db
                .select()
                .from(schema.walkthroughSteps)
                .where(eq(schema.walkthroughSteps.id, stepId))

            expect(deletedStep.length).toBe(0)

            // Verify revalidation
            expect(mockRevalidatePaths).toContain(`/dashboard/walkthroughs/${walkthroughId}`)
        })

        test('should fail for non-existent step', async () => {
            const [error, result] = await deleteWalkthroughStepAction({
                stepId: 'wts_nonexistent'
            })

            expect(error).toBeDefined()
            expect(result).toBeUndefined()
            expect(error?.code).toBe('RESOURCE_NOT_FOUND')
        })
    })
})
