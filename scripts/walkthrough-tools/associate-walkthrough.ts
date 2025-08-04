#!/usr/bin/env bun

import { mcpServers, mcpServerWalkthroughs, walkthroughs } from 'database/src/schema'
import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { Resource } from 'sst'

const { Pool } = pg

// Get database URL from SST resources
const DATABASE_URL = `postgresql://${Resource.Postgres.username}:${Resource.Postgres.password}@${Resource.Postgres.host}:${Resource.Postgres.port}/${Resource.Postgres.database}`

// Parse command line arguments
const args = process.argv.slice(2)
if (args.length < 2) {
    console.error(
        'Usage: bun scripts/walkthrough-tools/associate-walkthrough.ts <walkthrough-id> <mcp-server-id> [display-order]'
    )
    console.error('Example: bun scripts/walkthrough-tools/associate-walkthrough.ts wt_123abc mcp_456def 1')
    process.exit(1)
}

const walkthroughId = args[0]
const mcpServerId = args[1]
const displayOrder = args[2] ? parseInt(args[2]) : 0

// Create database connection
const pool = new Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function associateWalkthrough() {
    try {
        console.log(`Associating walkthrough ${walkthroughId} with MCP server ${mcpServerId}...`)

        // Verify walkthrough exists
        const [walkthrough] = await db.select().from(walkthroughs).where(eq(walkthroughs.id, walkthroughId))

        if (!walkthrough) {
            console.error(`Walkthrough ${walkthroughId} not found`)
            process.exit(1)
        }

        // Verify MCP server exists
        const [mcpServer] = await db.select().from(mcpServers).where(eq(mcpServers.id, mcpServerId))

        if (!mcpServer) {
            console.error(`MCP server ${mcpServerId} not found`)
            process.exit(1)
        }

        // Check if association already exists
        const [existing] = await db
            .select()
            .from(mcpServerWalkthroughs)
            .where(
                and(
                    eq(mcpServerWalkthroughs.mcpServerId, mcpServerId),
                    eq(mcpServerWalkthroughs.walkthroughId, walkthroughId)
                )
            )

        if (existing) {
            console.log('⚠️  Association already exists')
            console.log(`   - Display order: ${existing.displayOrder}`)
            console.log(`   - Enabled: ${existing.isEnabled}`)
            process.exit(0)
        }

        // Create the association
        const [association] = await db
            .insert(mcpServerWalkthroughs)
            .values({
                mcpServerId: mcpServerId,
                walkthroughId: walkthroughId,
                displayOrder: displayOrder,
                isEnabled: 'true',
                createdAt: BigInt(Date.now())
            })
            .returning()

        console.log('✅ Association created successfully')
        console.log(`   - Walkthrough: ${walkthrough.title}`)
        console.log(`   - MCP Server: ${mcpServer.name} (${mcpServer.slug})`)
        console.log(`   - Display order: ${displayOrder}`)
    } catch (error) {
        console.error('Error associating walkthrough:', error)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

// Run the association
associateWalkthrough()
