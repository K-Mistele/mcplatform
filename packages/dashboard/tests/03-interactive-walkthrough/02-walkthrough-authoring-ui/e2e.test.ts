import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import { db, organization, session as sessionTable, user, walkthroughSteps, walkthroughs } from 'database'
import { and, eq } from 'drizzle-orm'
import { renderWalkthroughStep } from '../../../src/lib/template-engine'

describe('Walkthrough Authoring Integration Tests', () => {
    let testOrganizationId: string
    let testUserId: string
    let testSessionId: string

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

    describe('Complete Walkthrough Creation Flow', () => {
        test('should create walkthrough → add steps → edit content → render template', async () => {
            // Step 1: Create walkthrough
            const walkthroughId = `wt_${nanoid(8)}`
            const [newWalkthrough] = await db
                .insert(walkthroughs)
                .values({
                    id: walkthroughId,
                    organizationId: testOrganizationId,
                    title: 'Complete Integration Guide',
                    description: 'A comprehensive guide for API integration',
                    type: 'integration',
                    status: 'draft'
                })
                .returning()

            createdWalkthroughs.push(newWalkthrough.id)

            expect(newWalkthrough.title).toBe('Complete Integration Guide')
            expect(newWalkthrough.status).toBe('draft')
            expect(newWalkthrough.organizationId).toBe(testOrganizationId)

            // Step 2: Add first step with auto-generated display order
            const step1Id = `wts_${nanoid(8)}`
            const [step1] = await db
                .insert(walkthroughSteps)
                .values({
                    id: step1Id,
                    walkthroughId: walkthroughId,
                    title: 'API Setup',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Guide user through initial API setup',
                        contextForAgent: 'User needs to configure their API keys and endpoints',
                        contentForUser: 'First, navigate to your API settings and obtain your API key.',
                        operationsForAgent: 'Verify API key format and test connection'
                    },
                    displayOrder: 1
                })
                .returning()

            createdWalkthroughSteps.push(step1.id)

            expect(step1.title).toBe('API Setup')
            expect(step1.displayOrder).toBe(1)
            expect(step1.walkthroughId).toBe(walkthroughId)

            // Step 3: Add second step
            const step2Id = `wts_${nanoid(8)}`
            const [step2] = await db
                .insert(walkthroughSteps)
                .values({
                    id: step2Id,
                    walkthroughId: walkthroughId,
                    title: 'Authentication Configuration',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Help user configure authentication',
                        contextForAgent: 'Authentication is required for all API calls',
                        contentForUser: 'Configure your authentication headers as shown below.',
                        operationsForAgent: 'Check authentication setup and troubleshoot issues'
                    },
                    displayOrder: 2
                })
                .returning()

            createdWalkthroughSteps.push(step2.id)

            expect(step2.displayOrder).toBe(2)

            // Step 4: Add third step
            const step3Id = `wts_${nanoid(8)}`
            const [step3] = await db
                .insert(walkthroughSteps)
                .values({
                    id: step3Id,
                    walkthroughId: walkthroughId,
                    title: 'Testing Your Integration',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Guide user through testing',
                        contextForAgent: 'Testing validates the integration works correctly',
                        contentForUser: 'Run the following test commands to verify your setup.',
                        operationsForAgent: 'Monitor test results and provide debugging help'
                    },
                    displayOrder: 3
                })
                .returning()

            createdWalkthroughSteps.push(step3.id)

            expect(step3.displayOrder).toBe(3)

            // Step 5: Edit step content (simulate user editing)
            const [updatedStep1] = await db
                .update(walkthroughSteps)
                .set({
                    title: 'API Setup and Configuration',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Guide user through comprehensive API setup',
                        contextForAgent: 'User needs to configure API keys, endpoints, and basic settings',
                        contentForUser:
                            'First, navigate to your API settings page and obtain your unique API key. Copy this key as you will need it in the next steps.',
                        operationsForAgent:
                            'Verify API key format, test initial connection, and validate endpoint accessibility'
                    }
                })
                .where(eq(walkthroughSteps.id, step1Id))
                .returning()

            expect(updatedStep1.title).toBe('API Setup and Configuration')
            expect(updatedStep1.contentFields.contentForUser).toContain('Copy this key as you will need it')

            // Step 6: Test template rendering for each step
            const renderedStep1 = renderWalkthroughStep(newWalkthrough, updatedStep1)
            expect(renderedStep1).toContain('# Walkthrough: Complete Integration Guide')
            expect(renderedStep1).toContain('## Step 1: API Setup and Configuration')
            expect(renderedStep1).toContain('### Step Context')
            expect(renderedStep1).toContain('Guide user through comprehensive API setup')
            expect(renderedStep1).toContain('### Background Information')
            expect(renderedStep1).toContain('User needs to configure API keys, endpoints')
            expect(renderedStep1).toContain('### Operations to Perform')
            expect(renderedStep1).toContain('Verify API key format, test initial connection')
            expect(renderedStep1).toContain('<StepContent>')
            expect(renderedStep1).toContain('Copy this key as you will need it')
            expect(renderedStep1).toContain('</StepContent>')

            const renderedStep2 = renderWalkthroughStep(newWalkthrough, step2)
            expect(renderedStep2).toContain('## Step 2: Authentication Configuration')

            const renderedStep3 = renderWalkthroughStep(newWalkthrough, step3)
            expect(renderedStep3).toContain('## Step 3: Testing Your Integration')

            // Step 7: Verify database state
            const finalWalkthrough = await db
                .select()
                .from(walkthroughs)
                .where(eq(walkthroughs.id, walkthroughId))
                .limit(1)

            expect(finalWalkthrough[0].title).toBe('Complete Integration Guide')
            expect(finalWalkthrough[0].status).toBe('draft')

            const allSteps = await db
                .select()
                .from(walkthroughSteps)
                .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
                .orderBy(walkthroughSteps.displayOrder)

            expect(allSteps).toHaveLength(3)
            expect(allSteps[0].title).toBe('API Setup and Configuration') // Updated title
            expect(allSteps[1].title).toBe('Authentication Configuration')
            expect(allSteps[2].title).toBe('Testing Your Integration')
        })
    })

    describe('Step Reordering Integration', () => {
        test('should create steps → reorder them → verify navigation', async () => {
            // Create walkthrough
            const walkthroughId = `wt_${nanoid(8)}`
            const [walkthrough] = await db
                .insert(walkthroughs)
                .values({
                    id: walkthroughId,
                    organizationId: testOrganizationId,
                    title: 'Navigation Test Walkthrough',
                    description: 'Testing step navigation',
                    type: 'course',
                    status: 'published'
                })
                .returning()

            createdWalkthroughs.push(walkthrough.id)

            // Create multiple steps
            const stepIds: string[] = []
            const stepTitles = ['Introduction', 'Setup', 'Configuration', 'Testing', 'Cleanup']

            for (let i = 0; i < stepTitles.length; i++) {
                const stepId = `wts_${nanoid(8)}`
                const [step] = await db
                    .insert(walkthroughSteps)
                    .values({
                        id: stepId,
                        walkthroughId: walkthroughId,
                        title: stepTitles[i],
                        contentFields: {
                            version: 'v1' as const,
                            introductionForAgent: `Introduction for ${stepTitles[i]}`,
                            contextForAgent: `Context for ${stepTitles[i]}`,
                            contentForUser: `User content for ${stepTitles[i]}`,
                            operationsForAgent: `Operations for ${stepTitles[i]}`
                        },
                        displayOrder: i + 1
                    })
                    .returning()

                stepIds.push(step.id)
                createdWalkthroughSteps.push(step.id)
            }

            // Verify initial order
            let steps = await db
                .select()
                .from(walkthroughSteps)
                .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
                .orderBy(walkthroughSteps.displayOrder)

            expect(steps.map((s) => s.title)).toEqual(stepTitles)
            expect(steps.map((s) => s.displayOrder)).toEqual([1, 2, 3, 4, 5])

            // Reorder steps: Testing, Introduction, Configuration, Setup, Cleanup
            const newOrder = [stepIds[3], stepIds[0], stepIds[2], stepIds[1], stepIds[4]]

            // Update display orders based on new order
            for (let i = 0; i < newOrder.length; i++) {
                await db
                    .update(walkthroughSteps)
                    .set({ displayOrder: i + 1 })
                    .where(and(eq(walkthroughSteps.id, newOrder[i]), eq(walkthroughSteps.walkthroughId, walkthroughId)))
            }

            // Verify new order
            steps = await db
                .select()
                .from(walkthroughSteps)
                .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
                .orderBy(walkthroughSteps.displayOrder)

            expect(steps.map((s) => s.title)).toEqual(['Testing', 'Introduction', 'Configuration', 'Setup', 'Cleanup'])
            expect(steps.map((s) => s.displayOrder)).toEqual([1, 2, 3, 4, 5])

            // Test template rendering reflects new order
            const firstStep = steps[0] // Should be 'Testing' now
            const renderedFirst = renderWalkthroughStep(walkthrough, firstStep)
            expect(renderedFirst).toContain('## Step 1: Testing')

            const thirdStep = steps[2] // Should be 'Configuration' now
            const renderedThird = renderWalkthroughStep(walkthrough, thirdStep)
            expect(renderedThird).toContain('## Step 3: Configuration')
        })
    })

    describe('Content Validation Integration', () => {
        test('should handle content validation for different walkthrough types', async () => {
            // Test installer type (requires operationsForAgent)
            const installerWalkthroughId = `wt_${nanoid(8)}`
            const [installerWalkthrough] = await db
                .insert(walkthroughs)
                .values({
                    id: installerWalkthroughId,
                    organizationId: testOrganizationId,
                    title: 'Installer Walkthrough',
                    description: 'Testing installer type validation',
                    type: 'installer',
                    status: 'published'
                })
                .returning()

            createdWalkthroughs.push(installerWalkthrough.id)

            // Create step with all required fields for installer type
            const installerStepId = `wts_${nanoid(8)}`
            const [installerStep] = await db
                .insert(walkthroughSteps)
                .values({
                    id: installerStepId,
                    walkthroughId: installerWalkthroughId,
                    title: 'Installation Step',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Optional intro',
                        contextForAgent: 'Optional context',
                        contentForUser: 'Required: Install the software by running these commands',
                        operationsForAgent: 'Required: Execute installation commands and verify success'
                    },
                    displayOrder: 1
                })
                .returning()

            createdWalkthroughSteps.push(installerStep.id)

            // Verify template includes both required sections
            const renderedInstaller = renderWalkthroughStep(installerWalkthrough, installerStep)
            expect(renderedInstaller).toContain('Required: Install the software')
            expect(renderedInstaller).toContain('Required: Execute installation commands')
            expect(renderedInstaller).toContain('### Operations to Perform')

            // Test troubleshooting type (requires contextForAgent)
            const troubleshootingWalkthroughId = `wt_${nanoid(8)}`
            const [troubleshootingWalkthrough] = await db
                .insert(walkthroughs)
                .values({
                    id: troubleshootingWalkthroughId,
                    organizationId: testOrganizationId,
                    title: 'Troubleshooting Guide',
                    description: 'Testing troubleshooting type validation',
                    type: 'troubleshooting',
                    status: 'published'
                })
                .returning()

            createdWalkthroughs.push(troubleshootingWalkthrough.id)

            const troubleshootingStepId = `wts_${nanoid(8)}`
            const [troubleshootingStep] = await db
                .insert(walkthroughSteps)
                .values({
                    id: troubleshootingStepId,
                    walkthroughId: troubleshootingWalkthroughId,
                    title: 'Debug Connection Issues',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: 'Optional intro',
                        contextForAgent: 'Required: Common connection issues occur due to firewall settings',
                        contentForUser: 'Required: Check your firewall settings and network configuration',
                        operationsForAgent: 'Optional operations'
                    },
                    displayOrder: 1
                })
                .returning()

            createdWalkthroughSteps.push(troubleshootingStep.id)

            // Verify template includes both required sections
            const renderedTroubleshooting = renderWalkthroughStep(troubleshootingWalkthrough, troubleshootingStep)
            expect(renderedTroubleshooting).toContain('Required: Check your firewall settings')
            expect(renderedTroubleshooting).toContain('Required: Common connection issues')
            expect(renderedTroubleshooting).toContain('### Background Information')
        })
    })

    describe('Data Consistency Integration', () => {
        test('should maintain data consistency across operations', async () => {
            // Create walkthrough and step
            const walkthroughId = `wt_${nanoid(8)}`
            const [walkthrough] = await db
                .insert(walkthroughs)
                .values({
                    id: walkthroughId,
                    organizationId: testOrganizationId,
                    title: 'Consistency Test',
                    description: 'Testing data consistency',
                    type: 'course',
                    status: 'draft'
                })
                .returning()

            createdWalkthroughs.push(walkthrough.id)

            const originalStepId = `wts_${nanoid(8)}`
            const [originalStep] = await db
                .insert(walkthroughSteps)
                .values({
                    id: originalStepId,
                    walkthroughId: walkthroughId,
                    title: 'Shared Step',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: 'Original content',
                        operationsForAgent: ''
                    },
                    displayOrder: 1
                })
                .returning()

            createdWalkthroughSteps.push(originalStep.id)

            // Simulate concurrent edits (last save wins)
            const [userAChanges] = await db
                .update(walkthroughSteps)
                .set({
                    title: 'User A Modified Title',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: 'User A modified this content first',
                        operationsForAgent: ''
                    }
                })
                .where(eq(walkthroughSteps.id, originalStepId))
                .returning()

            expect(userAChanges.title).toBe('User A Modified Title')
            expect(userAChanges.contentFields.contentForUser).toBe('User A modified this content first')

            // User B's changes (last save wins)
            const [userBChanges] = await db
                .update(walkthroughSteps)
                .set({
                    title: 'User B Final Title',
                    contentFields: {
                        version: 'v1' as const,
                        introductionForAgent: '',
                        contextForAgent: '',
                        contentForUser: 'User B made the final changes and wins',
                        operationsForAgent: ''
                    }
                })
                .where(eq(walkthroughSteps.id, originalStepId))
                .returning()

            expect(userBChanges.title).toBe('User B Final Title')
            expect(userBChanges.contentFields.contentForUser).toBe('User B made the final changes and wins')

            // Verify final state in database
            const finalStep = await db
                .select()
                .from(walkthroughSteps)
                .where(eq(walkthroughSteps.id, originalStepId))
                .limit(1)

            expect(finalStep[0].title).toBe('User B Final Title')
            expect(finalStep[0].contentFields.contentForUser).toBe('User B made the final changes and wins')

            // Verify template renders with final state
            const renderedFinal = renderWalkthroughStep(walkthrough, finalStep[0])
            expect(renderedFinal).toContain('User B Final Title')
            expect(renderedFinal).toContain('User B made the final changes and wins')
        })
    })
})
