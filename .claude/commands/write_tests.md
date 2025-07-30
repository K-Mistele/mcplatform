# write_tests.md - MCPlatform Testing Guide

You are tasked with writing tests for the referenced feature, code defined by an implementation plan, or referenced file(s).

## Initial Response

When this command is invoked:

1. **Check if parameters were provided**:
   - If a feature idea, description, context, or rough specification was provided as a parameter, begin the discovery process with that context
   - If files are referenced, read them FULLY first to understand existing context
   - If no parameters provided, respond with the default prompt below

2. **If no parameters provided**, respond with:
```
I'm ready to help you define and write tests. Please provide a feature, implementation plan, file path(s) or directory, and I will analyze it thoroughly by exploring the codebase and proceed to write tests for it.

What feature or capability are you considering? This could be:
- A rough idea ("users need better ways to...")
- A specific feature request ("add support for...")
- A problem you've observed ("customers are struggling with...")
- A business opportunity ("we could provide value by...")

Don't worry about having all the details - we'll explore, refine, and create comprehensive specifications together!

Tip: You can also invoke this command with context: `/write_tests 09-example-feature`
```

Then wait for the user's input.

## Core Testing Principles


### 1. NEVER Mock What You're Testing
- **DON'T** mock the database, server actions, or oRPC calls.
- **DON'T** create fake implementations of core functionality
- **DON'T** duplicate existing code in the codebase. For example, if you are testing validateion for a schema, don't re-create it in the test file; import it from the code base. If it is not exported or is otherwise inaccessible, ask the user for permission to export or extract it.
- **DO** test the actual implementation that the application uses
- **DO** use real database connections and real auth flows

### 2. Write Integration Tests, Not Unit Tests
- Test the complete flow as users experience it
- If the app uses oRPC actions, test those actions directly by calling them as functions.
- Don't test "layers" - test features and functionality

### 3. One Test File Per Feature
- Name test files after the feature, not the implementation detail
- Place tests in `packages/dashboard/tests/[feature]`, or `packages/dashboard/tests/[feature]/[sub-feature]` for sub-features
- All test files should end with `.test.ts`
- Don't create separate test files for "actions", "schemas", "validation" etc.

## Test Setup

### Database Setup
```typescript
import { db, schema } from 'database'
import { nanoid } from 'common/nanoid'

// Use the real database - tests should run against a test database
// Create real records, don't mock them
const testOrg = await db.insert(schema.organization).values({
    id: `org_${nanoid(8)}`,
    name: 'Test Organization',
    slug: 'test-org',
    createdAt: new Date()
}).returning()
```

### Authentication Setup
```typescript
// Create real sessions and users in the database
const testUser = await db.insert(schema.user).values({
    id: `user_${nanoid(8)}`,
    email: 'test@example.com',
    emailVerified: true,
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date()
}).returning()

const testSession = await db.insert(schema.session).values({
    id: `sess_${nanoid(8)}`,
    userId: testUser[0].id,
    activeOrganizationId: testOrg[0].id,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    token: `token_${nanoid(16)}`,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
    updatedAt: new Date()
}).returning()
```

## Testing oRPC Actions

### Test the Actual Actions
```typescript
import { createWalkthroughAction } from '@/lib/orpc/actions'

// DON'T mock requireSession - set up real session data
// The action will read from the real database

test('should create walkthrough', async () => {
    // Call the actual action
    const [error, result] = await createWalkthroughAction({
        title: 'Test Walkthrough',
        type: 'course',
        isPublished: false
    })
    
    // Verify in the real database
    const created = await db.select()
        .from(schema.walkthroughs)
        .where(eq(schema.walkthroughs.id, result.id))
    
    expect(created[0].title).toBe('Test Walkthrough')
})
```

### Testing with Authentication Context
For actions that require authentication, you need to set up the auth context properly:

```typescript
import { headers } from 'next/headers'

// If testing server actions that use cookies/headers, you may need to:
// 1. Run tests in an environment that supports Next.js context
// 2. Or restructure actions to accept session as a parameter for testability
```

## Test Structure

### Good Test File Structure
```typescript
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { nanoid } from 'common/nanoid'
import { actualActionFromApp } from '@/lib/orpc/actions'

describe('Feature: Walkthrough Management', () => {
    // Track created resources for cleanup
    const cleanup = {
        organizations: [],
        users: [],
        sessions: [],
        walkthroughs: []
    }
    
    beforeAll(async () => {
        // Set up test data using real database
    })
    
    afterAll(async () => {
        // Clean up all created DB records reverse order of creation
        // Respect foreign key constraints
    })
    
    test('complete user flow for creating and editing walkthrough', async () => {
        // Test the actual flow a user would experience
        // Use real actions, verify real database state
    })
})
```

## What NOT to Do

### Bad Example - Mocking Everything
```typescript
// DON'T DO THIS
const mockDb = {
    insert: jest.fn().mockReturnValue({
        values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([{ id: 'fake' }])
        })
    })
}

// DON'T DO THIS
spyOn(authModule, 'requireSession').mockResolvedValue(mockSession)
```

### Bad Example - Testing Implementation Details
```typescript
// DON'T DO THIS - Testing schema validation separately
describe('Walkthrough Schema Validation', () => {
    test('should validate title length', () => {
        const schema = z.object({ title: z.string().max(100) })
        // This tests Zod, not your application
    })
})
```

### Bad Example - Duplicate Layer Tests
```typescript
// DON'T create these separate files:
// - database-operations.test.ts (tests direct DB calls)
// - schema-validation.test.ts (tests Zod schemas)  
// - orpc-actions.test.ts (tests server actions)
// - api-routes.test.ts (tests HTTP layer)

// DO create one file:
// - walkthrough-management.test.ts (tests the complete feature)
```

## Test Utilities

### Database Cleanup Helper
```typescript
async function cleanupTestData(cleanup: Record<string, string[]>) {
    // Clean up in reverse order to respect FK constraints
    const tables = ['walkthroughSteps', 'walkthroughs', 'sessions', 'users', 'organizations']
    
    for (const table of tables) {
        const ids = cleanup[table] || []
        for (const id of ids) {
            await db.delete(schema[table])
                .where(eq(schema[table].id, id))
                .catch(() => {}) // Ignore if already deleted
        }
    }
}
```

### Creating Test Context
```typescript
async function createTestContext() {
    const org = await db.insert(schema.organization).values({
        id: `org_${nanoid(8)}`,
        name: 'Test Org',
        slug: `test-${nanoid(8)}`,
        createdAt: new Date()
    }).returning()
    
    // Return real IDs that can be used in tests
    return { organizationId: org[0].id }
}
```

## Running Tests

```bash
# Run all tests
bun test --timeout 15000

# Run specific test file
bun test packages/dashboard/tests/03-interactive-walkthrough/walkthrough-crud.test.ts
```

### Helpful references for bun:test
- [`bun test`](https://bun.com/docs/cli/test.md): Bun's test runner uses Jest-compatible syntax but runs 100x faster.
- [Writing tests](https://bun.com/docs/test/writing.md): Write your tests using Jest-like expect matchers, plus setup/teardown hooks, snapshot testing, and more
- [Watch mode](https://bun.com/docs/test/hot.md): Reload your tests automatically on change.
- [Lifecycle hooks](https://bun.com/docs/test/lifecycle.md): Add lifecycle hooks to your tests that run before/after each test or test run
- [Mocks](https://bun.com/docs/test/mocks.md): Mocks functions and track method calls
- [Snapshots](https://bun.com/docs/test/snapshots.md): Add lifecycle hooks to your tests that run before/after each test or test run
- [Dates and times](https://bun.com/docs/test/time.md): Control the date & time in your tests for more reliable and deterministic tests
- [Code coverage](https://bun.com/docs/test/coverage.md): Generate code coverage reports with `bun test --coverage`
- [Test reporters](https://bun.com/docs/test/reporters.md): Add a junit reporter to your test runs
- [Test configuration](https://bun.com/docs/test/configuration.md): Configure the test runner with bunfig.toml
- [Runtime behavior](https://bun.com/docs/test/runtime-behavior.md): Learn how the test runner affects Bun's runtime behavior
- [Finding tests](https://bun.com/docs/test/discovery.md): Learn how the test runner discovers tests
- [DOM testing](https://bun.com/docs/test/dom.md): Write headless tests for UI and React/Vue/Svelte/Lit components with happy-dom

### Supported Matchers:
*   `.not`
*   `.toBe()`
*   `.toEqual()`
*   `.toBeNull()`
*   `.toBeUndefined()`
*   `.toBeNaN()`
*   `.toBeDefined()`
*   `.toBeFalsy()`
*   `.toBeTruthy()`
*   `.toContain()`
*   `.toContainAllKeys()`
*   `.toContainValue()`
*   `.toContainValues()`
*   `.toContainAllValues()`
*   `.toContainAnyValues()`
*   `.toStrictEqual()`
*   `.toThrow()`
*   `.toHaveLength()`
*   `.toHaveProperty()`
*   `.extend`
*   `.anything()`
*   `.any()`
*   `.arrayContaining()`
*   `.assertions()`
*   `.closeTo()`
*   `.hasAssertions()`
*   `.objectContaining()`
*   `.stringContaining()`
*   `.stringMatching()`
*   `.resolves()`
*   `.rejects()`
*   `.toHaveBeenCalled()`
*   `.toHaveBeenCalledTimes()`
*   `.toHaveBeenCalledWith()`
*   `.toHaveBeenLastCalledWith()`
*   `.toHaveBeenNthCalledWith()`
*   `.toHaveReturned()`
*   `.toHaveReturnedTimes()`
*   `.toBeCloseTo()`
*   `.toBeGreaterThan()`
*   `.toBeGreaterThanOrEqual()`
*   `.toBeLessThan()`
*   `.toBeLessThanOrEqual()`
*   `.toBeInstanceOf()`
*   `.toContainEqual()`
*   `.toMatch()`
*   `.toMatchObject()`
*   `.toMatchSnapshot()`
*   `.toMatchInlineSnapshot()`
*   `.toThrowErrorMatchingSnapshot()`
*   `.toThrowErrorMatchingInlineSnapshot()`

## Key Reminders

1. **Test what the app actually uses** - If the app calls oRPC actions, test those
2. **Use real database** - No mocking of database operations
3. **Clean up after tests** - Track created resources and delete them
4. **Test user flows** - Not technical implementation layers
5. **One test file per feature** - Not per technical concern
6. **Verify real state** - Check actual database records, not mocked returns
7. **Test error cases** - But with real errors from real operations

## Example: Complete Feature Test

```typescript
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { db, schema } from 'database'
import { 
    createWalkthroughAction,
    updateWalkthroughAction,
    deleteWalkthroughAction 
} from '@/lib/orpc/actions'

describe('Walkthrough CRUD Operations', () => {
    const cleanup = { walkthroughs: [] }
    
    test('should handle complete walkthrough lifecycle', async () => {
        // Create
        const [createError, walkthrough] = await createWalkthroughAction({
            title: 'API Integration Guide',
            type: 'integration',
            isPublished: false
        })
        
        expect(createError).toBeNull()
        expect(walkthrough.title).toBe('API Integration Guide')
        cleanup.walkthroughs.push(walkthrough.id)
        
        // Update
        const [updateError, updated] = await updateWalkthroughAction({
            walkthroughId: walkthrough.id,
            title: 'Updated API Guide',
            isPublished: true
        })
        
        expect(updateError).toBeNull()
        expect(updated.title).toBe('Updated API Guide')
        expect(updated.status).toBe('published')
        
        // Verify in database
        const [dbRecord] = await db.select()
            .from(schema.walkthroughs)
            .where(eq(schema.walkthroughs.id, walkthrough.id))
        
        expect(dbRecord.title).toBe('Updated API Guide')
        expect(dbRecord.status).toBe('published')
        
        // Delete
        const [deleteError] = await deleteWalkthroughAction({
            walkthroughId: walkthrough.id
        })
        
        expect(deleteError).toBeNull()
        
        // Verify deletion
        const deleted = await db.select()
            .from(schema.walkthroughs)
            .where(eq(schema.walkthroughs.id, walkthrough.id))
        
        expect(deleted.length).toBe(0)
    })
    
    afterAll(async () => {
        // Cleanup any remaining test data
        for (const id of cleanup.walkthroughs) {
            await db.delete(schema.walkthroughs)
                .where(eq(schema.walkthroughs.id, id))
                .catch(() => {})
        }
    })
})
```

Remember: **Test the real thing, not a mock of the thing.**