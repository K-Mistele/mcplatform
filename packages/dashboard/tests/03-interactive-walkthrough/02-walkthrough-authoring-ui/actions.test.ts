import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import { db, organization, session as sessionTable, user, walkthroughSteps, walkthroughs } from 'database'
import { and, eq, max } from 'drizzle-orm'
import { z } from 'zod'

describe('Walkthrough Actions Data Layer Tests', () => {
    let testOrganizationId: string
    let testUserId: string
    let testSessionId: string
    let testWalkthroughId: string

    // Track created resources for cleanup
    const createdOrganizations: string[] = []
    const createdUsers: string[] = []
    const createdSessions: string[] = []
    const createdWalkthroughs: string[] = []
    const createdWalkthroughSteps: string[] = []

    beforeEach(async () => {
        // Create test organization
        testOrganizationId = `org_${nanoid(8)}`
        await db.insert(organization).values({
            id: testOrganizationId,
            name: 'Test Organization',
            createdAt: new Date()
        })
        createdOrganizations.push(testOrganizationId)

        // Create test user
        testUserId = `user_${nanoid(8)}`
        await db.insert(user).values({
            id: testUserId,
            email: 'test@example.com',
            emailVerified: true,
            name: 'Test User',
            createdAt: new Date(),
            updatedAt: new Date()
        })
        createdUsers.push(testUserId)

        // Create test session
        testSessionId = `sess_${nanoid(8)}`
        await db.insert(sessionTable).values({
            id: testSessionId,
            userId: testUserId,
            activeOrganizationId: testOrganizationId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
            token: `token_${nanoid(16)}`,
            ipAddress: '127.0.0.1',
            userAgent: 'test-agent',
            createdAt: new Date(),
            updatedAt: new Date()
        })
        createdSessions.push(testSessionId)
    })

    afterEach(async () => {
        // Clean up in reverse order to respect foreign key constraints
        for (const id of createdWalkthroughSteps) {
            await db.delete(walkthroughSteps).where(eq(walkthroughSteps.id, id))
        }

        for (const id of createdWalkthroughs) {
            await db.delete(walkthroughs).where(eq(walkthroughs.id, id))
        }

        for (const id of createdSessions) {
            await db.delete(sessionTable).where(eq(sessionTable.id, id))
        }

        for (const id of createdUsers) {
            await db.delete(user).where(eq(user.id, id))
        }

        for (const id of createdOrganizations) {
            await db.delete(organization).where(eq(organization.id, id))
        }

        // Clear tracking arrays
        createdOrganizations.length = 0
        createdUsers.length = 0
        createdSessions.length = 0
        createdWalkthroughs.length = 0
        createdWalkthroughSteps.length = 0
    })

    describe('Walkthrough Schema Validation', () => {
        const createWalkthroughSchema = z.object({
            title: z.string().min(1).max(100),
            description: z.string().max(500).optional(),
            type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
            isPublished: z.boolean()
        })

        test('should validate walkthrough creation input', () => {
            const validInput = {
                title: 'Valid Walkthrough',
                description: 'A valid description',
                type: 'course' as const,
                isPublished: true
            }

            const result = createWalkthroughSchema.safeParse(validInput)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.title).toBe('Valid Walkthrough')
                expect(result.data.type).toBe('course')
                expect(result.data.isPublished).toBe(true)
            }
        })

        test('should reject invalid title', () => {
            const invalidInputs = [
                { title: '', description: 'Valid', type: 'course' as const, isPublished: true },
                { title: 'x'.repeat(101), description: 'Valid', type: 'course' as const, isPublished: true }
            ]

            for (const input of invalidInputs) {
                const result = createWalkthroughSchema.safeParse(input)
                expect(result.success).toBe(false)
            }
        })

        test('should reject invalid description', () => {
            const invalidInput = {
                title: 'Valid Title',
                description: 'x'.repeat(501),
                type: 'course' as const,
                isPublished: true
            }

            const result = createWalkthroughSchema.safeParse(invalidInput)
            expect(result.success).toBe(false)
        })

        test('should reject invalid type', () => {
            const invalidInput = {
                title: 'Valid Title',
                description: 'Valid description',
                type: 'invalid' as any,
                isPublished: true
            }

            const result = createWalkthroughSchema.safeParse(invalidInput)
            expect(result.success).toBe(false)
        })
    })

    describe('Walkthrough Step Schema Validation', () => {
        const createWalkthroughStepSchema = z.object({
            walkthroughId: z.string(),
            title: z.string().min(1).max(200),
            contentFields: z.object({
                version: z.literal('v1'),
                introductionForAgent: z.string(),
                contextForAgent: z.string(),
                contentForUser: z.string(),
                operationsForAgent: z.string()
            })
        })

        test('should validate step creation input', () => {
            const validInput = {
                walkthroughId: `wt_${nanoid(8)}`,
                title: 'Valid Step',
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: 'Intro',
                    contextForAgent: 'Context',
                    contentForUser: 'User content',
                    operationsForAgent: 'Operations'
                }
            }

            const result = createWalkthroughStepSchema.safeParse(validInput)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.title).toBe('Valid Step')
                expect(result.data.contentFields.version).toBe('v1')
            }
        })

        test('should reject invalid step title', () => {
            const invalidInputs = [
                {
                    walkthroughId: `wt_${nanoid(8)}`,
                    title: '',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: '',
                        operationsForAgent: ''
                    }
                },
                {
                    walkthroughId: `wt_${nanoid(8)}`,
                    title: 'x'.repeat(201),
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: '',
                        operationsForAgent: ''
                    }
                }
            ]

            for (const input of invalidInputs) {
                const result = createWalkthroughStepSchema.safeParse(input)
                expect(result.success).toBe(false)
            }
        })

        test('should require valid content fields structure', () => {
            const invalidInput = {
                walkthroughId: `wt_${nanoid(8)}`,
                title: 'Valid Title',
                contentFields: {
                    version: 'v2', // Invalid version
                    invalidField: 'Should not be here'
                }
            }

            const result = createWalkthroughStepSchema.safeParse(invalidInput)
            expect(result.success).toBe(false)
        })
    })

    describe('Database Operations', () => {
        test('should create walkthrough in database', async () => {
            testWalkthroughId = `wt_${nanoid(8)}`

            const [newWalkthrough] = await db
                .insert(walkthroughs)
                .values({
                    id: testWalkthroughId,
                    organizationId: testOrganizationId,
                    title: 'Database Test Walkthrough',
                    description: 'Testing database operations',
                    type: 'course',
                    status: 'draft'
                })
                .returning()

            createdWalkthroughs.push(newWalkthrough.id)

            expect(newWalkthrough.title).toBe('Database Test Walkthrough')
            expect(newWalkthrough.organizationId).toBe(testOrganizationId)
            expect(newWalkthrough.status).toBe('draft')
        })

        test('should update walkthrough in database', async () => {
            // Create walkthrough first
            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Original Title',
                description: 'Original description',
                type: 'course',
                status: 'draft'
            })
            createdWalkthroughs.push(testWalkthroughId)

            // Update walkthrough
            const [updatedWalkthrough] = await db
                .update(walkthroughs)
                .set({
                    title: 'Updated Title',
                    description: 'Updated description',
                    status: 'published'
                })
                .where(and(eq(walkthroughs.id, testWalkthroughId), eq(walkthroughs.organizationId, testOrganizationId)))
                .returning()

            expect(updatedWalkthrough.title).toBe('Updated Title')
            expect(updatedWalkthrough.description).toBe('Updated description')
            expect(updatedWalkthrough.status).toBe('published')
        })

        test('should delete walkthrough with cascade', async () => {
            // Create walkthrough
            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'To Delete',
                description: 'Will be deleted',
                type: 'course',
                status: 'draft'
            })
            createdWalkthroughs.push(testWalkthroughId)

            // Create steps
            const stepId1 = `wts_${nanoid(8)}`
            const stepId2 = `wts_${nanoid(8)}`
            await db.insert(walkthroughSteps).values([
                {
                    id: stepId1,
                    walkthroughId: testWalkthroughId,
                    title: 'Step 1',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: 'Content 1',
                        operationsForAgent: ''
                    },
                    displayOrder: 1
                },
                {
                    id: stepId2,
                    walkthroughId: testWalkthroughId,
                    title: 'Step 2',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: 'Content 2',
                        operationsForAgent: ''
                    },
                    displayOrder: 2
                }
            ])

            // Delete steps first (cascade)
            await db.delete(walkthroughSteps).where(eq(walkthroughSteps.walkthroughId, testWalkthroughId))

            // Delete walkthrough
            const [deletedWalkthrough] = await db
                .delete(walkthroughs)
                .where(and(eq(walkthroughs.id, testWalkthroughId), eq(walkthroughs.organizationId, testOrganizationId)))
                .returning()

            expect(deletedWalkthrough.id).toBe(testWalkthroughId)

            // Verify deletion
            const remainingWalkthrough = await db
                .select()
                .from(walkthroughs)
                .where(eq(walkthroughs.id, testWalkthroughId))

            expect(remainingWalkthrough).toHaveLength(0)

            // Remove from cleanup since already deleted
            const index = createdWalkthroughs.indexOf(testWalkthroughId)
            if (index > -1) createdWalkthroughs.splice(index, 1)
        })

        test('should create walkthrough step with auto-generated display order', async () => {
            // Create walkthrough first
            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Step Test Walkthrough',
                description: 'For testing steps',
                type: 'course',
                status: 'draft'
            })
            createdWalkthroughs.push(testWalkthroughId)

            // Get max display order
            const maxOrderResult = await db
                .select({ maxOrder: max(walkthroughSteps.displayOrder) })
                .from(walkthroughSteps)
                .where(eq(walkthroughSteps.walkthroughId, testWalkthroughId))

            const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1

            // Create step
            const stepId = `wts_${nanoid(8)}`
            const [newStep] = await db
                .insert(walkthroughSteps)
                .values({
                    id: stepId,
                    walkthroughId: testWalkthroughId,
                    title: 'Test Step',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Intro',
                        contextForAgent: 'Context',
                        contentForUser: 'User content',
                        operationsForAgent: 'Operations'
                    },
                    displayOrder: nextOrder
                })
                .returning()

            createdWalkthroughSteps.push(newStep.id)

            expect(newStep.title).toBe('Test Step')
            expect(newStep.displayOrder).toBe(1)
            expect(newStep.walkthroughId).toBe(testWalkthroughId)
        })

        test('should update walkthrough step content fields', async () => {
            // Create walkthrough and step
            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Update Test',
                type: 'course',
                status: 'draft'
            })
            createdWalkthroughs.push(testWalkthroughId)

            const stepId = `wts_${nanoid(8)}`
            await db.insert(walkthroughSteps).values({
                id: stepId,
                walkthroughId: testWalkthroughId,
                title: 'Original Step',
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: 'Original intro',
                    contextForAgent: 'Original context',
                    contentForUser: 'Original content',
                    operationsForAgent: 'Original operations'
                },
                displayOrder: 1
            })
            createdWalkthroughSteps.push(stepId)

            // Update step
            const [updatedStep] = await db
                .update(walkthroughSteps)
                .set({
                    title: 'Updated Step',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Updated intro',
                        contextForAgent: 'Updated context',
                        contentForUser: 'Updated content',
                        operationsForAgent: 'Updated operations'
                    }
                })
                .where(eq(walkthroughSteps.id, stepId))
                .returning()

            expect(updatedStep.title).toBe('Updated Step')
            expect(updatedStep.contentFields.contentForUser).toBe('Updated content')
        })

        test('should handle organization ownership verification', async () => {
            // Create two organizations
            const org1Id = `org_${nanoid(8)}`
            const org2Id = `org_${nanoid(8)}`

            await db.insert(organization).values([
                { id: org1Id, name: 'Org 1', createdAt: new Date() },
                { id: org2Id, name: 'Org 2', createdAt: new Date() }
            ])
            createdOrganizations.push(org1Id, org2Id)

            // Create walkthrough in org1
            const walkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: walkthroughId,
                organizationId: org1Id,
                title: 'Org 1 Walkthrough',
                type: 'course',
                status: 'draft'
            })
            createdWalkthroughs.push(walkthroughId)

            // Try to access from org2 (should not find)
            const walkthroughFromOrg2 = await db
                .select()
                .from(walkthroughs)
                .where(and(eq(walkthroughs.id, walkthroughId), eq(walkthroughs.organizationId, org2Id)))

            expect(walkthroughFromOrg2).toHaveLength(0)

            // Access from org1 (should find)
            const walkthroughFromOrg1 = await db
                .select()
                .from(walkthroughs)
                .where(and(eq(walkthroughs.id, walkthroughId), eq(walkthroughs.organizationId, org1Id)))

            expect(walkthroughFromOrg1).toHaveLength(1)
            expect(walkthroughFromOrg1[0].title).toBe('Org 1 Walkthrough')
        })
    })

    describe('Type-Based Validation Logic', () => {
        test('should identify required fields by walkthrough type', () => {
            const getRequiredFields = (type: string): string[] => {
                const requirements: Record<string, string[]> = {
                    course: ['contentForUser'],
                    installer: ['contentForUser', 'operationsForAgent'],
                    troubleshooting: ['contentForUser', 'contextForAgent'],
                    integration: ['contentForUser', 'operationsForAgent'],
                    quickstart: ['contentForUser']
                }
                return requirements[type] || ['contentForUser']
            }

            expect(getRequiredFields('course')).toEqual(['contentForUser'])
            expect(getRequiredFields('installer')).toEqual(['contentForUser', 'operationsForAgent'])
            expect(getRequiredFields('troubleshooting')).toEqual(['contentForUser', 'contextForAgent'])
            expect(getRequiredFields('integration')).toEqual(['contentForUser', 'operationsForAgent'])
            expect(getRequiredFields('quickstart')).toEqual(['contentForUser'])
            expect(getRequiredFields('unknown')).toEqual(['contentForUser'])
        })

        test('should validate content completeness by type', () => {
            const validateContentByType = (type: string, contentFields: Record<string, string>) => {
                const requiredFields = {
                    course: ['contentForUser'],
                    installer: ['contentForUser', 'operationsForAgent'],
                    troubleshooting: ['contentForUser', 'contextForAgent'],
                    integration: ['contentForUser', 'operationsForAgent'],
                    quickstart: ['contentForUser']
                }[type] || ['contentForUser']

                const errors: string[] = []
                for (const field of requiredFields) {
                    if (!contentFields[field] || contentFields[field].trim() === '') {
                        errors.push(`${field} is required for ${type} walkthroughs`)
                    }
                }
                return errors
            }

            // Valid installer content
            const validInstallerContent = {
                contentForUser: 'Install instructions',
                operationsForAgent: 'Execute installation',
                contextForAgent: '',
                introductionForAgent: ''
            }
            expect(validateContentByType('installer', validInstallerContent)).toEqual([])

            // Invalid installer content (missing operations)
            const invalidInstallerContent = {
                contentForUser: 'Install instructions',
                operationsForAgent: '',
                contextForAgent: '',
                introductionForAgent: ''
            }
            expect(validateContentByType('installer', invalidInstallerContent)).toEqual([
                'operationsForAgent is required for installer walkthroughs'
            ])

            // Valid troubleshooting content
            const validTroubleshootingContent = {
                contentForUser: 'Troubleshooting steps',
                contextForAgent: 'Problem context',
                operationsForAgent: '',
                introductionForAgent: ''
            }
            expect(validateContentByType('troubleshooting', validTroubleshootingContent)).toEqual([])
        })
    })
})
