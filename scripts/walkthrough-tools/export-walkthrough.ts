#!/usr/bin/env bun

import { mcpServerWalkthroughs, walkthroughSteps, walkthroughs } from 'database/src/schema'
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { writeFile } from 'fs/promises'
import pg from 'pg'
import { Resource } from 'sst'

const { Pool } = pg

// Get database URL from SST resources
const DATABASE_URL = `postgresql://${Resource.Postgres.username}:${Resource.Postgres.password}@${Resource.Postgres.host}:${Resource.Postgres.port}/${Resource.Postgres.database}`

// Parse command line arguments
const args = process.argv.slice(2)
if (args.length === 0) {
    console.error('Usage: bun scripts/walkthrough-tools/export-walkthrough.ts <walkthrough-id>')
    console.error('Example: bun scripts/walkthrough-tools/export-walkthrough.ts wt_123abc')
    process.exit(1)
}

const walkthroughId = args[0]
const outputFile = args[1] || `walkthrough-${walkthroughId}-export.json`

// Create database connection
const pool = new Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function exportWalkthrough() {
    try {
        console.log(`Exporting walkthrough ${walkthroughId}...`)

        // Get the walkthrough
        const [walkthrough] = await db.select().from(walkthroughs).where(eq(walkthroughs.id, walkthroughId))

        if (!walkthrough) {
            console.error(`Walkthrough ${walkthroughId} not found`)
            process.exit(1)
        }

        // Get all steps for this walkthrough
        const steps = await db
            .select()
            .from(walkthroughSteps)
            .where(eq(walkthroughSteps.walkthroughId, walkthroughId))
            .orderBy(walkthroughSteps.displayOrder)

        // Get MCP server associations
        const serverAssociations = await db
            .select()
            .from(mcpServerWalkthroughs)
            .where(eq(mcpServerWalkthroughs.walkthroughId, walkthroughId))

        // Create export object
        const exportData = {
            version: '1.0',
            exportedAt: new Date().toISOString(),
            walkthrough: {
                ...walkthrough,
                // Remove organization-specific data
                organizationId: undefined,
                id: undefined
            },
            steps: steps.map((step) => ({
                ...step,
                // Remove IDs that will be regenerated on import
                id: undefined,
                walkthroughId: undefined,
                // Keep relative references
                nextStepReference: step.nextStepId ? steps.findIndex((s) => s.id === step.nextStepId) : null,
                nextStepId: undefined
            })),
            metadata: {
                originalId: walkthrough.id,
                originalOrganizationId: walkthrough.organizationId,
                stepCount: steps.length,
                serverAssociationCount: serverAssociations.length
            }
        }

        // Write to file
        await writeFile(outputFile, JSON.stringify(exportData, null, 2))

        console.log(`✅ Walkthrough exported successfully to ${outputFile}`)
        console.log(`   - Title: ${walkthrough.title}`)
        console.log(`   - Steps: ${steps.length}`)
        console.log(`   - Server associations: ${serverAssociations.length}`)
    } catch (error) {
        console.error('Error exporting walkthrough:', error)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

// Run the export
exportWalkthrough()
