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
if (args.length < 1) {
    console.error('Usage: bun scripts/walkthrough-tools/import-bun-quickstart.ts <organization-id>')
    console.error('Example: bun scripts/walkthrough-tools/import-bun-quickstart.ts org_123abc')
    console.error('\nThis script will import the Bun quickstart walkthrough from bun-quickstart-walkthrough.json')
    process.exit(1)
}

const organizationId = args[0]
const inputFile = 'bun-quickstart-walkthrough.json'

// Create database connection
const pool = new Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function importBunQuickstart() {
    try {
        console.log(`🥟 Importing Bun quickstart walkthrough for organization ${organizationId}...`)

        // Read and parse the Bun walkthrough file
        console.log(`📖 Reading ${inputFile}...`)
        const jsonData = await readFile(inputFile, 'utf-8')
        const exportData = JSON.parse(jsonData)

        // Validate export version
        if (exportData.version !== '1.0') {
            console.error(`❌ Unsupported export version: ${exportData.version}`)
            process.exit(1)
        }

        // Verify organization exists
        console.log(`🔍 Verifying organization ${organizationId}...`)
        const [org] = await db.select().from(organization).where(eq(organization.id, organizationId))

        if (!org) {
            console.error(`❌ Organization ${organizationId} not found`)
            console.log('\n💡 Available organizations:')
            const orgs = await db.select({ id: organization.id, name: organization.name }).from(organization)
            orgs.forEach(o => console.log(`   - ${o.id}: ${o.name}`))
            process.exit(1)
        }

        console.log(`✅ Organization found: ${org.name}`)

        // Generate new IDs
        const newWalkthroughId = `wt_${nanoid()}`
        const stepIdMap = new Map<number, string>()

        // Generate new step IDs
        exportData.steps.forEach((_, index) => {
            stepIdMap.set(index, `wts_${nanoid()}`)
        })

        console.log(`🆔 Generated walkthrough ID: ${newWalkthroughId}`)
        console.log(`🆔 Generated ${exportData.steps.length} step IDs`)

        // Create the walkthrough
        console.log(`📝 Creating walkthrough: "${exportData.walkthrough.title}"...`)
        const [newWalkthrough] = await db
            .insert(walkthroughs)
            .values({
                id: newWalkthroughId,
                organizationId: organizationId,
                title: exportData.walkthrough.title,
                description: exportData.walkthrough.description,
                type: exportData.walkthrough.type as 'quickstart',
                status: exportData.walkthrough.status as 'published',
                createdAt: BigInt(Date.now()),
                updatedAt: BigInt(Date.now()),
                estimatedDurationMinutes: exportData.walkthrough.estimatedDurationMinutes,
                tags: exportData.walkthrough.tags || [],
                metadata: {
                    ...(exportData.walkthrough.metadata || {}),
                    importedFrom: 'bun-quickstart-walkthrough.json',
                    importedAt: new Date().toISOString(),
                    source: 'https://bun.com/docs/quickstart'
                }
            })
            .returning()

        console.log(`✅ Created walkthrough: ${newWalkthrough.title}`)

        // Create the steps in REVERSE order to avoid foreign key constraints
        // Since each step references the next step, we insert from last to first
        console.log(`📚 Creating ${exportData.steps.length} walkthrough steps...`)
        let createdSteps = 0

        for (let i = exportData.steps.length - 1; i >= 0; i--) {
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
                metadata: step.metadata || null
            })

            createdSteps++
            console.log(`   ✅ Step ${step.displayOrder + 1}: ${step.title}`)
        }

        console.log(`✅ Created ${createdSteps} steps successfully`)

        // Summary
        console.log('\n🎉 Import Summary:')
        console.log(`   📋 Walkthrough ID: ${newWalkthroughId}`)
        console.log(`   🏢 Organization: ${organizationId} (${org.name})`)
        console.log(`   📝 Title: ${newWalkthrough.title}`)
        console.log(`   📚 Steps: ${exportData.steps.length}`)
        console.log(`   📊 Status: ${newWalkthrough.status}`)
        console.log(`   ⏱️  Duration: ${newWalkthrough.estimatedDurationMinutes} minutes`)
        console.log(`   🏷️  Tags: ${newWalkthrough.tags?.join(', ') || 'none'}`)

        console.log('\n💡 Next steps:')
        console.log(`   1. View in dashboard: /dashboard/walkthroughs`)
        console.log(`   2. Assign to MCP server:`)
        console.log(`      bun scripts/walkthrough-tools/associate-walkthrough.ts ${newWalkthroughId} <mcp-server-id>`)
        console.log(`   3. Test the walkthrough with an MCP client`)

        console.log('\n🥟 Bun quickstart walkthrough imported successfully!')
    } catch (error) {
        console.error('❌ Error importing Bun quickstart walkthrough:', error)
        if (error instanceof Error) {
            console.error('Error details:', error.message)
            if (error.stack) {
                console.error('Stack trace:', error.stack)
            }
        }
        process.exit(1)
    } finally {
        await pool.end()
    }
}

// Show some info about what we're importing
console.log('🥟 Bun Quickstart Walkthrough Import Script')
console.log('==========================================')
console.log('This script will import the Bun quickstart tutorial as an interactive walkthrough.')
console.log('The walkthrough includes 12 steps covering:')
console.log('  • Installation and setup')
console.log('  • Creating your first project')  
console.log('  • HTTP server with Bun.serve()')
console.log('  • Package management')
console.log('  • Testing with built-in test runner')
console.log('  • TypeScript and JSX support')
console.log('  • Environment variables')
console.log('  • Production builds')
console.log('  • And more advanced features')
console.log('')

// Run the import
importBunQuickstart()