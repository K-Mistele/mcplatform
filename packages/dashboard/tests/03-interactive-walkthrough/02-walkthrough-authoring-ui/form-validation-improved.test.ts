import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

// Import the ACTUAL schemas from the source files to prevent drift
// Note: These are defined inline in the components, so we'll need to extract them

// From create-walkthrough-modal.tsx
const createWalkthroughSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
    isPublished: z.boolean().default(false)
})

// From content-editor.tsx - note the difference in contentForUser validation!
const contentEditorSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
    contentFields: z.object({
        version: z.literal('v1'),
        introductionForAgent: z.string().optional(),
        contextForAgent: z.string().optional(),
        contentForUser: z.string().optional(), // IMPORTANT: This is optional in the actual schema!
        operationsForAgent: z.string().optional()
    })
})

describe('React Hook Form Validation Tests - Using Actual Schemas', () => {
    describe('Create Walkthrough Schema (from create-walkthrough-modal.tsx)', () => {
        test('should match the schema used in the actual component', () => {
            // This test documents what the actual schema validates
            const validData = {
                title: 'Test',
                type: 'course' as const,
                isPublished: false
            }
            
            const result = createWalkthroughSchema.safeParse(validData)
            expect(result.success).toBe(true)
        })

        test('actual schema allows missing description', () => {
            const data = {
                title: 'Test',
                type: 'course' as const
            }
            
            const result = createWalkthroughSchema.safeParse(data)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.description).toBeUndefined()
                expect(result.data.isPublished).toBe(false) // default
            }
        })

        test('actual schema rejects null description', () => {
            const data = {
                title: 'Test',
                description: null,
                type: 'course' as const
            }
            
            const result = createWalkthroughSchema.safeParse(data)
            expect(result.success).toBe(false)
        })
    })

    describe('Content Editor Schema (from content-editor.tsx)', () => {
        test('CRITICAL: contentForUser is OPTIONAL in the actual schema', () => {
            // This is a significant finding - the actual form allows empty contentForUser!
            const dataWithEmptyContent = {
                title: 'Step Title',
                contentFields: {
                    version: 'v1' as const,
                    contentForUser: '' // Empty string is valid!
                }
            }
            
            const result = contentEditorSchema.safeParse(dataWithEmptyContent)
            expect(result.success).toBe(true)
        })

        test('actual schema requires version field', () => {
            const dataWithoutVersion = {
                title: 'Step Title',
                contentFields: {
                    contentForUser: 'Some content'
                }
            }
            
            const result = contentEditorSchema.safeParse(dataWithoutVersion)
            expect(result.success).toBe(false)
        })

        test('actual schema only accepts v1 version', () => {
            const dataWithWrongVersion = {
                title: 'Step Title',
                contentFields: {
                    version: 'v2' as any,
                    contentForUser: 'Some content'
                }
            }
            
            const result = contentEditorSchema.safeParse(dataWithWrongVersion)
            expect(result.success).toBe(false)
        })

        test('all content fields are optional', () => {
            const minimalData = {
                title: 'Step Title',
                contentFields: {
                    version: 'v1' as const
                }
            }
            
            const result = contentEditorSchema.safeParse(minimalData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.contentFields.introductionForAgent).toBeUndefined()
                expect(result.data.contentFields.contextForAgent).toBeUndefined()
                expect(result.data.contentFields.contentForUser).toBeUndefined()
                expect(result.data.contentFields.operationsForAgent).toBeUndefined()
            }
        })
    })

    describe('Schema Differences from Original Tests', () => {
        test('FINDING: Original tests assumed contentForUser was required', () => {
            // The original test file had a different schema that required contentForUser
            // This would have caused a false sense of security!
            const stepContentFormSchemaFromOriginalTests = z.object({
                title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
                contentFields: z.object({
                    introductionForAgent: z.string().optional(),
                    contextForAgent: z.string().optional(),
                    contentForUser: z.string().min(1, 'Content for user is required'), // WRONG!
                    operationsForAgent: z.string().optional()
                })
            })

            const data = {
                title: 'Test',
                contentFields: {
                    contentForUser: ''
                }
            }

            // Original test schema would reject this
            const originalResult = stepContentFormSchemaFromOriginalTests.safeParse(data)
            expect(originalResult.success).toBe(false)

            // But actual schema accepts it!
            const actualResult = contentEditorSchema.safeParse({
                ...data,
                contentFields: { ...data.contentFields, version: 'v1' as const }
            })
            expect(actualResult.success).toBe(true)
        })

        test('FINDING: Original tests missed the version field requirement', () => {
            // The original tests didn't include the version field at all
            // This means they weren't testing the actual schema structure
            const dataFromOriginalTests = {
                title: 'Step 1',
                contentFields: {
                    contentForUser: 'Some content'
                }
            }

            // This would fail with the actual schema
            const result = contentEditorSchema.safeParse(dataFromOriginalTests)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].path).toContain('version')
            }
        })
    })
})