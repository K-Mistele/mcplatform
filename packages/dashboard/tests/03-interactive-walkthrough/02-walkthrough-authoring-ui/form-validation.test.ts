import { describe, expect, test } from 'bun:test'
import { z } from 'zod'

// Define the actual schemas used by the forms
const createWalkthroughFormSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
    isPublished: z.boolean().default(false)
})

const stepContentFormSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
    contentFields: z.object({
        introductionForAgent: z.string().optional(),
        contextForAgent: z.string().optional(),
        contentForUser: z.string().min(1, 'Content for user is required'),
        operationsForAgent: z.string().optional()
    })
})

describe('React Hook Form Validation Tests', () => {
    describe('Create Walkthrough Form Validation', () => {
        test('should pass with valid data', () => {
            const validData = {
                title: 'My Walkthrough',
                description: 'A helpful walkthrough',
                type: 'course' as const,
                isPublished: false
            }

            const result = createWalkthroughFormSchema.safeParse(validData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.title).toBe('My Walkthrough')
                expect(result.data.description).toBe('A helpful walkthrough')
                expect(result.data.type).toBe('course')
                expect(result.data.isPublished).toBe(false)
            }
        })

        test('should pass with minimal required fields', () => {
            const minimalData = {
                title: 'Minimal Walkthrough',
                type: 'installer' as const
            }

            const result = createWalkthroughFormSchema.safeParse(minimalData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.title).toBe('Minimal Walkthrough')
                expect(result.data.type).toBe('installer')
                expect(result.data.isPublished).toBe(false) // default value
                expect(result.data.description).toBeUndefined()
            }
        })

        test('should fail with empty title', () => {
            const invalidData = {
                title: '',
                type: 'course' as const
            }

            const result = createWalkthroughFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Title is required')
                expect(result.error.issues[0].path).toEqual(['title'])
            }
        })

        test('should fail with title over 100 characters', () => {
            const invalidData = {
                title: 'A'.repeat(101),
                type: 'course' as const
            }

            const result = createWalkthroughFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Title must be 100 characters or less')
                expect(result.error.issues[0].path).toEqual(['title'])
            }
        })

        test('should fail with description over 500 characters', () => {
            const invalidData = {
                title: 'Valid Title',
                description: 'A'.repeat(501),
                type: 'course' as const
            }

            const result = createWalkthroughFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Description must be 500 characters or less')
                expect(result.error.issues[0].path).toEqual(['description'])
            }
        })

        test('should fail with invalid type', () => {
            const invalidData = {
                title: 'Valid Title',
                type: 'invalid-type'
            }

            const result = createWalkthroughFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].path).toEqual(['type'])
            }
        })

        test('should handle all valid types', () => {
            const validTypes = ['course', 'installer', 'troubleshooting', 'integration', 'quickstart'] as const

            validTypes.forEach(type => {
                const data = {
                    title: 'Test Walkthrough',
                    type
                }

                const result = createWalkthroughFormSchema.safeParse(data)
                expect(result.success).toBe(true)
                if (result.success) {
                    expect(result.data.type).toBe(type)
                }
            })
        })

        test('should handle boolean isPublished values', () => {
            const dataTrue = {
                title: 'Published Walkthrough',
                type: 'course' as const,
                isPublished: true
            }

            const resultTrue = createWalkthroughFormSchema.safeParse(dataTrue)
            expect(resultTrue.success).toBe(true)
            if (resultTrue.success) {
                expect(resultTrue.data.isPublished).toBe(true)
            }

            const dataFalse = {
                title: 'Draft Walkthrough',
                type: 'course' as const,
                isPublished: false
            }

            const resultFalse = createWalkthroughFormSchema.safeParse(dataFalse)
            expect(resultFalse.success).toBe(true)
            if (resultFalse.success) {
                expect(resultFalse.data.isPublished).toBe(false)
            }
        })
    })

    describe('Step Content Form Validation', () => {
        test('should pass with all fields filled', () => {
            const validData = {
                title: 'Step 1: Getting Started',
                contentFields: {
                    introductionForAgent: 'Guide the user through initial setup',
                    contextForAgent: 'User is new to the platform',
                    contentForUser: 'Welcome! Let\'s get you started with the platform.',
                    operationsForAgent: 'Check user environment and prerequisites'
                }
            }

            const result = stepContentFormSchema.safeParse(validData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.title).toBe('Step 1: Getting Started')
                expect(result.data.contentFields.contentForUser).toBe('Welcome! Let\'s get you started with the platform.')
            }
        })

        test('should pass with only required fields', () => {
            const minimalData = {
                title: 'Minimal Step',
                contentFields: {
                    contentForUser: 'This is the required user content'
                }
            }

            const result = stepContentFormSchema.safeParse(minimalData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.title).toBe('Minimal Step')
                expect(result.data.contentFields.contentForUser).toBe('This is the required user content')
                expect(result.data.contentFields.introductionForAgent).toBeUndefined()
                expect(result.data.contentFields.contextForAgent).toBeUndefined()
                expect(result.data.contentFields.operationsForAgent).toBeUndefined()
            }
        })

        test('should fail with empty step title', () => {
            const invalidData = {
                title: '',
                contentFields: {
                    contentForUser: 'Some content'
                }
            }

            const result = stepContentFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Title is required')
                expect(result.error.issues[0].path).toEqual(['title'])
            }
        })

        test('should fail with step title over 200 characters', () => {
            const invalidData = {
                title: 'A'.repeat(201),
                contentFields: {
                    contentForUser: 'Some content'
                }
            }

            const result = stepContentFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Title must be 200 characters or less')
                expect(result.error.issues[0].path).toEqual(['title'])
            }
        })

        test('should fail with empty contentForUser', () => {
            const invalidData = {
                title: 'Valid Step Title',
                contentFields: {
                    contentForUser: ''
                }
            }

            const result = stepContentFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].message).toBe('Content for user is required')
                expect(result.error.issues[0].path).toEqual(['contentFields', 'contentForUser'])
            }
        })

        test('should fail without contentFields', () => {
            const invalidData = {
                title: 'Valid Step Title'
            }

            const result = stepContentFormSchema.safeParse(invalidData)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues[0].path).toEqual(['contentFields'])
            }
        })

        test('should handle empty optional fields', () => {
            const dataWithEmpty = {
                title: 'Step with Empty Fields',
                contentFields: {
                    introductionForAgent: '',
                    contextForAgent: '',
                    contentForUser: 'Required content',
                    operationsForAgent: ''
                }
            }

            const result = stepContentFormSchema.safeParse(dataWithEmpty)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.contentFields.introductionForAgent).toBe('')
                expect(result.data.contentFields.contextForAgent).toBe('')
                expect(result.data.contentFields.operationsForAgent).toBe('')
            }
        })

        test('should handle very long content in optional fields', () => {
            const longContent = 'Lorem ipsum '.repeat(1000) // Very long content

            const dataWithLongContent = {
                title: 'Step with Long Content',
                contentFields: {
                    introductionForAgent: longContent,
                    contextForAgent: longContent,
                    contentForUser: 'Required content',
                    operationsForAgent: longContent
                }
            }

            const result = stepContentFormSchema.safeParse(dataWithLongContent)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.contentFields.introductionForAgent).toBe(longContent)
                expect(result.data.contentFields.contextForAgent).toBe(longContent)
                expect(result.data.contentFields.operationsForAgent).toBe(longContent)
            }
        })
    })

    describe('Field-specific Validation Requirements', () => {
        test('should validate different walkthrough types with specific requirements', () => {
            // For installer type, operationsForAgent might be required in the UI
            // but schema validation is consistent
            const installerData = {
                title: 'Installer Walkthrough',
                type: 'installer' as const,
                isPublished: false
            }

            const result = createWalkthroughFormSchema.safeParse(installerData)
            expect(result.success).toBe(true)
        })

        test('should handle whitespace in titles', () => {
            const whitespaceData = {
                title: '   Walkthrough with Spaces   ',
                type: 'course' as const
            }

            const result = createWalkthroughFormSchema.safeParse(whitespaceData)
            expect(result.success).toBe(true)
            if (result.success) {
                // Note: actual form might trim whitespace
                expect(result.data.title).toBe('   Walkthrough with Spaces   ')
            }
        })

        test('should handle special characters in content', () => {
            const specialCharsData = {
                title: 'Step with Special Characters',
                contentFields: {
                    contentForUser: 'Content with <html>, "quotes", \'apostrophes\', & ampersands'
                }
            }

            const result = stepContentFormSchema.safeParse(specialCharsData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.contentFields.contentForUser).toContain('<html>')
                expect(result.data.contentFields.contentForUser).toContain('"quotes"')
                expect(result.data.contentFields.contentForUser).toContain('\'apostrophes\'')
                expect(result.data.contentFields.contentForUser).toContain('& ampersands')
            }
        })

        test('should handle unicode and emoji in content', () => {
            const unicodeData = {
                title: 'Unicode Step 🚀',
                contentFields: {
                    introductionForAgent: 'Guide with 中文 and العربية',
                    contentForUser: 'Welcome! 👋 Let\'s get started 🎯'
                }
            }

            const result = stepContentFormSchema.safeParse(unicodeData)
            expect(result.success).toBe(true)
            if (result.success) {
                expect(result.data.title).toContain('🚀')
                expect(result.data.contentFields.introductionForAgent).toContain('中文')
                expect(result.data.contentFields.contentForUser).toContain('👋')
            }
        })
    })

    describe('Edge Cases and Error Scenarios', () => {
        test('should handle missing required fields', () => {
            const missingTitle = {
                type: 'course' as const
            }

            const result1 = createWalkthroughFormSchema.safeParse(missingTitle)
            expect(result1.success).toBe(false)

            const missingType = {
                title: 'Missing Type'
            }

            const result2 = createWalkthroughFormSchema.safeParse(missingType)
            expect(result2.success).toBe(false)
        })

        test('should handle null and undefined values', () => {
            const nullData = {
                title: 'Test',
                description: null,
                type: 'course' as const
            }

            const result = createWalkthroughFormSchema.safeParse(nullData)
            // Zod treats null as invalid for optional string
            expect(result.success).toBe(false)
        })

        test('should validate multiple errors', () => {
            const multipleErrors = {
                title: '',
                description: 'A'.repeat(501),
                type: 'invalid' as any
            }

            const result = createWalkthroughFormSchema.safeParse(multipleErrors)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.issues.length).toBeGreaterThan(1)
            }
        })
    })
})