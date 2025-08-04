#!/usr/bin/env bun

import { mcpServerWalkthroughs, organizations, walkthroughSteps, walkthroughs } from 'database/src/schema'
import 'dotenv/config'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { Resource } from 'sst'

const { Pool } = pg

// Get database URL from SST resources
const DATABASE_URL = `postgresql://${Resource.Postgres.username}:${Resource.Postgres.password}@${Resource.Postgres.host}:${Resource.Postgres.port}/${Resource.Postgres.database}`

// Parse command line arguments
const args = process.argv.slice(2)
const organizationId = args[0]

// Create database connection
const pool = new Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function listWalkthroughs() {
    try {
        console.log('📚 Listing walkthroughs...\n')

        // Build query
        let query = db
            .select({
                id: walkthroughs.id,
                title: walkthroughs.title,
                description: walkthroughs.description,
                type: walkthroughs.type,
                status: walkthroughs.status,
                organizationId: walkthroughs.organizationId,
                organizationName: organizations.name,
                stepCount: sql<number>`COUNT(DISTINCT ${walkthroughSteps.id})`,
                serverCount: sql<number>`COUNT(DISTINCT ${mcpServerWalkthroughs.id})`,
                createdAt: walkthroughs.createdAt
            })
            .from(walkthroughs)
            .leftJoin(organizations, eq(walkthroughs.organizationId, organizations.id))
            .leftJoin(walkthroughSteps, eq(walkthroughSteps.walkthroughId, walkthroughs.id))
            .leftJoin(mcpServerWalkthroughs, eq(mcpServerWalkthroughs.walkthroughId, walkthroughs.id))
            .groupBy(
                walkthroughs.id,
                walkthroughs.title,
                walkthroughs.description,
                walkthroughs.type,
                walkthroughs.status,
                walkthroughs.organizationId,
                organizations.name,
                walkthroughs.createdAt
            )

        // Filter by organization if provided
        if (organizationId) {
            query = query.where(eq(walkthroughs.organizationId, organizationId))
        }

        const results = await query

        if (results.length === 0) {
            console.log('No walkthroughs found')
            return
        }

        // Display results
        for (const walkthrough of results) {
            console.log(`🆔 ${walkthrough.id}`)
            console.log(`   📌 Title: ${walkthrough.title}`)
            if (walkthrough.description) {
                console.log(`   📝 Description: ${walkthrough.description}`)
            }
            console.log(`   🏢 Organization: ${walkthrough.organizationName} (${walkthrough.organizationId})`)
            console.log(`   📊 Type: ${walkthrough.type}`)
            console.log(`   🚦 Status: ${walkthrough.status}`)
            console.log(`   📄 Steps: ${walkthrough.stepCount}`)
            console.log(`   🖥️  Servers: ${walkthrough.serverCount}`)
            console.log(`   📅 Created: ${new Date(Number(walkthrough.createdAt)).toLocaleDateString()}`)
            console.log('')
        }

        console.log(`\n✅ Total walkthroughs: ${results.length}`)

        if (!organizationId) {
            console.log('\n💡 Tip: Filter by organization:')
            console.log('   bun scripts/walkthrough-tools/list-walkthroughs.ts <organization-id>')
        }
    } catch (error) {
        console.error('Error listing walkthroughs:', error)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

// Run the listing
listWalkthroughs()
