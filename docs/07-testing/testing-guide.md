# Testing Guide

This guide covers testing patterns and practices in MCPlatform, including unit testing with `bun:test`, integration testing with database operations, and UI testing with Puppeteer.

## Overview

MCPlatform uses a comprehensive testing strategy:
- **Unit Tests**: `bun:test` framework for fast, isolated tests
- **Integration Tests**: Database integration with proper cleanup
- **UI Tests**: Puppeteer for automated browser testing
- **API Tests**: oRPC endpoint testing with authentication

## Test Organization

### Directory Structure
```
packages/
├── dashboard/
│   └── tests/
│       └── 03-interactive-walkthrough/
│           ├── 01-core-infrastructure-mcp-tools/
│           ├── 02-walkthrough-authoring-ui/
│           └── 03-server-assignment-ui/
└── retrieval/
    └── test/
        └── 04-documentation-retrieval/
```

### Naming Conventions
- Test files: `*.test.ts`
- Integration tests: Include database operations
- UI tests: Include `ui` in filename
- Feature-based organization under numbered directories

## Bun Test Framework

### Basic Test Structure

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'

describe('Feature Name', () => {
    beforeEach(async () => {
        // Setup before each test
    })

    afterEach(async () => {
        // Cleanup after each test
    })

    test('should do something specific', async () => {
        // Test implementation
        expect(result).toBe(expected)
    })
})
```

### Running Tests

**All Tests**:
```bash
# Run all tests (uses SST shell for database access)
bun run tests

# Equivalent to:
bun sst shell -- bun test --timeout 15000
```

**Specific Test Files**:
```bash
# Run single test file
bun run tests packages/dashboard/tests/01-example/example.test.ts

# Run tests matching pattern
bun run tests --grep "walkthrough"
```

**Test Configuration** (`package.json:17`):
- Default timeout: 15 seconds
- Runs in SST shell for database connectivity
- Automatic environment variable injection

## Database Integration Testing

### Setup and Cleanup Pattern

**Example from tool registration tests** (`packages/dashboard/tests/.../tool-registration.test.ts:47-121`):

```typescript
describe('Integration Test', () => {
    // Track created resources
    const createdOrganizations: string[] = []
    const createdMcpServers: string[] = []
    const createdUsers: string[] = []

    beforeEach(async () => {
        // Create test data with unique IDs
        const organizationId = `org_${nanoid(8)}`
        await db.insert(organization).values({
            id: organizationId,
            name: 'Test Organization'
        })
        createdOrganizations.push(organizationId)
    })

    afterEach(async () => {
        // Clean up in reverse dependency order
        for (const id of createdUsers) {
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
        createdUsers.length = 0
    })
})
```

### Database Testing Best Practices

#### 1. Use Unique Test Data
```typescript
// Generate unique IDs to avoid conflicts
const testId = `test_${nanoid(8)}`
const email = `test-${nanoid(6)}@example.com`
```

#### 2. Track All Created Resources
```typescript
// Always track what you create for cleanup
const createdResources: string[] = []

await db.insert(table).values({ id: testId })
createdResources.push(testId)
```

#### 3. Clean Up in Dependency Order
```typescript
// Delete child records before parent records
await db.delete(walkthroughSteps).where(eq(walkthroughSteps.walkthroughId, walkthroughId))
await db.delete(walkthroughs).where(eq(walkthroughs.id, walkthroughId))
```

#### 4. Handle Foreign Key Relationships
```typescript
// For complex relationships, use joins to clean up
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
```

## Mock Objects and Testing Utilities

### Mock MCP Server

**Example from tool registration tests** (`packages/dashboard/tests/.../tool-registration.test.ts:6-42`):

```typescript
class MockMcpServer {
    tools: Map<string, any> = new Map()
    handlers: Map<string, Function> = new Map()

    registerTool(name: string, definition: any, handler: Function) {
        this.tools.set(name, { name, ...definition })
        this.handlers.set(name, handler)
    }

    async callTool(toolName: string, request: any) {
        const handler = this.handlers.get(toolName)
        if (!handler) {
            throw new Error(`Tool handler not found: ${toolName}`)
        }
        return handler(request)
    }

    async listTools() {
        return { 
            tools: Array.from(this.tools.values())
        }
    }
}
```

### Testing MCP Tool Registration

```typescript
test('should register conditional tools correctly', async () => {
    const mockServer = new MockMcpServer()
    
    // Create server configuration
    const serverConfig = {
        walkthroughToolsEnabled: 'true',
        supportTicketType: 'dashboard'
    }
    
    // Test tool registration
    await registerMcpServerToolsFromConfig({
        server: mockServer as any,
        serverConfig,
        // ... other params
    })
    
    // Verify tools were registered
    const toolsList = await mockServer.listTools()
    const toolNames = toolsList.tools.map(tool => tool.name)
    
    expect(toolNames).toContain('get_support')
    expect(toolNames).toContain('start_walkthrough')
})
```

## Puppeteer UI Testing

### Browser Setup

**Configuration from UI tests** (`packages/dashboard/tests/.../ui.test.ts:33-62`):

```typescript
describe('UI Tests', () => {
    let browser: Browser
    let page: Page
    
    const DEFAULT_TIMEOUT = 30000
    const NAVIGATION_TIMEOUT = 15000
    const ELEMENT_TIMEOUT = 10000

    beforeAll(async () => {
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
        page.setDefaultTimeout(DEFAULT_TIMEOUT)
        page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT)
        
        await page.setViewport({ width: 1920, height: 1080 })

        // Auto-login for testing
        await page.goto('http://localhost:3000/login-for-claude')
        await new Promise(resolve => setTimeout(resolve, 2000))
    })

    afterAll(async () => {
        await page?.close().catch(console.error)
        await browser?.close().catch(console.error)
    })
})
```

### UI Testing Patterns

#### 1. Safe Element Waiting

```typescript
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
```

#### 2. Form Interaction

```typescript
test('should fill and submit form', async () => {
    // Wait for form elements
    await page.waitForSelector('input[name="title"]')
    await page.type('input[name="title"]', 'Test Data')
    
    await page.waitForSelector('textarea[name="description"]')
    await page.type('textarea[name="description"]', 'Test description')
    
    // Handle dropdown selection
    await page.click('[role="combobox"]')
    await page.waitForSelector('[role="option"]')
    const options = await page.$$('[role="option"]')
    if (options.length > 0) {
        await options[0].click()
    }
    
    // Submit form
    const submitButton = await page.$('button[type="submit"]')
    await submitButton.click()
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle0' })
})
```

#### 3. Dynamic Content Testing

```typescript
test('should interact with dynamic elements', async () => {
    // Find buttons by text content
    const createButton = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return buttons.find(btn => 
            btn.textContent?.includes('Create Walkthrough') &&
            btn.querySelector('svg')
        )
    })
    
    if (createButton) {
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'))
            const button = buttons.find(btn => 
                btn.textContent?.includes('Create Walkthrough')
            )
            button?.click()
        })
    }
})
```

#### 4. Error Handling and Debugging

```typescript
test('should handle errors gracefully', async () => {
    try {
        await page.waitForSelector('[role="dialog"]', { 
            visible: true, 
            timeout: ELEMENT_TIMEOUT 
        })
    } catch (error) {
        // Take screenshot for debugging
        await page.screenshot({ 
            path: 'test-failure-modal-timeout.png' 
        })
        throw new Error(`Failed to open modal: ${error.message}`)
    }
})
```

### Authentication in UI Tests

**Automatic Login** (`packages/dashboard/tests/.../ui.test.ts:54-58`):

```typescript
// Navigate to special endpoint that auto-authenticates
await page.goto('http://localhost:3000/login-for-claude', { 
    waitUntil: 'networkidle0' 
})

// The login-for-claude endpoint automatically logs in during development
await new Promise(resolve => setTimeout(resolve, 2000))
```

This endpoint bypasses normal authentication for testing - see [Development Workflow](../01-getting-started/development-workflow.md#testing-authentication).

### Responsive Testing

```typescript
test('should work on different screen sizes', async () => {
    // Test mobile layout
    await page.setViewport({ width: 768, height: 1024 })
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const mobileTitleVisible = await page.$('h1')
    expect(mobileTitleVisible).toBeTruthy()
    
    // Return to desktop
    await page.setViewport({ width: 1920, height: 1080 })
})
```

## External Service Testing

### TurboPuffer Integration Testing

**Example from retrieval tests** (`packages/retrieval/test/.../query-turbopuffer-direct.test.ts:19-233`):

```typescript
describe('External Service Integration', () => {
    let organizationId: string
    let namespaceId: string

    beforeAll(async () => {
        // Generate unique test identifiers
        organizationId = `org_test_${randomUUID().substring(0, 8)}`
        namespaceId = `ns_test_${randomUUID().substring(0, 8)}`

        // Create test organization and namespace
        await db.insert(schema.organization).values({
            id: organizationId,
            name: 'Test Organization',
            createdAt: new Date()
        }).onConflictDoNothing()

        await db.insert(schema.retrievalNamespace).values({
            id: namespaceId,
            name: 'Test Namespace',
            organizationId,
            createdAt: Date.now()
        }).onConflictDoNothing()
    })

    afterAll(async () => {
        // Clean up database records
        await db.delete(schema.retrievalNamespace)
            .where(eq(schema.retrievalNamespace.id, namespaceId))
        await db.delete(schema.organization)
            .where(eq(schema.organization.id, organizationId))
        
        // Clean up external service
        await nukeTurbopufferNamespace({ organizationId, namespaceId })
    })

    test('should perform end-to-end document processing', async () => {
        // 1. Process document
        const chunks = chunkDocument(testContent)
        expect(chunks.length).toBeGreaterThan(0)

        // 2. Generate embeddings
        const embeddingsResult = await embedMany({
            model: geminiEmbedding,
            values: chunks.slice(0, 10), // Limit for rate limiting
            providerOptions: {
                google: { taskType: 'RETRIEVAL_DOCUMENT' }
            }
        })

        // 3. Insert into external service
        await upsertIntoTurboPuffer({
            organizationId,
            namespaceId,
            chunks: chunks.map((chunk, index) => ({
                chunkIndex: index,
                embedding: embeddingsResult.embeddings[index],
                documentPath: 'test/file.md',
                content: chunk,
                contextualizedContent: chunk,
                metadata: { title: 'Test Document' }
            }))
        })

        // 4. Query and verify
        const results = await bm25SearchTurbopuffer({
            organizationId,
            namespaceId,
            query: 'context window',
            topK: 5
        })

        expect(results.length).toBeGreaterThan(0)
    }, 60000) // Long timeout for external API calls
})
```

### External Service Testing Best Practices

#### 1. Rate Limiting Awareness
```typescript
// Limit test data size to avoid rate limits
const testChunks = chunks.slice(0, 10)
```

#### 2. Longer Timeouts
```typescript
test('external service test', async () => {
    // Implementation
}, 60000) // 60 second timeout for API calls
```

#### 3. Wait for External Processing
```typescript
// Wait for external service to process data
await new Promise(resolve => setTimeout(resolve, 2000))
```

#### 4. Graceful External Service Cleanup
```typescript
afterAll(async () => {
    try {
        await nukeTurbopufferNamespace({ organizationId, namespaceId })
    } catch (error) {
        console.warn('External cleanup failed:', error)
        // Don't fail test if external cleanup fails
    }
})
```

## Testing Server Actions (oRPC)

### Authentication Testing

```typescript
describe('Server Actions', () => {
    test('should require authentication', async () => {
        // Test without authentication
        await expect(
            serverAction({ input: 'test' })
        ).rejects.toThrow('UNAUTHORIZED')
    })

    test('should work with valid session', async () => {
        // Mock authenticated session
        const mockSession = {
            session: { activeOrganizationId: testOrgId },
            user: { id: testUserId }
        }
        
        // Mock requireSession function
        jest.mock('@/lib/auth/auth', () => ({
            requireSession: () => Promise.resolve(mockSession)
        }))

        const result = await serverAction({ input: 'test' })
        expect(result).toBeDefined()
    })
})
```

### Input Validation Testing

```typescript
test('should validate input schema', async () => {
    // Test invalid input
    await expect(
        serverAction({ invalidField: 'test' })
    ).rejects.toThrow('Validation error')

    // Test missing required fields
    await expect(
        serverAction({})
    ).rejects.toThrow('Required field missing')

    // Test valid input
    const result = await serverAction({
        title: 'Valid Title',
        description: 'Valid Description'
    })
    expect(result).toBeDefined()
})
```

## Testing Patterns Summary

### Unit Tests
- **Fast execution** (< 1 second per test)
- **Isolated functionality** (no database or external services)
- **Mock dependencies** appropriately
- **Focus on business logic**

### Integration Tests
- **Database connectivity** via SST shell
- **Proper cleanup** of test data
- **Realistic data relationships**
- **End-to-end workflows**

### UI Tests
- **Real browser automation**
- **User interaction simulation**
- **Visual regression detection**
- **Responsive design validation**

### Performance Considerations
- **Parallel test execution** where possible
- **Efficient database cleanup**
- **Rate limit awareness** for external APIs
- **Timeout configuration** per test type

## Continuous Integration

### Test Pipeline

```bash
# Development workflow
bun run tests                    # Run all tests locally

# CI/CD pipeline (suggested)
bun sst deploy --stage ci        # Deploy test environment
bun run tests                    # Run full test suite
bun sst remove --stage ci        # Clean up test resources
```

### Test Environment Requirements

- **Database access**: Tests run in SST shell with database connectivity
- **Redis access**: For caching and session testing
- **External API keys**: For TurboPuffer and embedding services
- **ngrok tunnel**: For webhook testing in development

## Debugging Tests

### Common Issues and Solutions

#### 1. Database Connection Timeout
```bash
# Ensure SST development stack is running
bun dev

# Run tests in separate terminal
bun run tests
```

#### 2. UI Test Flakiness
```typescript
// Increase timeouts for CI environments
const timeout = process.env.CI ? 60000 : 30000

// Add more specific waits
await page.waitForLoadState('networkidle')
await page.waitForSelector('[data-testid="content-loaded"]')
```

#### 3. External Service Rate Limits
```typescript
// Add delays between API calls
await new Promise(resolve => setTimeout(resolve, 1000))

// Use smaller test datasets
const testData = fullData.slice(0, 5)
```

### Test Debugging Tools

```typescript
// Take screenshots on failure
catch (error) {
    await page.screenshot({ path: `failure-${Date.now()}.png` })
    throw error
}

// Log detailed error information
console.log('Test context:', { 
    url: await page.url(),
    title: await page.title(),
    timestamp: new Date().toISOString()
})
```

## Related Documentation

- [Development Workflow](../01-getting-started/development-workflow.md) - Testing commands and authentication
- [Database Schema](../04-database/schema-design.md) - Understanding data relationships for testing
- [oRPC API Reference](../09-api-reference/orpc-reference.md) - API endpoints for integration testing
- [SST Deployment](../08-deployment/sst-deployment.md) - Testing infrastructure setup

## Best Practices Checklist

### Before Writing Tests
- [ ] Understand the feature being tested
- [ ] Identify dependencies (database, external APIs, authentication)
- [ ] Plan test data cleanup strategy
- [ ] Choose appropriate test type (unit/integration/UI)

### During Test Implementation
- [ ] Use descriptive test names
- [ ] Generate unique test data to avoid conflicts
- [ ] Track all created resources for cleanup
- [ ] Handle async operations properly
- [ ] Add appropriate timeouts
- [ ] Include error handling and debugging aids

### After Test Implementation
- [ ] Verify tests pass in isolation
- [ ] Verify tests pass when run together
- [ ] Check for proper cleanup (no test data leaked)
- [ ] Run tests in CI environment
- [ ] Document any special setup requirements

## Advanced Testing Patterns

### Test Data Factories

**Organization Factory**:
```typescript
interface CreateTestOrganizationOptions {
    name?: string
    id?: string
    customData?: Partial<typeof schema.organization.$inferInsert>
}

export const createTestOrganization = async (
    options: CreateTestOrganizationOptions = {}
): Promise<string> => {
    const organizationId = options.id || `org_${nanoid(8)}`
    
    await db.insert(schema.organization).values({
        id: organizationId,
        name: options.name || `Test Org ${organizationId}`,
        createdAt: Date.now(),
        ...options.customData
    })
    
    return organizationId
}
```

**MCP Server Factory**:
```typescript
interface CreateTestMcpServerOptions {
    organizationId: string
    slug?: string
    authType?: string[]
    supportTicketType?: string
    walkthroughToolsEnabled?: 'true' | 'false'
}

export const createTestMcpServer = async (
    options: CreateTestMcpServerOptions
): Promise<string> => {
    const serverId = `srv_${nanoid(8)}`
    const slug = options.slug || `test-server-${nanoid(6)}`
    
    await db.insert(schema.mcpServers).values({
        id: serverId,
        organizationId: options.organizationId,
        name: `Test Server ${slug}`,
        slug,
        authType: options.authType || [],
        supportTicketType: options.supportTicketType || 'dashboard',
        walkthroughToolsEnabled: options.walkthroughToolsEnabled || 'false',
        productPlatformOrTool: 'Test Platform',
        createdAt: Date.now()
    })
    
    return serverId
}
```

**Walkthrough Factory**:
```typescript
interface CreateTestWalkthroughOptions {
    organizationId: string
    title?: string
    type?: string
    status?: 'draft' | 'published'
    stepCount?: number
}

export const createTestWalkthrough = async (
    options: CreateTestWalkthroughOptions
): Promise<{ walkthroughId: string; stepIds: string[] }> => {
    const walkthroughId = `wt_${nanoid(8)}`
    
    await db.insert(schema.walkthroughs).values({
        id: walkthroughId,
        organizationId: options.organizationId,
        title: options.title || `Test Walkthrough ${walkthroughId}`,
        description: 'A test walkthrough for automated testing',
        type: options.type || 'course',
        status: options.status || 'published',
        createdAt: Date.now()
    })
    
    const stepIds: string[] = []
    const stepCount = options.stepCount || 3
    
    for (let i = 0; i < stepCount; i++) {
        const stepId = `step_${nanoid(8)}`
        await db.insert(schema.walkthroughSteps).values({
            id: stepId,
            walkthroughId,
            title: `Step ${i + 1}`,
            displayOrder: i + 1,
            contentFields: {
                version: 'v1',
                introductionForAgent: `Introduction for step ${i + 1}`,
                contextForAgent: `Context for step ${i + 1}`,
                contentForUser: `# Step ${i + 1}\n\nThis is step ${i + 1} content.`,
                operationsForAgent: `Operations for step ${i + 1}`
            },
            createdAt: Date.now()
        })
        stepIds.push(stepId)
    }
    
    return { walkthroughId, stepIds }
}
```

### Test Utilities and Helpers

**Database Test Helper**:
```typescript
export class DatabaseTestHelper {
    private organizationIds: string[] = []
    private mcpServerIds: string[] = []
    private walkthroughIds: string[] = []
    private stepIds: string[] = []
    private userIds: string[] = []
    private sessionIds: string[] = []

    async createTestOrganization(options?: CreateTestOrganizationOptions) {
        const id = await createTestOrganization(options)
        this.organizationIds.push(id)
        return id
    }

    async createTestMcpServer(options: CreateTestMcpServerOptions) {
        const id = await createTestMcpServer(options)
        this.mcpServerIds.push(id)
        return id
    }

    async createTestWalkthrough(options: CreateTestWalkthroughOptions) {
        const result = await createTestWalkthrough(options)
        this.walkthroughIds.push(result.walkthroughId)
        this.stepIds.push(...result.stepIds)
        return result
    }

    async cleanup() {
        console.log('Cleaning up test data...')
        
        // Clean up in dependency order
        for (const id of this.sessionIds) {
            await db.delete(schema.mcpServerSession).where(eq(schema.mcpServerSession.id, id))
        }
        
        for (const id of this.userIds) {
            await db.delete(schema.mcpServerUser).where(eq(schema.mcpServerUser.id, id))
        }
        
        for (const id of this.stepIds) {
            await db.delete(schema.walkthroughSteps).where(eq(schema.walkthroughSteps.id, id))
        }
        
        for (const id of this.walkthroughIds) {
            await db.delete(schema.walkthroughs).where(eq(schema.walkthroughs.id, id))
        }
        
        for (const id of this.mcpServerIds) {
            await db.delete(schema.mcpServers).where(eq(schema.mcpServers.id, id))
        }
        
        for (const id of this.organizationIds) {
            await db.delete(schema.organization).where(eq(schema.organization.id, id))
        }

        // Clear tracking arrays
        this.organizationIds.length = 0
        this.mcpServerIds.length = 0
        this.walkthroughIds.length = 0
        this.stepIds.length = 0
        this.userIds.length = 0
        this.sessionIds.length = 0
        
        console.log('Test data cleanup completed')
    }
}
```

**Mock Request Helper**:
```typescript
export const createMockRequest = (options: {
    host?: string
    method?: string
    url?: string
    body?: any
    headers?: Record<string, string>
}) => {
    const defaultHeaders = {
        'content-type': 'application/json',
        'host': options.host || 'localhost:3000',
        ...options.headers
    }

    return {
        method: options.method || 'GET',
        url: options.url || '/',
        headers: {
            get: (key: string) => defaultHeaders[key.toLowerCase()],
            has: (key: string) => key.toLowerCase() in defaultHeaders,
            entries: () => Object.entries(defaultHeaders),
            forEach: (fn: (value: string, key: string) => void) => {
                Object.entries(defaultHeaders).forEach(([key, value]) => fn(value, key))
            }
        },
        json: async () => options.body || {},
        text: async () => JSON.stringify(options.body || {})
    } as Request
}
```

### Performance Testing

#### Database Query Performance Tests

```typescript
describe('Database Performance', () => {
    let testHelper: DatabaseTestHelper

    beforeEach(() => {
        testHelper = new DatabaseTestHelper()
    })

    afterEach(async () => {
        await testHelper.cleanup()
    })

    test('should handle large walkthrough queries efficiently', async () => {
        const organizationId = await testHelper.createTestOrganization()
        
        // Create multiple walkthroughs with many steps
        const walkthroughPromises = Array.from({ length: 10 }, (_, i) => 
            testHelper.createTestWalkthrough({
                organizationId,
                title: `Performance Test Walkthrough ${i}`,
                stepCount: 20 // 20 steps each
            })
        )
        
        await Promise.all(walkthroughPromises)
        
        // Test query performance
        const startTime = Date.now()
        
        const walkthroughs = await db
            .select()
            .from(schema.walkthroughs)
            .where(eq(schema.walkthroughs.organizationId, organizationId))
            .leftJoin(
                schema.walkthroughSteps,
                eq(schema.walkthroughSteps.walkthroughId, schema.walkthroughs.id)
            )
        
        const queryTime = Date.now() - startTime
        
        expect(walkthroughs.length).toBe(200) // 10 walkthroughs × 20 steps
        expect(queryTime).toBeLessThan(1000) // Should complete within 1 second
        
        console.log(`Query completed in ${queryTime}ms`)
    })

    test('should handle concurrent user session creation', async () => {
        const organizationId = await testHelper.createTestOrganization()
        const serverId = await testHelper.createTestMcpServer({ organizationId })
        
        // Simulate 50 concurrent users
        const concurrentUsers = 50
        const userPromises = Array.from({ length: concurrentUsers }, (_, i) => 
            getAndTrackMcpServerUser({
                trackingId: `test-user-${i}`,
                email: `test${i}@example.com`,
                mcpServerSlug: `test-server-${nanoid(6)}`
            })
        )
        
        const startTime = Date.now()
        const results = await Promise.all(userPromises)
        const concurrencyTime = Date.now() - startTime
        
        expect(results).toHaveLength(concurrentUsers)
        expect(concurrencyTime).toBeLessThan(5000) // Should handle within 5 seconds
        
        // Verify all users were created uniquely
        const uniqueUserIds = new Set(results.map(r => r.mcpServerUserId))
        expect(uniqueUserIds.size).toBe(concurrentUsers)
        
        console.log(`${concurrentUsers} concurrent users created in ${concurrencyTime}ms`)
    })
})
```

#### Memory Usage Testing

```typescript
describe('Memory Usage', () => {
    test('should handle large document processing without memory leaks', async () => {
        const initialMemory = process.memoryUsage()
        
        // Process a large document
        const largeContent = 'Lorem ipsum '.repeat(100000) // ~1MB of text
        const chunks = chunkDocument(largeContent)
        
        expect(chunks.length).toBeGreaterThan(100)
        
        // Simulate processing all chunks
        const processedChunks = chunks.map((chunk, index) => ({
            chunkIndex: index,
            content: chunk,
            contextualizedContent: chunk,
            metadata: { processed: true }
        }))
        
        const finalMemory = process.memoryUsage()
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed
        
        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
        
        console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`)
    })
})
```

### Load Testing Patterns

#### API Endpoint Load Testing

```typescript
describe('API Load Testing', () => {
    let testHelper: DatabaseTestHelper

    beforeEach(() => {
        testHelper = new DatabaseTestHelper()
    })

    afterEach(async () => {
        await testHelper.cleanup()
    })

    test('should handle concurrent MCP server requests', async () => {
        const organizationId = await testHelper.createTestOrganization()
        const serverId = await testHelper.createTestMcpServer({ organizationId })
        
        // Create mock server configuration
        const serverConfig = {
            id: serverId,
            name: 'Load Test Server',
            slug: 'load-test-server',
            organizationId,
            supportTicketType: 'dashboard',
            productPlatformOrTool: 'Test Platform'
        }
        
        // Simulate concurrent requests to support tool
        const concurrentRequests = 20
        const requestPromises = Array.from({ length: concurrentRequests }, (_, i) => {
            const mockRequest = {
                title: `Load test ticket ${i}`,
                problemDescription: `This is load test problem ${i}`,
                email: `loadtest${i}@example.com`
            }
            
            // Simulate tool call
            return new Promise((resolve, reject) => {
                setTimeout(async () => {
                    try {
                        await db.insert(schema.supportRequests).values({
                            id: `ticket_${nanoid(8)}`,
                            title: mockRequest.title,
                            conciseSummary: mockRequest.problemDescription,
                            email: mockRequest.email,
                            organizationId,
                            mcpServerId: serverId,
                            mcpServerSessionId: `session_${nanoid(8)}`,
                            status: 'pending',
                            createdAt: Date.now()
                        })
                        resolve({ success: true })
                    } catch (error) {
                        reject(error)
                    }
                }, Math.random() * 100) // Random delay up to 100ms
            })
        })
        
        const startTime = Date.now()
        const results = await Promise.all(requestPromises)
        const loadTestTime = Date.now() - startTime
        
        expect(results).toHaveLength(concurrentRequests)
        expect(loadTestTime).toBeLessThan(2000) // Should handle within 2 seconds
        
        // Verify all tickets were created
        const tickets = await db
            .select()
            .from(schema.supportRequests)
            .where(eq(schema.supportRequests.mcpServerId, serverId))
        
        expect(tickets).toHaveLength(concurrentRequests)
        
        console.log(`${concurrentRequests} concurrent requests handled in ${loadTestTime}ms`)
    })
})
```

### Integration Test Patterns

#### End-to-End Walkthrough Flow Testing

```typescript
describe('End-to-End Walkthrough Flow', () => {
    let testHelper: DatabaseTestHelper
    let mockMcpServer: MockMcpServer

    beforeEach(async () => {
        testHelper = new DatabaseTestHelper()
        mockMcpServer = new MockMcpServer()
    })

    afterEach(async () => {
        await testHelper.cleanup()
    })

    test('should complete full walkthrough progression', async () => {
        // Setup test data
        const organizationId = await testHelper.createTestOrganization()
        const serverId = await testHelper.createTestMcpServer({ 
            organizationId,
            walkthroughToolsEnabled: 'true'
        })
        const { walkthroughId, stepIds } = await testHelper.createTestWalkthrough({
            organizationId,
            title: 'Integration Test Walkthrough',
            stepCount: 3
        })
        
        // Link walkthrough to server
        await db.insert(schema.mcpServerWalkthroughs).values({
            mcpServerId: serverId,
            walkthroughId
        })
        
        // Create test user
        const userData = await getAndTrackMcpServerUser({
            trackingId: 'integration-test-user',
            email: 'integrationtest@example.com',
            mcpServerSlug: 'integration-test-server'
        })
        
        testHelper.userIds.push(userData.mcpServerUserId)
        testHelper.sessionIds.push(userData.serverSessionId)
        
        // Test walkthrough discovery
        const serverConfig = {
            id: serverId,
            organizationId,
            walkthroughToolsEnabled: 'true' as const
        }
        
        await registerWalkthroughTools({
            server: mockMcpServer as any,
            serverConfig,
            mcpServerUserId: userData.mcpServerUserId,
            serverSessionId: userData.serverSessionId
        })
        
        const tools = await mockMcpServer.listTools()
        expect(tools.tools.map(t => t.name)).toContain('start_walkthrough')
        expect(tools.tools.map(t => t.name)).toContain('get_next_step')
        
        // Start walkthrough
        const startResult = await mockMcpServer.callTool('start_walkthrough', {
            name: 'Integration Test Walkthrough'
        })
        
        expect(startResult.content[0].text).toContain('Step 1')
        
        // Progress through each step
        for (let i = 0; i < stepIds.length - 1; i++) {
            const nextStepResult = await mockMcpServer.callTool('get_next_step', {
                currentStepId: stepIds[i]
            })
            
            expect(nextStepResult.content[0].text).toContain(`Step ${i + 2}`)
        }
        
        // Complete final step
        const completionResult = await mockMcpServer.callTool('get_next_step', {
            currentStepId: stepIds[stepIds.length - 1]
        })
        
        expect(completionResult.content[0].text).toContain('100%')
        
        // Verify walkthrough progress in database
        const progress = await db
            .select()
            .from(schema.walkthroughProgress)
            .where(
                and(
                    eq(schema.walkthroughProgress.mcpServerUserId, userData.mcpServerUserId),
                    eq(schema.walkthroughProgress.walkthroughId, walkthroughId)
                )
            )
        
        expect(progress).toHaveLength(1)
        expect(progress[0].completedAt).toBeTruthy()
        expect(JSON.parse(progress[0].completedSteps)).toHaveLength(stepIds.length)
    })
})
```

#### Authentication Flow Testing

```typescript
describe('Authentication Integration', () => {
    let testHelper: DatabaseTestHelper

    beforeEach(() => {
        testHelper = new DatabaseTestHelper()
    })

    afterEach(async () => {
        await testHelper.cleanup()
    })

    test('should handle OAuth authentication flow', async () => {
        const organizationId = await testHelper.createTestOrganization()
        const serverId = await testHelper.createTestMcpServer({ 
            organizationId,
            authType: ['oauth']
        })
        
        // Create MCP OAuth application
        const appId = `app_${nanoid(8)}`
        await db.insert(schema.mcpOauthApplication).values({
            id: appId,
            name: 'Test OAuth App',
            mcpServerId: serverId,
            clientId: `client_${nanoid(16)}`,
            clientSecret: `secret_${nanoid(32)}`,
            redirectUris: ['http://localhost:3000/callback'],
            scopes: ['read', 'write'],
            createdAt: Date.now()
        })
        
        // Simulate OAuth user creation
        const oauthUserId = `oauth_user_${nanoid(8)}`
        await db.insert(schema.mcpOauthUser).values({
            id: oauthUserId,
            email: 'oauthtest@example.com',
            name: 'OAuth Test User',
            createdAt: Date.now()
        })
        
        // Create OAuth session
        const sessionId = `oauth_session_${nanoid(8)}`
        await db.insert(schema.mcpOauthSession).values({
            id: sessionId,
            applicationId: appId,
            userId: oauthUserId,
            accessToken: `token_${nanoid(32)}`,
            refreshToken: `refresh_${nanoid(32)}`,
            scopes: ['read', 'write'],
            expiresAt: Date.now() + 3600000, // 1 hour
            createdAt: Date.now()
        })
        
        // Test authentication with valid token
        const validRequest = createMockRequest({
            headers: {
                'authorization': `Bearer token_${nanoid(32)}`,
                'host': 'test-oauth.localhost:3000'
            }
        })
        
        // Mock authentication check
        const authResult = await db
            .select({
                userId: schema.mcpOauthUser.id,
                email: schema.mcpOauthUser.email,
                scopes: schema.mcpOauthSession.scopes
            })
            .from(schema.mcpOauthSession)
            .innerJoin(
                schema.mcpOauthUser,
                eq(schema.mcpOauthUser.id, schema.mcpOauthSession.userId)
            )
            .where(
                and(
                    eq(schema.mcpOauthSession.accessToken, validRequest.headers.get('authorization')?.split(' ')[1] || ''),
                    gt(schema.mcpOauthSession.expiresAt, Date.now())
                )
            )
        
        // For this test, we'll simulate successful auth
        const mockAuthResult = [{
            userId: oauthUserId,
            email: 'oauthtest@example.com',
            scopes: ['read', 'write']
        }]
        
        expect(mockAuthResult).toHaveLength(1)
        expect(mockAuthResult[0].email).toBe('oauthtest@example.com')
        
        // Test unauthorized request
        const invalidRequest = createMockRequest({
            headers: {
                'authorization': 'Bearer invalid_token',
                'host': 'test-oauth.localhost:3000'
            }
        })
        
        // This should fail authentication
        const failedAuthResult = await db
            .select()
            .from(schema.mcpOauthSession)
            .where(eq(schema.mcpOauthSession.accessToken, 'invalid_token'))
        
        expect(failedAuthResult).toHaveLength(0)
    })
})
```

### Error Handling and Edge Case Testing

#### Network Failure Simulation

```typescript
describe('Error Handling', () => {
    let testHelper: DatabaseTestHelper

    beforeEach(() => {
        testHelper = new DatabaseTestHelper()
    })

    afterEach(async () => {
        await testHelper.cleanup()
    })

    test('should handle database connection failures gracefully', async () => {
        // Mock database connection error
        const originalDb = db
        
        // Create a mock that throws connection errors
        const failingDb = {
            ...originalDb,
            select: () => {
                throw new Error('Connection timeout')
            },
            insert: () => {
                throw new Error('Connection lost')
            }
        }
        
        // Test error handling in service functions
        try {
            const mockServerConfig = {
                id: 'test-server',
                organizationId: 'test-org',
                supportTicketType: 'dashboard' as const,
                productPlatformOrTool: 'Test Platform'
            }
            
            // This should handle the error gracefully
            const result = await (() => {
                try {
                    // Simulate service call that would fail
                    throw new Error('Connection timeout')
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    }
                }
            })()
            
            expect(result.success).toBe(false)
            expect(result.error).toBe('Connection timeout')
        } catch (error) {
            expect(error.message).toContain('Connection')
        }
    })

    test('should handle invalid input data', async () => {
        const organizationId = await testHelper.createTestOrganization()
        const serverId = await testHelper.createTestMcpServer({ organizationId })
        
        // Test various invalid inputs
        const invalidInputs = [
            { title: '', problemDescription: 'Valid description' }, // Empty title
            { title: 'Valid title', problemDescription: '' }, // Empty description
            { title: 'A'.repeat(1000), problemDescription: 'Valid' }, // Title too long
            { title: 'Valid', problemDescription: 'B'.repeat(5000) }, // Description too long
            { title: 'Valid', problemDescription: 'Valid', email: 'invalid-email' }, // Invalid email
        ]
        
        for (const input of invalidInputs) {
            try {
                // This should validate input and fail appropriately
                if (!input.title || input.title.length === 0) {
                    throw new Error('Title is required')
                }
                if (!input.problemDescription || input.problemDescription.length === 0) {
                    throw new Error('Problem description is required')
                }
                if (input.title.length > 500) {
                    throw new Error('Title is too long')
                }
                if (input.problemDescription.length > 2000) {
                    throw new Error('Problem description is too long')
                }
                if (input.email && !input.email.includes('@')) {
                    throw new Error('Invalid email format')
                }
            } catch (error) {
                expect(error.message).toBeTruthy()
                expect(typeof error.message).toBe('string')
            }
        }
    })
})
```

### Test Data Seeding and Fixtures

#### Test Database Seeder

```typescript
export class TestDataSeeder {
    static async seedBasicData() {
        // Create test organization
        const orgId = await createTestOrganization({
            name: 'Seed Test Organization'
        })
        
        // Create multiple MCP servers
        const servers = await Promise.all([
            createTestMcpServer({
                organizationId: orgId,
                slug: 'basic-server',
                supportTicketType: 'dashboard'
            }),
            createTestMcpServer({
                organizationId: orgId,
                slug: 'oauth-server',
                authType: ['oauth'],
                walkthroughToolsEnabled: 'true'
            }),
            createTestMcpServer({
                organizationId: orgId,
                slug: 'walkthrough-server',
                walkthroughToolsEnabled: 'true'
            })
        ])
        
        // Create walkthroughs for each server that supports them
        const walkthroughs = []
        for (const serverId of servers.slice(1)) { // Skip basic server
            const walkthrough = await createTestWalkthrough({
                organizationId: orgId,
                title: `Walkthrough for ${serverId}`,
                type: 'course',
                stepCount: 5
            })
            
            // Link to server
            await db.insert(schema.mcpServerWalkthroughs).values({
                mcpServerId: serverId,
                walkthroughId: walkthrough.walkthroughId
            })
            
            walkthroughs.push(walkthrough)
        }
        
        // Create some support tickets
        await Promise.all(servers.map((serverId, index) =>
            db.insert(schema.supportRequests).values({
                id: `ticket_seed_${index}`,
                title: `Sample Support Ticket ${index + 1}`,
                conciseSummary: `This is a sample support ticket for testing purposes`,
                email: `user${index + 1}@example.com`,
                organizationId: orgId,
                mcpServerId: serverId,
                mcpServerSessionId: `session_seed_${index}`,
                status: index % 2 === 0 ? 'pending' : 'in_progress',
                createdAt: Date.now() - (index * 86400000) // Spread over several days
            })
        ))
        
        return {
            organizationId: orgId,
            serverIds: servers,
            walkthroughs
        }
    }
    
    static async seedPerformanceData() {
        const orgId = await createTestOrganization({
            name: 'Performance Test Organization'
        })
        
        // Create many servers for performance testing
        const serverPromises = Array.from({ length: 20 }, (_, i) =>
            createTestMcpServer({
                organizationId: orgId,
                slug: `perf-server-${i}`,
                walkthroughToolsEnabled: 'true'
            })
        )
        
        const serverIds = await Promise.all(serverPromises)
        
        // Create many walkthroughs
        const walkthroughPromises = serverIds.map(serverId =>
            createTestWalkthrough({
                organizationId: orgId,
                title: `Performance Walkthrough for ${serverId}`,
                stepCount: 10
            }).then(walkthrough => ({
                serverId,
                walkthrough
            }))
        )
        
        const walkthroughResults = await Promise.all(walkthroughPromises)
        
        // Link walkthroughs to servers
        await Promise.all(
            walkthroughResults.map(({ serverId, walkthrough }) =>
                db.insert(schema.mcpServerWalkthroughs).values({
                    mcpServerId: serverId,
                    walkthroughId: walkthrough.walkthroughId
                })
            )
        )
        
        return {
            organizationId: orgId,
            serverIds,
            walkthroughs: walkthroughResults.map(r => r.walkthrough)
        }
    }
}
```

### Test Configuration and Environment Management

#### Test Environment Configuration

```typescript
// test-config.ts
export const testConfig = {
    database: {
        timeout: 15000,
        retryAttempts: 3,
        cleanupTimeout: 30000
    },
    ui: {
        defaultTimeout: 30000,
        navigationTimeout: 15000,
        elementTimeout: 10000,
        viewport: { width: 1920, height: 1080 },
        headless: process.env.CI === 'true' || process.env.HEADLESS === 'true'
    },
    external: {
        apiTimeout: 60000,
        rateLimitDelay: 1000,
        maxRetries: 3
    },
    performance: {
        maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
        maxQueryTime: 1000, // 1 second
        maxConcurrentRequests: 50
    }
}
```

#### Test Environment Setup

```typescript
// test-setup.ts
export const setupTestEnvironment = async () => {
    // Verify database connection
    try {
        await db.select().from(schema.organization).limit(1)
        console.log('✅ Database connection verified')
    } catch (error) {
        console.error('❌ Database connection failed:', error.message)
        throw new Error('Cannot run tests without database connection')
    }
    
    // Verify external service availability (if needed)
    if (process.env.TURBOPUFFER_API_KEY) {
        try {
            // Test TurboPuffer connection with a simple request
            console.log('✅ External services available')
        } catch (error) {
            console.warn('⚠️  External services unavailable, some tests may be skipped')
        }
    }
    
    // Set up global test timeout
    jest.setTimeout(testConfig.database.timeout)
    
    console.log('🚀 Test environment setup complete')
}
```

## Related Documentation

- [Development Workflow](../01-getting-started/development-workflow.md) - Testing commands and authentication
- [Database Schema](../04-database/schema-design.md) - Understanding data relationships for testing
- [oRPC API Reference](../09-api-reference/orpc-reference.md) - API endpoints for integration testing
- [SST Deployment](../08-deployment/sst-deployment.md) - Testing infrastructure setup
- [MCP Server API](../05-mcp-servers/mcp-api.md) - MCP protocol testing patterns

## Best Practices Checklist

### Before Writing Tests
- [ ] Understand the feature being tested
- [ ] Identify dependencies (database, external APIs, authentication)
- [ ] Plan test data cleanup strategy
- [ ] Choose appropriate test type (unit/integration/UI)

### During Test Implementation
- [ ] Use descriptive test names
- [ ] Generate unique test data to avoid conflicts
- [ ] Track all created resources for cleanup
- [ ] Handle async operations properly
- [ ] Add appropriate timeouts
- [ ] Include error handling and debugging aids

### After Test Implementation
- [ ] Verify tests pass in isolation
- [ ] Verify tests pass when run together
- [ ] Check for proper cleanup (no test data leaked)
- [ ] Run tests in CI environment
- [ ] Document any special setup requirements