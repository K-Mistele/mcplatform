import { nanoid } from 'common/nanoid'
import { and, eq } from 'drizzle-orm'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from '../index'
import { type WalkthroughStepContentFieldVersion1, walkthroughSteps, walkthroughs } from '../src/schema'

// Define the structure of the JSON data
interface WalkthroughStepData {
    title: string
    displayOrder: number
    contentFields: {
        version: 'v1'
        introductionForAgent: string
        contextForAgent: string
        contentForUser: string
        operationsForAgent: string
    }
}

async function main() {
    // Read the JSON file
    const jsonPath = join(
        __dirname,
        '../../../specifications/03-interactive-walkthrough/research/nextjs-installation-walkthrough.json'
    )
    const jsonContent = await readFile(jsonPath, 'utf-8')
    const stepsData: WalkthroughStepData[] = JSON.parse(jsonContent)

    try {
        // Transaction to ensure atomicity
        await db.transaction(async (tx) => {
            // Use the existing organization ID from the database
            const organizationId = '1HBRrQgQ2oBucPpcNY8K08T0QC2QTW5F'

            // Check if walkthrough already exists
            const existingWalkthrough = await tx
                .select()
                .from(walkthroughs)
                .where(
                    and(
                        eq(walkthroughs.organizationId, organizationId),
                        eq(walkthroughs.title, 'Next.js Getting Started')
                    )
                )
                .limit(1)

            let walkthroughId: string

            if (existingWalkthrough.length > 0) {
                // Update existing walkthrough
                walkthroughId = existingWalkthrough[0]?.id!
                await tx
                    .update(walkthroughs)
                    .set({
                        description: 'A comprehensive guide to setting up a new Next.js application from scratch',
                        type: 'quickstart',
                        status: 'published',
                        estimatedDurationMinutes: 30,
                        tags: ['nextjs', 'react', 'setup', 'installation'],
                        updatedAt: Date.now()
                    })
                    .where(eq(walkthroughs.id, walkthroughId))

                // Delete existing steps to replace them
                await tx.delete(walkthroughSteps).where(eq(walkthroughSteps.walkthroughId, walkthroughId))
            } else {
                // Create new walkthrough
                const newWalkthrough = await tx
                    .insert(walkthroughs)
                    .values({
                        id: `wt_${nanoid(8)}`,
                        organizationId,
                        title: 'Next.js Getting Started',
                        description: 'A comprehensive guide to setting up a new Next.js application from scratch',
                        type: 'quickstart',
                        status: 'published',
                        estimatedDurationMinutes: 30,
                        tags: ['nextjs', 'react', 'setup', 'installation'],
                        metadata: {
                            source: 'nextjs-installation-walkthrough.json',
                            version: '1.0.0'
                        }
                    })
                    .returning({ id: walkthroughs.id })

                walkthroughId = newWalkthrough[0]?.id!
            }

            // Insert steps
            const stepIds: string[] = []
            for (const stepData of stepsData) {
                const stepId = `wts_${nanoid(8)}`
                stepIds.push(stepId)

                await tx.insert(walkthroughSteps).values({
                    id: stepId,
                    walkthroughId,
                    title: stepData.title,
                    contentFields: {
                        version: 'v1',
                        introductionForAgent: stepData.contentFields.introductionForAgent,
                        contextForAgent: stepData.contentFields.contextForAgent,
                        contentForUser: stepData.contentFields.contentForUser,
                        operationsForAgent: stepData.contentFields.operationsForAgent
                    } satisfies WalkthroughStepContentFieldVersion1,
                    displayOrder: stepData.displayOrder,
                    metadata: {
                        imported: true,
                        importedAt: new Date().toISOString()
                    }
                })
            }

            // Update steps with nextStepId references
            for (let i = 0; i < stepIds.length - 1; i++) {
                await tx
                    .update(walkthroughSteps)
                    .set({ nextStepId: stepIds[i + 1] })
                    .where(eq(walkthroughSteps.id, stepIds[i]!))
            }

            console.log(`✅ Successfully imported Next.js walkthrough with ${stepsData.length} steps`)
            console.log(`Walkthrough ID: ${walkthroughId}`)
            console.log(`Step IDs: ${stepIds.join(', ')}`)
        })
    } catch (error) {
        console.error('❌ Error importing walkthrough:', error)
        throw error
    }
}

// Run the script
main().catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
})
