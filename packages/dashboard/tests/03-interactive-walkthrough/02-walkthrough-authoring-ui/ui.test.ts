import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, walkthroughSteps, walkthroughs } from 'database'
import { eq } from 'drizzle-orm'
import type { Browser, Page } from 'puppeteer'
import puppeteer from 'puppeteer'

describe('Walkthrough Authoring UI - Puppeteer Tests', () => {
    let browser: Browser
    let page: Page
    let createdWalkthroughId: string | null = null

    // Track created walkthroughs for cleanup
    const createdWalkthroughIds: string[] = []

    // Global timeout for Puppeteer operations
    const DEFAULT_TIMEOUT = 30000 // 30 seconds
    const NAVIGATION_TIMEOUT = 15000 // 15 seconds
    const ELEMENT_TIMEOUT = 10000 // 10 seconds

    // Helper function for safe element waiting
    const waitForSelectorSafe = async (selector: string, options?: { timeout?: number; visible?: boolean }) => {
        try {
            return await page.waitForSelector(selector, { 
                timeout: options?.timeout || ELEMENT_TIMEOUT,
                visible: options?.visible 
            })
        } catch (error) {
            console.warn(`Selector "${selector}" not found within timeout`)
            return null
        }
    }

    beforeAll(async () => {
        // Launch browser - don't use existing Chrome profile to avoid conflicts
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        })

        page = await browser.newPage()
        
        // Set default timeouts
        page.setDefaultTimeout(DEFAULT_TIMEOUT)
        page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT)
        
        await page.setViewport({ width: 1920, height: 1080 })

        // Navigate to login page and authenticate
        try {
            await page.goto('http://localhost:3000/login-for-claude', { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT })
            // The login-for-claude endpoint should automatically log us in and redirect
            // Wait a bit for the redirect to complete
            await new Promise(resolve => setTimeout(resolve, 2000))
        } catch (error) {
            console.error('Failed to navigate to login page:', error)
            throw error
        }
    }, 60000) // 60 second timeout for beforeAll

    afterAll(async () => {
        // Clean up created walkthroughs (steps will cascade delete automatically)
        if (createdWalkthroughIds.length > 0) {
            console.log(`Cleaning up ${createdWalkthroughIds.length} walkthrough(s) created during tests...`)
            try {
                for (const walkthroughId of createdWalkthroughIds) {
                    await db.delete(walkthroughs).where(eq(walkthroughs.id, walkthroughId))
                }
                console.log('✅ Cleanup completed successfully')
            } catch (error) {
                console.error('❌ Error during cleanup:', error)
            }
        }

        if (page) {
            await page.close().catch(console.error)
        }
        if (browser) {
            await browser.close().catch(console.error)
        }
    })

    describe('Walkthrough Creation Flow', () => {
        test('should create a new walkthrough and navigate to step editor', async () => {
            try {
                // Navigate to walkthroughs page
                await page.goto('http://localhost:3000/dashboard/walkthroughs', { waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT })
                await page.waitForSelector('h1', { timeout: ELEMENT_TIMEOUT })

                // Look for "Create Walkthrough" button
                const createButton = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'))
                    const button = buttons.find(btn => {
                        const hasIcon = btn.querySelector('svg')
                        const hasText = btn.textContent?.includes('Create Walkthrough')
                        return hasIcon && hasText
                    })
                    return button ? true : false
                })
                
                if (!createButton) {
                    console.log('Create button not found with text, trying any button with SVG')
                    const buttons = await page.$$('button')
                    for (const button of buttons) {
                        const hasSvg = await button.evaluate(el => el.querySelector('svg') !== null)
                        if (hasSvg) {
                            await button.click()
                            break
                        }
                    }
                } else {
                    // Click the found button
                    await page.evaluate(() => {
                        const buttons = Array.from(document.querySelectorAll('button'))
                        const button = buttons.find(btn => {
                            const hasIcon = btn.querySelector('svg')
                            const hasText = btn.textContent?.includes('Create Walkthrough')
                            return hasIcon && hasText
                        })
                        if (button) button.click()
                    })
                }

                // Wait for modal dialog to appear with explicit timeout and error handling
                try {
                    await page.waitForSelector('[role="dialog"]', { visible: true, timeout: ELEMENT_TIMEOUT })
                } catch (timeoutError) {
                    console.error('Modal dialog did not appear within timeout')
                    // Take a screenshot for debugging
                    await page.screenshot({ path: 'test-failure-modal-timeout.png' })
                    throw new Error(`Failed to open create walkthrough modal: ${timeoutError.message}`)
                }

                // Fill out the form in the modal
                await page.waitForSelector('input[name="title"]', { timeout: ELEMENT_TIMEOUT })
                await page.type('input[name="title"]', 'Test Walkthrough via Puppeteer')
                
                await page.waitForSelector('textarea[name="description"]', { timeout: ELEMENT_TIMEOUT })
                await page.type('textarea[name="description"]', 'This is a test walkthrough created via Puppeteer automation')

                // Click on the Select to open dropdown for walkthrough type
                await page.click('[role="combobox"]')
                await page.waitForSelector('[role="option"]', { timeout: ELEMENT_TIMEOUT })
                
                // Select 'course' type - just click the first option or look for text
                const options = await page.$$('[role="option"]')
                if (options.length > 0) {
                    // Click on the course option (usually first)
                    await options[0].click()
                }

                // Submit the form
                const submitButton = await page.$('button[type="submit"]')
                expect(submitButton).toBeTruthy()
                await submitButton.click()

                // Wait for navigation to edit page
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT })
                
                // Verify we're on the walkthrough edit page
                const currentUrl = await page.url()
                expect(currentUrl).toMatch(/\/dashboard\/walkthroughs\/[\w-]+\/edit/)
                
                // Extract walkthrough ID for use in other tests
                const match = currentUrl.match(/walkthroughs\/([\w-]+)\/edit/)
                createdWalkthroughId = match ? match[1] : null
                
                // Track the walkthrough ID for cleanup
                if (createdWalkthroughId) {
                    createdWalkthroughIds.push(createdWalkthroughId)
                    console.log(`📝 Tracking walkthrough for cleanup: ${createdWalkthroughId}`)
                }
            } catch (error) {
                console.error('Test failed:', error)
                // Take a screenshot for debugging
                await page.screenshot({ path: 'test-failure-create-walkthrough.png' })
                throw error
            }
        }, 60000) // 60 second timeout for the whole test

        test('should add a new step to walkthrough', async () => {
            try {
                // Ensure we're on a walkthrough edit page
                const currentUrl = await page.url()

                if (!currentUrl.includes('/edit')) {
                    if (createdWalkthroughId) {
                        // Navigate to the created walkthrough
                        await page.goto(`http://localhost:3000/dashboard/walkthroughs/${createdWalkthroughId}/edit`, { timeout: NAVIGATION_TIMEOUT })
                    } else {
                        // Navigate to walkthroughs list and click first one
                        await page.goto('http://localhost:3000/dashboard/walkthroughs', { timeout: NAVIGATION_TIMEOUT })
                        await page.waitForSelector('table', { timeout: ELEMENT_TIMEOUT })
                        
                        // Click on the first Edit button in the table
                        const editButton = await page.$('table a[href*="/edit"]')
                        if (editButton) {
                            await editButton.click()
                            await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: NAVIGATION_TIMEOUT })
                        }
                    }
                }

                // Wait for the editor to load
                await page.waitForSelector('.h-full.flex.flex-col', { timeout: ELEMENT_TIMEOUT })

                // Look for the Add Step button in StepsNavigator
                // It's a button with an SVG icon inside
                const buttons = await page.$$('button')
                let addStepButton = null
                
                for (const button of buttons) {
                    const hasPlusIcon = await button.evaluate(node => {
                        const svg = node.querySelector('svg')
                        return svg && Array.from(svg.classList).some(cls => cls.includes('plus'))
                    })
                    if (hasPlusIcon) {
                        addStepButton = button
                        break
                    }
                }
                
                expect(addStepButton).toBeTruthy()

                // Click add step button
                await addStepButton.click()

                // This triggers a server action to create the step
                // Wait for the new step to appear
                await new Promise(resolve => setTimeout(resolve, 2000))

                // Verify a new step was added by checking for step items
                const stepItems = await page.$$('.group.relative.rounded-lg.border')
                expect(stepItems.length).toBeGreaterThan(0)

                // The first (or newly created) step should be selected
                const selectedStep = await page.$('.group.relative.rounded-lg.border.bg-primary\\/5.border-primary')
                expect(selectedStep).toBeTruthy()
            } catch (error) {
                console.error('Failed to add step:', error)
                await page.screenshot({ path: 'test-failure-add-step.png' })
                throw error
            }
        }, 60000) // 60 second timeout

        test('should edit step content in editor', async () => {
            try {
                // Ensure we're still on the edit page
                const currentUrl = await page.url()
                if (!currentUrl.includes('/edit')) {
                    console.log('Not on edit page, skipping content edit test')
                    return
                }

                // Click on a step if not already selected
                const stepItem = await page.$('.group.relative.rounded-lg.border')
                if (stepItem) {
                    await stepItem.click()
                    await new Promise(resolve => setTimeout(resolve, 500))
                }

                // Wait for ContentEditor to load - it should have textareas
                await page.waitForSelector('textarea', { timeout: ELEMENT_TIMEOUT })

                // Get all textareas in the content editor
                const textareas = await page.$$('textarea')
                expect(textareas.length).toBeGreaterThan(0)

                if (textareas.length > 0) {
                    // Clear and type new content in the first textarea
                    await textareas[0].click({ clickCount: 3 }) // Select all
                    await textareas[0].type('Updated content via Puppeteer automation. This content has been modified to test the editing functionality.')

                    // If there are multiple textareas (for different content fields), edit them too
                    if (textareas.length > 1) {
                        await textareas[1].click({ clickCount: 3 })
                        await textareas[1].type('Additional context or operations for the agent to perform.')
                    }

                    // Content auto-saves to localStorage, wait a moment for the save
                    await new Promise(resolve => setTimeout(resolve, 1000))

                    // Verify content was updated in the textareas (since it saves to localStorage)
                    const firstTextareaContent = await textareas[0].evaluate(el => (el as HTMLTextAreaElement).value)
                    expect(firstTextareaContent).toContain('Updated content via Puppeteer automation')
                    
                    if (textareas.length > 1) {
                        const secondTextareaContent = await textareas[1].evaluate(el => (el as HTMLTextAreaElement).value)
                        expect(secondTextareaContent).toContain('Additional context or operations for the agent to perform')
                    }
                }
            } catch (error) {
                console.error('Failed to edit step content:', error)
                await page.screenshot({ path: 'test-failure-edit-content.png' })
                throw error
            }
        }, 60000) // 60 second timeout
    })

    describe('Walkthrough Navigation and UI', () => {
        test('should navigate to walkthroughs list and verify UI elements', async () => {
            await page.goto('http://localhost:3000/dashboard/walkthroughs', { timeout: NAVIGATION_TIMEOUT })
            await page.waitForSelector('h1', { timeout: ELEMENT_TIMEOUT })

            // Verify page title
            const pageTitle = await page.$eval('h1', el => el.textContent)
            expect(pageTitle).toContain('Walkthroughs')

            // Check for description text
            const description = await page.$('p.text-muted-foreground')
            expect(description).toBeTruthy()

            // Test responsiveness - change viewport size
            await page.setViewport({ width: 768, height: 1024 }) // Mobile size
            await new Promise(resolve => setTimeout(resolve, 500))

            // Verify UI still renders correctly on mobile
            const mobileTitleVisible = await page.$('h1')
            expect(mobileTitleVisible).toBeTruthy()

            // Return to desktop size
            await page.setViewport({ width: 1920, height: 1080 })
        }, 30000) // 30 second timeout

        test('should display walkthrough list correctly', async () => {
            await page.goto('http://localhost:3000/dashboard/walkthroughs', { timeout: NAVIGATION_TIMEOUT })
            await page.waitForSelector('h1', { timeout: ELEMENT_TIMEOUT })

            // Check if we have the empty state or the table
            const hasEmptyState = await page.$('.bg-muted\\/30.border.border-border.rounded-lg.p-12.text-center')
            const hasTable = await page.$('table')

            if (hasEmptyState) {
                // Verify empty state UI
                const noWalkthroughsText = await page.evaluate(() => {
                    const h3s = Array.from(document.querySelectorAll('h3'))
                    return h3s.some(h3 => h3.textContent?.includes('No walkthroughs yet'))
                })
                expect(noWalkthroughsText).toBe(true)
                
                // Should still have Create button in empty state
                const hasCreateButton = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'))
                    return buttons.some(btn => btn.textContent?.includes('Create Walkthrough'))
                })
                expect(hasCreateButton).toBe(true)
            } else if (hasTable) {
                // We have walkthroughs, verify table structure
                expect(hasTable).toBeTruthy()

                // Check for search input
                const searchInput = await page.$('input[placeholder="Search walkthroughs..."]')
                expect(searchInput).toBeTruthy()

                // Check for columns dropdown
                const columnsButton = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'))
                    return buttons.some(btn => btn.textContent?.includes('Columns'))
                })
                expect(columnsButton).toBe(true)

                // Count table rows (excluding header)
                const tableRows = await page.$$('tbody tr')
                console.log(`Found ${tableRows.length} walkthrough(s) in table`)
                
                // If we just created a walkthrough, there should be at least one
                if (createdWalkthroughId) {
                    expect(tableRows.length).toBeGreaterThan(0)
                }

                // Verify we have the Create button
                const hasCreateButton = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'))
                    return buttons.some(btn => btn.textContent?.includes('Create Walkthrough'))
                })
                expect(hasCreateButton).toBe(true)
            }

            // Either way, we should have a page title
            const hasHeaderTitle = await page.$('h1')
            expect(hasHeaderTitle).toBeTruthy()
        }, 30000) // 30 second timeout
    })
})
