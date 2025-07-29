import { describe, expect, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import { renderWalkthroughStep } from '../../../src/lib/template-engine'
import type { Walkthrough, WalkthroughStep } from 'database'

describe('Template Engine', () => {
    // Helper function to create mock walkthrough
    const createMockWalkthrough = (overrides: Partial<Walkthrough> = {}): Walkthrough => ({
        id: `wt_${nanoid(8)}`,
        organizationId: `org_${nanoid(8)}`,
        title: 'Test Walkthrough',
        description: 'A test walkthrough for template rendering',
        type: 'course',
        status: 'published',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        estimatedDurationMinutes: null,
        tags: [],
        metadata: null,
        ...overrides
    })

    // Helper function to create mock walkthrough step
    const createMockStep = (overrides: Partial<WalkthroughStep> = {}): WalkthroughStep => ({
        id: `wts_${nanoid(8)}`,
        walkthroughId: `wt_${nanoid(8)}`,
        title: 'Test Step',
        contentFields: {
            version: 'v1' as const,
            introductionForAgent: 'Introduction for the agent',
            contextForAgent: 'Background context information',
            contentForUser: 'Main content for the user',
            operationsForAgent: 'Operations the agent should perform'
        },
        displayOrder: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides
    })

    describe('renderWalkthroughStep', () => {
        test('should render complete template with all content fields', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep()

            const result = renderWalkthroughStep(walkthrough, step)

            // Check basic structure
            expect(result).toContain('# Walkthrough: Test Walkthrough')
            expect(result).toContain('## Step 1: Test Step')
            expect(result).toContain('<step_content>')
            expect(result).toContain('Main content for the user')
            expect(result).toContain('</step_content>')

            // Check all sections are present
            expect(result).toContain('<step_information>')
            expect(result).toContain('Introduction for the agent')
            expect(result).toContain('</step_information>')
            expect(result).toContain('<background_information_context>')
            expect(result).toContain('Background context information')
            expect(result).toContain('</background_information_context>')
            expect(result).toContain('<operations_to_perform>')
            expect(result).toContain('Operations the agent should perform')
            expect(result).toContain('</operations_to_perform>')

            // Check footer
            expect(result).toContain('*This is step 1 in the "Test Walkthrough" walkthrough')
        })

        test('should handle missing optional content fields', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep({
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: '',
                    contextForAgent: '',
                    contentForUser: 'Only user content is provided',
                    operationsForAgent: ''
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should still have basic structure
            expect(result).toContain('# Walkthrough: Test Walkthrough')
            expect(result).toContain('## Step 1: Test Step')
            expect(result).toContain('<step_content>')
            expect(result).toContain('Only user content is provided')
            expect(result).toContain('</step_content>')

            // Should not have empty sections
            expect(result).not.toContain('<step_information>')
            expect(result).not.toContain('<background_information_context>')
            expect(result).not.toContain('<operations_to_perform>')
        })

        test('should handle partial content fields', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep({
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: 'Only introduction provided',
                    contextForAgent: '',
                    contentForUser: 'User content here',
                    operationsForAgent: 'And some operations'
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should have intro and operations sections
            expect(result).toContain('<step_information>')
            expect(result).toContain('Only introduction provided')
            expect(result).toContain('</step_information>')
            expect(result).toContain('<operations_to_perform>')
            expect(result).toContain('And some operations')
            expect(result).toContain('</operations_to_perform>')

            // Should not have context section
            expect(result).not.toContain('<background_information_context>')

            // Should always have user content
            expect(result).toContain('<step_content>')
            expect(result).toContain('User content here')
            expect(result).toContain('</step_content>')
        })

        test('should handle different step numbers and titles', () => {
            const walkthrough = createMockWalkthrough({
                title: 'Advanced Integration Guide'
            })
            const step = createMockStep({
                title: 'Configure Authentication',
                displayOrder: 5,
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: '',
                    contextForAgent: '',
                    contentForUser: 'Set up your authentication credentials',
                    operationsForAgent: ''
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            expect(result).toContain('# Walkthrough: Advanced Integration Guide')
            expect(result).toContain('## Step 5: Configure Authentication')
            expect(result).toContain('Set up your authentication credentials')
            expect(result).toContain('*This is step 5 in the "Advanced Integration Guide" walkthrough')
        })

        test('should handle special characters and markdown in content', () => {
            const walkthrough = createMockWalkthrough({
                title: 'Special Characters & Markdown Test'
            })
            const step = createMockStep({
                title: 'Step with "Quotes" & Symbols',
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: '**Bold** and *italic* text with `code`',
                    contextForAgent: 'Text with <tags> and & symbols',
                    contentForUser: '# Markdown Header\n\n- List item 1\n- List item 2\n\n```javascript\nconst code = "example";\n```',
                    operationsForAgent: 'Run `npm install` and check @mentions'
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should preserve all special characters and markdown
            expect(result).toContain('Special Characters & Markdown Test')
            expect(result).toContain('Step with "Quotes" & Symbols')
            expect(result).toContain('**Bold** and *italic* text with `code`')
            expect(result).toContain('Text with <tags> and & symbols')
            expect(result).toContain('# Markdown Header')
            expect(result).toContain('```javascript')
            expect(result).toContain('const code = "example";')
            expect(result).toContain('Run `npm install` and check @mentions')
        })

        test('should handle null or undefined content fields gracefully', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep({
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: null as any,
                    contextForAgent: undefined as any,
                    contentForUser: 'Valid user content',
                    operationsForAgent: ''
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should handle null/undefined gracefully
            expect(result).toContain('Valid user content')
            expect(result).not.toContain('<step_information>')
            expect(result).not.toContain('<background_information_context>')
            expect(result).not.toContain('null')
            expect(result).not.toContain('undefined')
        })

        test('should handle empty string content fields', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep({
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: '',
                    contextForAgent: '   ', // Whitespace only
                    contentForUser: 'User content only',
                    operationsForAgent: '\n\n' // Newlines only
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should not show sections with empty or whitespace-only content
            expect(result).not.toContain('<step_information>')
            expect(result).not.toContain('<background_information_context>')
            expect(result).not.toContain('<operations_to_perform>')
            expect(result).toContain('User content only')
        })

        test('should handle very long content gracefully', () => {
            const longContent = 'Lorem ipsum '.repeat(100) // Very long content
            const walkthrough = createMockWalkthrough()
            const step = createMockStep({
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: longContent,
                    contextForAgent: longContent,
                    contentForUser: longContent,
                    operationsForAgent: longContent
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should handle long content without issues
            expect(result).toContain('<step_information>')
            expect(result).toContain('<background_information_context>')
            expect(result).toContain('<operations_to_perform>')
            expect(result).toContain(longContent)
            expect(result.length).toBeGreaterThan(longContent.length * 4) // Should contain all content plus template structure
        })

        test('should preserve line breaks and formatting', () => {
            const walkthrough = createMockWalkthrough()
            const multilineContent = `First line
Second line

Third line with empty line above
- Bullet point
- Another bullet point

Final paragraph`

            const step = createMockStep({
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: multilineContent,
                    contextForAgent: '',
                    contentForUser: multilineContent,
                    operationsForAgent: ''
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should preserve line breaks and formatting
            expect(result).toContain('First line\nSecond line')
            expect(result).toContain('Third line with empty line above')
            expect(result).toContain('- Bullet point')
            expect(result).toContain('Final paragraph')
        })

        test('should handle missing contentFields property', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep({
                contentFields: null as any
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should handle gracefully with empty content
            expect(result).toContain('# Walkthrough: Test Walkthrough')
            expect(result).toContain('## Step 1: Test Step')
            expect(result).not.toContain('<step_content>')
            expect(result).not.toContain('<step_information>')
            expect(result).not.toContain('<background_information_context>')
            expect(result).not.toContain('<operations_to_perform>')
        })

        test('should generate consistent output for same input', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep()

            const result1 = renderWalkthroughStep(walkthrough, step)
            const result2 = renderWalkthroughStep(walkthrough, step)

            expect(result1).toBe(result2)
        })

        test('should handle unicode and emoji characters', () => {
            const walkthrough = createMockWalkthrough({
                title: 'Unicode Test 🚀 中文 العربية'
            })
            const step = createMockStep({
                title: 'Step with 🎯 Emojis',
                contentFields: {
                    version: 'v1' as const,
                    introductionForAgent: 'Introduction with 📝 emojis and 中文 characters',
                    contextForAgent: 'Context with العربية text',
                    contentForUser: 'User content: 🔧 Tools and ⚡ Actions',
                    operationsForAgent: 'Operations: ✅ Success and ❌ Error'
                }
            })

            const result = renderWalkthroughStep(walkthrough, step)

            // Should preserve all unicode characters
            expect(result).toContain('Unicode Test 🚀 中文 العربية')
            expect(result).toContain('Step with 🎯 Emojis')
            expect(result).toContain('📝 emojis and 中文 characters')
            expect(result).toContain('العربية text')
            expect(result).toContain('🔧 Tools and ⚡ Actions')
            expect(result).toContain('✅ Success and ❌ Error')
        })
    })

    describe('Template Structure', () => {
        test('should have consistent section ordering', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep()

            const result = renderWalkthroughStep(walkthrough, step)
            const lines = result.split('\n')

            // Find indices of key sections
            const titleIndex = lines.findIndex(line => line.includes('# Walkthrough:'))
            const stepIndex = lines.findIndex(line => line.includes('## Step'))
            const stepInfoIndex = lines.findIndex(line => line.includes('<step_information>'))
            const backgroundIndex = lines.findIndex(line => line.includes('<background_information_context>'))
            const operationsIndex = lines.findIndex(line => line.includes('<operations_to_perform>'))
            const userContentIndex = lines.findIndex(line => line.includes('<step_content>'))
            const footerIndex = lines.findIndex(line => line.includes('*This is step'))

            // Verify correct ordering
            expect(titleIndex).toBeLessThan(stepIndex)
            expect(stepIndex).toBeLessThan(stepInfoIndex)
            expect(stepInfoIndex).toBeLessThan(backgroundIndex)
            expect(backgroundIndex).toBeLessThan(operationsIndex)
            expect(operationsIndex).toBeLessThan(userContentIndex)
            expect(userContentIndex).toBeLessThan(footerIndex)
        })

        test('should have proper markdown structure', () => {
            const walkthrough = createMockWalkthrough()
            const step = createMockStep()

            const result = renderWalkthroughStep(walkthrough, step)

            // Should have proper markdown headers
            expect(result).toMatch(/^# Walkthrough: .+$/m) // H1 title
            expect(result).toMatch(/^## Step \d+: .+$/m) // H2 step

            // Should have XML tags for content sections
            expect(result).toContain('<step_information>')
            expect(result).toContain('</step_information>')
            expect(result).toContain('<background_information_context>')
            expect(result).toContain('</background_information_context>')
            expect(result).toContain('<operations_to_perform>')
            expect(result).toContain('</operations_to_perform>')
            expect(result).toContain('<step_content>')
            expect(result).toContain('</step_content>')

            // Should have separator
            expect(result).toContain('---')
        })
    })
})