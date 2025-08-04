#!/usr/bin/env bun

import { walkthroughSteps, walkthroughs } from 'database/src/schema'
import { organization } from 'database/src/auth-schema'
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { readFile } from 'fs/promises'
import { nanoid } from 'nanoid'
import pg from 'pg'
import { Resource } from 'sst'

const { Pool } = pg

// Get database URL from SST resources
const DATABASE_URL = `postgresql://${Resource.Postgres.username}:${Resource.Postgres.password}@${Resource.Postgres.host}:${Resource.Postgres.port}/${Resource.Postgres.database}`

// Parse command line arguments
const args = process.argv.slice(2)
if (args.length < 2) {
    console.error('Usage: bun scripts/walkthrough-tools/import-walkthrough.ts <json-file> <organization-id>')
    console.error('Example: bun scripts/walkthrough-tools/import-walkthrough.ts walkthrough-export.json org_123abc')
    process.exit(1)
}

const inputFile = args[0]
const organizationId = args[1]

// Create database connection
const pool = new Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function importWalkthrough() {
    try {
        console.log(`Importing walkthrough from ${inputFile}...`)

        // Read and parse the export file
        const jsonData = await readFile(inputFile, 'utf-8')
        const exportData = JSON.parse(jsonData)

        // Validate export version
        if (exportData.version !== '1.0') {
            console.error(`Unsupported export version: ${exportData.version}`)
            process.exit(1)
        }

        // Verify organization exists
        const [org] = await db.select().from(organization).where(eq(organization.id, organizationId))

        if (!org) {
            console.error(`Organization ${organizationId} not found`)
            process.exit(1)
        }

        // Generate new IDs
        const newWalkthroughId = `wt_${nanoid()}`
        const stepIdMap = new Map<number, string>()

        // Generate new step IDs
        exportData.steps.forEach((_, index) => {
            stepIdMap.set(index, `wts_${nanoid()}`)
        })

        // Create the walkthrough
        const [newWalkthrough] = await db
            .insert(walkthroughs)
            .values({
                id: newWalkthroughId,
                organizationId: organizationId,
                title: exportData.walkthrough.title,
                description: exportData.walkthrough.description,
                type: exportData.walkthrough.type,
                status: exportData.walkthrough.status || 'draft',
                createdAt: BigInt(Date.now()),
                updatedAt: BigInt(Date.now()),
                estimatedDurationMinutes: exportData.walkthrough.estimatedDurationMinutes,
                tags: exportData.walkthrough.tags || [],
                metadata: {
                    ...(exportData.walkthrough.metadata || {}),
                    importedFrom: exportData.metadata.originalId,
                    importedAt: new Date().toISOString()
                }
            })
            .returning()

        console.log(`✅ Created walkthrough: ${newWalkthrough.title}`)

        // Create the steps
        for (let i = 0; i < exportData.steps.length; i++) {
            const step = exportData.steps[i]
            const stepId = stepIdMap.get(i)!

            // Resolve next step reference
            let nextStepId = null
            if (step.nextStepReference !== null && step.nextStepReference >= 0) {
                nextStepId = stepIdMap.get(step.nextStepReference) || null
            }

            await db.insert(walkthroughSteps).values({
                id: stepId,
                walkthroughId: newWalkthroughId,
                title: step.title,
                contentFields: step.contentFields,
                displayOrder: step.displayOrder,
                nextStepId: nextStepId,
                createdAt: BigInt(Date.now()),
                updatedAt: BigInt(Date.now()),
                metadata: step.metadata
            })
        }

        console.log(`✅ Created ${exportData.steps.length} steps`)

        // Summary
        console.log('\n📊 Import Summary:')
        console.log(`   - Walkthrough ID: ${newWalkthroughId}`)
        console.log(`   - Organization: ${organizationId}`)
        console.log(`   - Title: ${newWalkthrough.title}`)
        console.log(`   - Steps: ${exportData.steps.length}`)
        console.log(`   - Status: ${newWalkthrough.status}`)

        console.log('\n💡 To associate this walkthrough with an MCP server, use the dashboard or run:')
        console.log(`   bun scripts/walkthrough-tools/associate-walkthrough.ts ${newWalkthroughId} <mcp-server-id>`)
    } catch (error) {
        console.error('Error importing walkthrough:', error)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

// Run the import
importWalkthrough()
