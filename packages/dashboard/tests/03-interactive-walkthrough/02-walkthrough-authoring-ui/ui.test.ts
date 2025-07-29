import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { Browser, Page } from 'puppeteer'
import puppeteer from 'puppeteer'

describe('Walkthrough Authoring UI - Puppeteer Tests', () => {
    let browser: Browser
    let page: Page
    let createdWalkthroughId: string | null = null

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
        await page.setViewport({ width: 1920, height: 1080 })

        // Navigate to login page and authenticate
        await page.goto('http://localhost:3000/login-for-claude')
        await page.waitForNavigation({ waitUntil: 'networkidle0' })
    })

    afterAll(async () => {
        if (browser) {
            await browser.close()
        }
    })

    describe('Walkthrough Creation Flow', () => {
        test('should create a new walkthrough and navigate to step editor', async () => {
            // Navigate to walkthroughs page
            await page.goto('http://localhost:3000/dashboard/walkthroughs')
            await page.waitForSelector('h1')

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

            // Wait for modal dialog to appear
            await page.waitForSelector('[role="dialog"]', { visible: true, timeout: 10000 })

            // Fill out the form in the modal
            await page.waitForSelector('input[name="title"]')
            await page.type('input[name="title"]', 'Test Walkthrough via Puppeteer')
            
            await page.waitForSelector('textarea[name="description"]')
            await page.type('textarea[name="description"]', 'This is a test walkthrough created via Puppeteer automation')

            // Click on the Select to open dropdown for walkthrough type
            await page.click('[role="combobox"]')
            await page.waitForSelector('[role="option"]')
            
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
            await page.waitForNavigation({ waitUntil: 'networkidle0' })
            
            // Verify we're on the walkthrough edit page
            const currentUrl = await page.url()
            expect(currentUrl).toMatch(/\/dashboard\/walkthroughs\/[\w-]+\/edit/)
            
            // Extract walkthrough ID for use in other tests
            const match = currentUrl.match(/walkthroughs\/([\w-]+)\/edit/)
            createdWalkthroughId = match ? match[1] : null
        })

        test('should add a new step to walkthrough', async () => {
            // Ensure we're on a walkthrough edit page
            const currentUrl = await page.url()

            if (!currentUrl.includes('/edit')) {
                if (createdWalkthroughId) {
                    // Navigate to the created walkthrough
                    await page.goto(`http://localhost:3000/dashboard/walkthroughs/${createdWalkthroughId}/edit`)
                } else {
                    // Navigate to walkthroughs list and click first one
                    await page.goto('http://localhost:3000/dashboard/walkthroughs')
                    await page.waitForSelector('table')
                    
                    // Click on the first Edit button in the table
                    const editButton = await page.$('table a[href*="/edit"]')
                    if (editButton) {
                        await editButton.click()
                        await page.waitForNavigation({ waitUntil: 'networkidle0' })
                    }
                }
            }

            // Wait for the editor to load
            await page.waitForSelector('.h-full.flex.flex-col')

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
        })

        test('should edit step content in editor', async () => {
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
            await page.waitForSelector('textarea', { timeout: 5000 })

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

                // Content auto-saves, wait for save indicator
                await new Promise(resolve => setTimeout(resolve, 2000))

                // Check for save status indicator (green dot means saved)
                const saveIndicator = await page.$('.w-2.h-2.rounded-full.bg-green-500')
                expect(saveIndicator).toBeTruthy()
                
                // Also check for "Saved" text
                const savedText = await page.evaluate(() => {
                    const spans = Array.from(document.querySelectorAll('span'))
                    return spans.some(span => span.textContent?.includes('Saved'))
                })
                expect(savedText).toBe(true)
            }
        })
    })

    describe('Walkthrough Navigation and UI', () => {
        test('should navigate to walkthroughs list and verify UI elements', async () => {
            await page.goto('http://localhost:3000/dashboard/walkthroughs')
            await page.waitForSelector('h1')

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
        })

        test('should display walkthrough list correctly', async () => {
            await page.goto('http://localhost:3000/dashboard/walkthroughs')
            await page.waitForSelector('h1')

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
        })
    })
})
