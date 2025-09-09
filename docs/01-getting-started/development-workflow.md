# Development Workflow Guide

This guide covers daily development patterns and best practices for working with MCPlatform.

## Daily Development Flow

### 1. Starting Your Day

```bash
# Check git status and pull latest changes
git status
git pull origin master

# Start development environment (if not already running)
bun run dev

# Verify everything is working
curl http://localhost:3000/api/health
```

### 2. Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... edit files in packages/dashboard/src/

# Format code
bun lint

# Test changes
bun run tests
```

### 3. Committing Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add user management interface"

# Push to remote
git push origin feature/your-feature-name
```

## File Organization

### Component Structure

All React components go in `packages/dashboard/src/components/`:

```
packages/dashboard/src/components/
├── ui/                    # shadcn/ui components
├── forms/                 # Form components
├── layouts/               # Layout components
├── features/              # Feature-specific components
│   ├── auth/
│   ├── mcp-servers/
│   └── organizations/
└── shared/                # Shared utility components
```

### Page Structure

Pages go in `packages/dashboard/src/app/`:

```
packages/dashboard/src/app/
├── (auth)/               # Auth-protected routes
│   ├── dashboard/
│   ├── mcp-servers/
│   └── organizations/
├── api/                  # API routes
├── auth/                 # Auth pages (login, etc.)
├── page.tsx              # Root page
└── layout.tsx            # Root layout
```

### File Naming Conventions

| File Type | Convention | Example |
|-----------|------------|---------|
| Pages | `page.tsx` | `dashboard/page.tsx` |
| Layouts | `layout.tsx` | `dashboard/layout.tsx` |
| Components | `kebab-case.tsx` | `user-profile.tsx` |
| API Routes | `route.ts` | `api/users/route.ts` |
| Utilities | `kebab-case.ts` | `auth-utils.ts` |
| Types | `kebab-case.types.ts` | `user.types.ts` |

## Code Organization Patterns

### Server Components (Pages)

Pages are async server components that handle data fetching:

```typescript
// packages/dashboard/src/app/dashboard/page.tsx
import { Suspense } from 'react'
import { requireSession } from '@/lib/auth'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import { getOrganizations } from '@/lib/data/organizations'

export default async function DashboardPage() {
    // Authentication check
    const session = await requireSession()
    
    // Data fetching (return promises, not resolved data)
    const organizationsPromise = getOrganizations(session.user.id)
    
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DashboardClient 
                organizationsPromise={organizationsPromise}
                userId={session.user.id}
            />
        </Suspense>
    )
}
```

### Client Components

Client components use React 19 `use()` hook to unwrap promises:

```typescript
// packages/dashboard/src/components/dashboard/dashboard-client.tsx
'use client'

import { use } from 'react'
import type { Organization } from '@/lib/types'

interface DashboardClientProps {
    organizationsPromise: Promise<Organization[]>
    userId: string
}

export function DashboardClient({ organizationsPromise, userId }: DashboardClientProps) {
    const organizations = use(organizationsPromise)
    
    return (
        <div>
            <h1>Dashboard</h1>
            {organizations.map(org => (
                <div key={org.id}>{org.name}</div>
            ))}
        </div>
    )
}
```

### Import Organization

Group imports in this order:

```typescript
// 1. External libraries
import React from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'

// 2. Internal aliases (@/)
import { requireSession } from '@/lib/auth'
import { UserProfile } from '@/components/user/user-profile'

// 3. Relative imports
import './styles.css'
import { validateInput } from '../utils/validation'
```

## Data Layer Patterns

### Database Queries (Server)

Direct database queries in server components:

```typescript
// packages/dashboard/src/lib/data/users.ts
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getUserById(id: string) {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1)
    
    return user
}
```

### Server Actions (Mutations)

Use oRPC for all data mutations:

```typescript
// packages/dashboard/src/lib/orpc/actions/users.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { base } from '../base'
import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'

const updateUserSchema = z.object({
    name: z.string().min(1),
    email: z.string().email()
})

export const updateUser = base
    .input(updateUserSchema)
    .handler(async ({ input, errors }) => {
        const session = await requireSession()
        
        // Validation
        if (!input.name) {
            throw errors.VALIDATION_ERROR({ message: 'Name is required' })
        }
        
        // Update user
        const [updatedUser] = await db
            .update(users)
            .set({ name: input.name, email: input.email })
            .where(eq(users.id, session.user.id))
            .returning()
        
        // Revalidate affected pages
        revalidatePath('/dashboard/profile')
        
        return updatedUser
    })
    .actionable({})
```

### Client Usage

Use server actions in client components:

```typescript
// packages/dashboard/src/components/user/user-form.tsx
'use client'

import { useServerAction } from '@orpc/react/hooks'
import { onSuccess, onError } from '@orpc/client'
import { updateUser } from '@/lib/orpc/actions/users'
import { toast } from 'sonner'

export function UserForm() {
    const { execute, status } = useServerAction(updateUser, {
        interceptors: [
            onSuccess((data) => {
                toast.success('Profile updated successfully')
            }),
            onError((error) => {
                toast.error(error.message)
            })
        ]
    })
    
    return (
        <form action={execute}>
            <input name="name" required />
            <input name="email" type="email" required />
            <button 
                type="submit" 
                disabled={status === 'pending'}
            >
                {status === 'pending' ? 'Saving...' : 'Save'}
            </button>
        </form>
    )
}
```

## Testing Workflow

### Test Organization

```
packages/dashboard/tests/
├── 01-authentication/
│   ├── login.test.ts
│   ├── oauth.test.ts
│   └── session.test.ts
├── 02-mcp-servers/
│   ├── create-server.test.ts
│   └── vhost-routing.test.ts
└── 03-organizations/
    └── membership.test.ts
```

### Writing Tests

```typescript
// packages/dashboard/tests/01-authentication/login.test.ts
import { test, expect, describe } from 'bun:test'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'

describe('Authentication', () => {
    test('should create user on first login', async () => {
        // Test setup
        const testEmail = 'test@example.com'
        
        // Test logic
        const [user] = await db
            .insert(users)
            .values({ email: testEmail, name: 'Test User' })
            .returning()
        
        // Assertions
        expect(user.email).toBe(testEmail)
        expect(user.name).toBe('Test User')
        
        // Cleanup
        await db.delete(users).where(eq(users.id, user.id))
    })
})
```

### Running Tests

```bash
# Run all tests
bun run tests

# Run specific feature tests
bun run tests packages/dashboard/tests/01-authentication/

# Run with pattern matching
bun run tests --grep "authentication"

# Run single test file
bun run tests packages/dashboard/tests/01-authentication/login.test.ts

# Run with extended timeout
bun test --timeout 30000
```

### UI Testing with Puppeteer

```typescript
// packages/dashboard/tests/ui/dashboard.test.ts
import { test, expect } from 'bun:test'
import puppeteer from 'puppeteer'

test('dashboard loads correctly', async () => {
    const browser = await puppeteer.launch({
        headless: true,
        userDataDir: '/Users/kyle/Library/Application Support/Google/Chrome/Default'
    })
    
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    
    // Auto-login endpoint for testing
    await page.goto('http://localhost:3000/login-for-claude')
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="dashboard"]', { timeout: 5000 })
    
    // Verify content
    const title = await page.$eval('h1', el => el.textContent)
    expect(title).toBe('Dashboard')
    
    await browser.close()
})
```

## Git Workflow

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/user-dashboard` |
| Bug Fix | `fix/description` | `fix/auth-redirect-loop` |
| Docs | `docs/description` | `docs/api-reference` |
| Refactor | `refactor/description` | `refactor/database-schema` |

### Commit Messages

Follow conventional commits:

```bash
feat: add user profile management
fix: resolve OAuth callback redirect issue
docs: update authentication guide
refactor: simplify database connection logic
test: add MCP server integration tests
```

### Pull Request Workflow

1. **Create feature branch**:
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes and test**:
   ```bash
   # Make changes
   bun lint
   bun run tests
   ```

3. **Commit and push**:
   ```bash
   git add .
   git commit -m "feat: descriptive message"
   git push origin feature/your-feature
   ```

4. **Create pull request** with:
   - Descriptive title
   - Summary of changes
   - Screenshots for UI changes
   - Testing instructions

## Environment Management

### Development Stages

| Stage | Domain | Purpose |
|-------|--------|---------|
| Local | `localhost:3000` | Local development |
| Dev | `dev.naptha.gg` | Shared development |
| Staging | `staging.naptha.gg` | Pre-production testing |
| Production | `naptha.gg` | Live application |

### Environment Variables by Stage

```bash
# Local development
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# Development stage  
NEXT_PUBLIC_BETTER_AUTH_URL=https://dev.naptha.gg

# Production
NEXT_PUBLIC_BETTER_AUTH_URL=https://naptha.gg
```

### Switching Stages

```bash
# Deploy to specific stage
sst deploy --stage staging

# Remove stage resources
sst remove --stage dev

# View current stage
sst env
```

## Code Quality Guidelines

### TypeScript Usage

- **Strict mode** enabled in all packages
- **Explicit types** for public APIs
- **Inference** for obvious cases
- **Zod schemas** for runtime validation

### Component Guidelines

- **One component per file**
- **Clear prop interfaces**
- **Descriptive names**
- **Consistent file structure**

### Performance Considerations

- **Use React.memo** for expensive components
- **Implement proper loading states**
- **Optimize database queries**
- **Cache frequently accessed data**

## Debugging Workflow

### Common Debug Tools

```bash
# Database inspection
bun run studio

# View logs in SST
sst logs

# Test API endpoints
curl http://localhost:3000/api/health

# Check environment variables
bun sst shell -- printenv
```

### Frontend Debugging

- **Browser DevTools** for client-side issues
- **Next.js DevTools** for React debugging
- **Network tab** for API request issues
- **Console logs** for server component debugging

### Backend Debugging

- **SST Console** for AWS logs
- **Database Studio** for data inspection
- **Inngest Dashboard** for background jobs
- **CloudWatch** for production issues

## Next Steps

- Learn [VHost Routing Architecture](../02-architecture/vhost-routing.md)
- Understand [Authentication Systems](../03-authentication/dual-auth-system.md)
- Review [Database Schema Design](../04-database/schema-design.md)
- Study [Testing Patterns](../07-testing/testing-guide.md)