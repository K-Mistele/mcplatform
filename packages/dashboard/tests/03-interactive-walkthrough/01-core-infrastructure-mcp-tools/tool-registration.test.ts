import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { nanoid } from 'common/nanoid'
import { db, mcpServerUser, mcpServerWalkthroughs, mcpServers, organization, walkthroughs } from 'database'
import { and, eq } from 'drizzle-orm'

// Mock MCP server for testing tool registration
class MockMcpServer {
    tools: Map<string, any> = new Map()
    handlers: Map<string, Function> = new Map()

    registerTool(name: string, definition: any, handler: Function) {
        this.tools.set(name, { name, ...definition })
        this.handlers.set(name, handler)
    }

    setRequestHandler(config: any, handler: Function) {
        if (config.method === 'tools/call' && config.schema?.name) {
            this.handlers.set(config.schema.name, handler)
        } else if (config.method === 'tools/list') {
            this.handlers.set('tools/list', handler)
        }
    }

    async callTool(toolName: string, request: any) {
        const handler = this.handlers.get(toolName)
        if (!handler) {
            throw new Error(`Tool handler not found: ${toolName}`)
        }
        return handler(request)
    }

    async listTools() {
        const handler = this.handlers.get('tools/list')
        if (handler) {
            return handler()
        }
        // Return registered tools if no list handler
        return { 
            tools: Array.from(this.tools.values())
        }
    }
}

// Import the functions we need to test - we'll need to mock the MCP server
import { registerMcpServerToolsFromConfig } from '../../../src/lib/mcp/index'

describe('Tool Registration Integration', () => {
    let testOrganizationId: string
    let testMcpServerId: string
    let testWalkthroughId: string
    let testMcpServerUserId: string
    let testServerSessionId: string
    let mockServer: MockMcpServer

    // Track created resources for cleanup
    const createdOrganizations: string[] = []
    const createdMcpServers: string[] = []
    const createdWalkthroughs: string[] = []
    const createdMcpServerUsers: string[] = []
    const createdMcpServerWalkthroughs: Array<{ mcpServerId: string; walkthroughId: string }> = []

    beforeEach(async () => {
        mockServer = new MockMcpServer()

        // Create test organization
        testOrganizationId = `org_${nanoid(8)}`
        await db.insert(organization).values({
            id: testOrganizationId,
            name: 'Test Organization',
            createdAt: new Date()
        })
        createdOrganizations.push(testOrganizationId)

        // Create test MCP server user
        testMcpServerUserId = `mcpu_${nanoid(12)}`
        await db.insert(mcpServerUser).values({
            id: testMcpServerUserId,
            trackingId: `track_${nanoid(8)}`,
            email: 'test@example.com'
        })
        createdMcpServerUsers.push(testMcpServerUserId)

        testServerSessionId = `sess_${nanoid(12)}`
    })

    afterEach(async () => {
        // Clean up only the resources created in this test
        for (const link of createdMcpServerWalkthroughs) {
            await db
                .delete(mcpServerWalkthroughs)
                .where(
                    and(
                        eq(mcpServerWalkthroughs.mcpServerId, link.mcpServerId),
                        eq(mcpServerWalkthroughs.walkthroughId, link.walkthroughId)
                    )
                )
        }

        for (const id of createdWalkthroughs) {
            await db.delete(walkthroughs).where(eq(walkthroughs.id, id))
        }

        for (const id of createdMcpServerUsers) {
            await db.delete(mcpServerUser).where(eq(mcpServerUser.id, id))
        }

        for (const id of createdMcpServers) {
            await db.delete(mcpServers).where(eq(mcpServers.id, id))
        }

        for (const id of createdOrganizations) {
            await db.delete(organization).where(eq(organization.id, id))
        }

        // Clear tracking arrays
        createdOrganizations.length = 0
        createdMcpServers.length = 0
        createdWalkthroughs.length = 0
        createdMcpServerUsers.length = 0
        createdMcpServerWalkthroughs.length = 0
    })

    describe('Conditional Tool Registration', () => {
        test('should register walkthrough tools when server has walkthroughs and tools are enabled', async () => {
            // Create MCP server with walkthrough tools enabled
            testMcpServerId = `mcp_${nanoid(8)}`
            await db.insert(mcpServers).values({
                id: testMcpServerId,
                organizationId: testOrganizationId,
                name: 'Test Server',
                productPlatformOrTool: 'Test Platform',
                slug: `test-${nanoid(4)}`,
                walkthroughToolsEnabled: 'true'
            })
            createdMcpServers.push(testMcpServerId)

            // Create and link a published walkthrough
            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Test Walkthrough',
                status: 'published'
            })
            createdWalkthroughs.push(testWalkthroughId)

            await db.insert(mcpServerWalkthroughs).values({
                mcpServerId: testMcpServerId,
                walkthroughId: testWalkthroughId
            })
            createdMcpServerWalkthroughs.push({ mcpServerId: testMcpServerId, walkthroughId: testWalkthroughId })

            // Register tools
            const serverConfig = await db
                .select()
                .from(mcpServers)
                .where(eq(mcpServers.id, testMcpServerId))
                .limit(1)
                .then((rows) => rows[0])

            await registerMcpServerToolsFromConfig({
                server: mockServer as any,
                serverConfig: serverConfig as any,
                trackingId: null,
                email: 'test@example.com',
                mcpServerUserId: testMcpServerUserId,
                serverSessionId: testServerSessionId
            })

            // Verify walkthrough tools are registered
            const toolsList = await mockServer.listTools()
            const toolNames = toolsList.tools.map((tool: any) => tool.name)

            expect(toolNames).toContain('list_walkthroughs')
            expect(toolNames).toContain('get_walkthrough_details')
            expect(toolNames).toContain('get_next_step')

            // Verify we can call walkthrough tools
            expect(mockServer.handlers.has('list_walkthroughs')).toBe(true)
            expect(mockServer.handlers.has('get_walkthrough_details')).toBe(true)
            expect(mockServer.handlers.has('get_next_step')).toBe(true)
        })

        test('should NOT register walkthrough tools when tools are disabled', async () => {
            // Create MCP server with walkthrough tools disabled
            testMcpServerId = `mcp_${nanoid(8)}`
            await db.insert(mcpServers).values({
                id: testMcpServerId,
                organizationId: testOrganizationId,
                name: 'Test Server',
                productPlatformOrTool: 'Test Platform',
                slug: `test-${nanoid(4)}`,
                walkthroughToolsEnabled: 'false' // Disabled
            })
            createdMcpServers.push(testMcpServerId)

            // Create and link a published walkthrough
            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Test Walkthrough',
                status: 'published'
            })
            createdWalkthroughs.push(testWalkthroughId)

            await db.insert(mcpServerWalkthroughs).values({
                mcpServerId: testMcpServerId,
                walkthroughId: testWalkthroughId
            })
            createdMcpServerWalkthroughs.push({ mcpServerId: testMcpServerId, walkthroughId: testWalkthroughId })

            const serverConfig = await db
                .select()
                .from(mcpServers)
                .where(eq(mcpServers.id, testMcpServerId))
                .limit(1)
                .then((rows) => rows[0])

            await registerMcpServerToolsFromConfig({
                server: mockServer as any,
                serverConfig: serverConfig as any,
                trackingId: null,
                email: 'test@example.com',
                mcpServerUserId: testMcpServerUserId,
                serverSessionId: testServerSessionId
            })

            // Verify walkthrough tools are NOT registered
            expect(mockServer.handlers.has('list_walkthroughs')).toBe(false)
            expect(mockServer.handlers.has('get_walkthrough_details')).toBe(false)
            expect(mockServer.handlers.has('get_next_step')).toBe(false)
        })

        test('should NOT register walkthrough tools when server has no walkthroughs', async () => {
            // Create MCP server with walkthrough tools enabled but no walkthroughs
            testMcpServerId = `mcp_${nanoid(8)}`
            await db.insert(mcpServers).values({
                id: testMcpServerId,
                organizationId: testOrganizationId,
                name: 'Test Server',
                productPlatformOrTool: 'Test Platform',
                slug: `test-${nanoid(4)}`,
                walkthroughToolsEnabled: 'true'
            })
            createdMcpServers.push(testMcpServerId)

            // No walkthroughs created or linked

            const serverConfig = await db
                .select()
                .from(mcpServers)
                .where(eq(mcpServers.id, testMcpServerId))
                .limit(1)
                .then((rows) => rows[0])

            await registerMcpServerToolsFromConfig({
                server: mockServer as any,
                serverConfig: serverConfig as any,
                trackingId: null,
                email: 'test@example.com',
                mcpServerUserId: testMcpServerUserId,
                serverSessionId: testServerSessionId
            })

            // Verify walkthrough tools are NOT registered
            expect(mockServer.handlers.has('list_walkthroughs')).toBe(false)
            expect(mockServer.handlers.has('get_walkthrough_details')).toBe(false)
            expect(mockServer.handlers.has('get_next_step')).toBe(false)
        })

        test('should NOT register walkthrough tools when server has only draft walkthroughs', async () => {
            // Create MCP server with walkthrough tools enabled
            testMcpServerId = `mcp_${nanoid(8)}`
            await db.insert(mcpServers).values({
                id: testMcpServerId,
                organizationId: testOrganizationId,
                name: 'Test Server',
                productPlatformOrTool: 'Test Platform',
                slug: `test-${nanoid(4)}`,
                walkthroughToolsEnabled: 'true'
            })
            createdMcpServers.push(testMcpServerId)

            // Create and link a DRAFT walkthrough (not published)
            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Draft Walkthrough',
                status: 'draft' // Not published
            })
            createdWalkthroughs.push(testWalkthroughId)

            await db.insert(mcpServerWalkthroughs).values({
                mcpServerId: testMcpServerId,
                walkthroughId: testWalkthroughId
            })
            createdMcpServerWalkthroughs.push({ mcpServerId: testMcpServerId, walkthroughId: testWalkthroughId })

            const serverConfig = await db
                .select()
                .from(mcpServers)
                .where(eq(mcpServers.id, testMcpServerId))
                .limit(1)
                .then((rows) => rows[0])

            await registerMcpServerToolsFromConfig({
                server: mockServer as any,
                serverConfig: serverConfig as any,
                trackingId: null,
                email: 'test@example.com',
                mcpServerUserId: testMcpServerUserId,
                serverSessionId: testServerSessionId
            })

            // Verify walkthrough tools are NOT registered
            expect(mockServer.handlers.has('list_walkthroughs')).toBe(false)
            expect(mockServer.handlers.has('get_walkthrough_details')).toBe(false)
            expect(mockServer.handlers.has('get_next_step')).toBe(false)
        })

        test('should register walkthrough tools when server has at least one published walkthrough', async () => {
            // Create MCP server with walkthrough tools enabled
            testMcpServerId = `mcp_${nanoid(8)}`
            await db.insert(mcpServers).values({
                id: testMcpServerId,
                organizationId: testOrganizationId,
                name: 'Test Server',
                productPlatformOrTool: 'Test Platform',
                slug: `test-${nanoid(4)}`,
                walkthroughToolsEnabled: 'true'
            })
            createdMcpServers.push(testMcpServerId)

            // Create one draft and one published walkthrough
            const draftWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: draftWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Draft Walkthrough',
                status: 'draft'
            })
            createdWalkthroughs.push(draftWalkthroughId)

            testWalkthroughId = `wt_${nanoid(8)}`
            await db.insert(walkthroughs).values({
                id: testWalkthroughId,
                organizationId: testOrganizationId,
                title: 'Published Walkthrough',
                status: 'published'
            })
            createdWalkthroughs.push(testWalkthroughId)

            // Link both walkthroughs
            await db.insert(mcpServerWalkthroughs).values([
                {
                    mcpServerId: testMcpServerId,
                    walkthroughId: draftWalkthroughId
                },
                {
                    mcpServerId: testMcpServerId,
                    walkthroughId: testWalkthroughId
                }
            ])
            createdMcpServerWalkthroughs.push(
                { mcpServerId: testMcpServerId, walkthroughId: draftWalkthroughId },
                { mcpServerId: testMcpServerId, walkthroughId: testWalkthroughId }
            )

            const serverConfig = await db
                .select()
                .from(mcpServers)
                .where(eq(mcpServers.id, testMcpServerId))
                .limit(1)
                .then((rows) => rows[0])

            await registerMcpServerToolsFromConfig({
                server: mockServer as any,
                serverConfig: serverConfig as any,
                trackingId: null,
                email: 'test@example.com',
                mcpServerUserId: testMcpServerUserId,
                serverSessionId: testServerSessionId
            })

            // Verify walkthrough tools ARE registered (because there's at least one published walkthrough)
            expect(mockServer.handlers.has('list_walkthroughs')).toBe(true)
            expect(mockServer.handlers.has('get_walkthrough_details')).toBe(true)
            expect(mockServer.handlers.has('get_next_step')).toBe(true)
        })
    })

    describe('Default Configuration', () => {
        test('should default walkthroughToolsEnabled to true for new servers', async () => {
            // Create MCP server without specifying walkthroughToolsEnabled (should default to true)
            testMcpServerId = `mcp_${nanoid(8)}`
            const insertedServer = await db
                .insert(mcpServers)
                .values({
                    id: testMcpServerId,
                    organizationId: testOrganizationId,
                    name: 'Test Server',
                    productPlatformOrTool: 'Test Platform',
                    slug: `test-${nanoid(4)}`
                    // walkthroughToolsEnabled not specified, should default to 'true'
                })
                .returning()
            createdMcpServers.push(testMcpServerId)

            expect(insertedServer[0].walkthroughToolsEnabled).toBe('true')
        })
    })
})
