# Dual Authentication System

MCPlatform implements two completely separate authentication systems to serve different user types and maintain clean security boundaries.

## Architecture Overview

MCPlatform uses **two parallel and independent** Better Auth instances:

1. **Platform Authentication**: For dashboard users (our customers)
2. **Sub-tenant Authentication**: For end-users (customers' users accessing MCP servers)

```
┌─────────────────────┐    ┌─────────────────────┐
│   Platform Auth     │    │  Sub-tenant Auth    │
│                     │    │                     │
│ Dashboard Users     │    │ End-users (OAuth)   │
│ Organization Owners │    │ De-anonymization    │
│ Team Members        │    │ Email Capture       │
│                     │    │                     │
│ Full Access         │    │ NO Dashboard Access │
└─────────────────────┘    └─────────────────────┘
```

## Why Two Systems?

### Business Requirements

1. **Clean Separation**: Dashboard users should never mix with end-users
2. **De-anonymization**: Capture end-user emails via OAuth without giving dashboard access
3. **Scalability**: Each system optimized for different use patterns
4. **Security**: Separate attack surfaces and privilege boundaries

### Technical Benefits

- **Independent schemas**: No foreign key conflicts between user types
- **Separate sessions**: Different session management strategies
- **Isolated failures**: Issues in one system don't affect the other
- **Different auth flows**: Dashboard uses email/password, MCP uses OAuth-only

## System 1: Platform Authentication

**Purpose**: Manage access to the MCPlatform dashboard where customers create and manage their MCP servers.

### Database Schema

Located in `packages/database/src/auth-schema.ts`:

```typescript
export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified')
        .$defaultFn(() => false)
        .notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
})

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    userId: text('user_id').notNull().references(() => user.id),
    activeOrganizationId: text('active_organization_id') // Multi-tenant support
})
```

### Better Auth Configuration

Located in `packages/dashboard/src/lib/auth/auth.ts`:

```typescript
export const auth = betterAuth({
    database: db,
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
        }
    },
    plugins: [
        organization({
            // Multi-tenant organization support
            allowUserToCreateOrganization: true,
            organizationLimit: 5
        })
    ]
})
```

### Authentication Flow

1. **Registration/Login**: Via dashboard at `/auth/login`
2. **Session Management**: Standard web sessions with cookies
3. **Organization Assignment**: Users belong to organizations (multi-tenancy)
4. **Role-based Access**: Different permissions within organizations

### Usage in Code

```typescript
// Server-side session check
import { requireSession } from '@/lib/auth'

export default async function DashboardPage() {
    const session = await requireSession()
    // User has verified access to dashboard
    return <Dashboard user={session.user} />
}

// Client-side hooks
import { useSession } from '@/lib/auth/client'

export function UserProfile() {
    const { data: session, loading } = useSession()
    if (loading) return <Spinner />
    return <div>Welcome {session?.user.name}</div>
}
```

## System 2: Sub-tenant Authentication 

**Purpose**: De-anonymize end-users when they interact with MCP servers through OAuth, without granting dashboard access.

### Database Schema

Located in `packages/database/src/mcp-auth-schema.ts`:

```typescript
export const mcpOAuthUser = pgTable('mcp_oauth_user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),  // Key de-anonymization data
    emailVerified: boolean('email_verified')
        .$defaultFn(() => false)
        .notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').notNull(),
    updatedAt: timestamp('updated_at').notNull()
})

export const mcpOAuthSession = pgTable('mcp_oauth_session', {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    userId: text('user_id').notNull().references(() => mcpOAuthUser.id)
    // NO activeOrganizationId - these users don't belong to organizations
})
```

**Key Differences**:
- **Separate user table**: `mcp_oauth_user` vs `user`
- **No organization linking**: End-users don't belong to organizations
- **OAuth-only**: No email/password authentication
- **Limited session data**: Just identity, no permissions

### Better Auth Configuration

Located in `packages/dashboard/src/lib/auth/mcp/auth.ts`:

```typescript
export const mcpAuth = betterAuth({
    database: db,
    tables: {
        user: 'mcp_oauth_user',
        session: 'mcp_oauth_session',
        // Map to MCP-specific tables
    },
    emailAndPassword: {
        enabled: false  // OAuth only
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!
        }
    },
    plugins: [
        mcp({
            // Custom MCP plugin for end-user management
        })
    ]
})
```

### Authentication Flow

1. **OAuth Initiation**: End-user clicks "Login with GitHub/Google" in MCP interface
2. **Redirect to MCP Auth**: Uses `/mcp-oidc/login` endpoint (NOT `/auth/login`)
3. **OAuth Completion**: Captures email and basic profile
4. **Session Creation**: Creates MCP-specific session
5. **Return to MCP**: User identity available to MCP server tools

### Usage Pattern

```typescript
// MCP server tool with user identity
export async function createSupportTicket(args: {
    message: string
}, { mcpServerUserId, email }: McpContext) {
    // mcpServerUserId comes from MCP auth session
    // email is the captured OAuth email
    
    const ticket = await db.insert(supportRequests).values({
        message: args.message,
        email: email,  // De-anonymized user
        mcpServerId: getCurrentMcpServer().id
    })
    
    return { ticketId: ticket.id }
}
```

## Session Management

### Platform Sessions

```typescript
// Platform sessions use standard cookies
// Domain: naptha.gg
// Path: /
// Secure: true
// HttpOnly: true
// SameSite: 'lax'

Cookie: better-auth.session.token=abc123...
```

### MCP Sessions

```typescript
// MCP sessions are scoped to subdomains
// Domain: *.naptha.gg
// Path: /api/mcpserver
// Secure: true
// HttpOnly: true
// SameSite: 'none' (for cross-origin MCP tools)

Cookie: mcp-auth.session.token=def456...
```

## Cross-System Interactions

### No Direct Relationship

The two systems are **completely independent**:
- **No foreign keys** between user tables
- **No shared sessions** or tokens
- **No permission inheritance**
- **Separate login flows**

### Indirect Relationships

Connections exist only through business logic:

```typescript
// MCP server belongs to organization (platform auth)
// End-user interactions are logged with MCP server ID
// Analytics connect the dots without direct user linking

interface SupportRequest {
    id: string
    mcpServerId: string        // Links to platform auth world
    email: string             // From MCP auth world
    message: string
    // No direct user_id foreign key!
}
```

## Security Model

### Privilege Separation

| System | Access | Capabilities |
|--------|--------|--------------|
| Platform Auth | Dashboard, Admin APIs | Create/manage MCP servers, view analytics, team management |
| MCP Auth | MCP tools only | Identity for de-anonymization, no admin capabilities |

### Attack Surface Isolation

- **Separate endpoints**: Different login URLs and API routes
- **Independent tokens**: Compromising one system doesn't affect the other
- **Different TLS contexts**: Separate certificate scopes
- **Isolated database access**: Different connection patterns

### Data Flow Security

```
End User OAuth → MCP Auth → Email Capture → Analytics DB
                     ↕️ NO DIRECT CONNECTION ↕️
Platform User → Platform Auth → Dashboard Access → MCP Server Management
```

## Configuration

### Environment Variables

Both systems share OAuth provider credentials but maintain separate sessions:

```bash
# Shared OAuth providers
GITHUB_CLIENT_ID=Iv1.abc123
GITHUB_CLIENT_SECRET=secret123
GOOGLE_CLIENT_ID=123.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-secret

# Platform auth
BETTER_AUTH_SECRET=platform-secret-32-chars
NEXT_PUBLIC_BETTER_AUTH_URL=https://naptha.gg

# MCP auth uses same URL but different endpoints
# /auth/* → Platform auth
# /mcp-oidc/* → MCP auth
```

### OAuth App Configuration

**GitHub OAuth App**:
- Homepage URL: `https://naptha.gg`
- Callback URLs:
  - `https://naptha.gg/api/auth/callback/github` (Platform)
  - `https://*.naptha.gg/api/mcp-oidc/callback/github` (MCP)

**Google OAuth App**:
- Authorized origins: `https://naptha.gg`, `https://*.naptha.gg`
- Callback URLs:
  - `https://naptha.gg/api/auth/callback/google` (Platform)  
  - `https://*.naptha.gg/api/mcp-oidc/callback/google` (MCP)

## Implementation Examples

### Platform Auth in Action

```typescript
// pages/dashboard/page.tsx
export default async function DashboardPage() {
    const session = await requireSession() // Platform auth
    
    const organizations = await getOrganizationsForUser(session.user.id)
    
    return <Dashboard organizations={organizations} />
}
```

### MCP Auth in Action

```typescript
// MCP server tool
export async function getUserData(args: {}, context: McpContext) {
    // context.email comes from MCP auth OAuth flow
    // context.mcpServerUserId is MCP auth user ID
    
    if (!context.email) {
        return { 
            error: 'Please login to access this feature',
            loginUrl: '/mcp-oidc/login'
        }
    }
    
    return {
        message: `Hello ${context.email}! You are authenticated.`
    }
}
```

## Development and Testing

### Local Development

Both auth systems work in local development:

```bash
# Start development server
bun run dev

# Platform auth: http://localhost:3000/auth/login
# MCP auth: http://your-slug.your-ngrok.ngrok-free.app/mcp-oidc/login
```

### Testing Authentication

```typescript
// Test platform auth
test('dashboard requires authentication', async () => {
    const response = await fetch('http://localhost:3000/dashboard')
    expect(response.status).toBe(302) // Redirect to login
})

// Test MCP auth  
test('mcp tools require oauth', async () => {
    const mcpRequest = {
        method: 'tools/call',
        params: { name: 'user_profile' }
    }
    
    const response = await fetch('https://test.localhost:3000/api/mcpserver', {
        method: 'POST',
        body: JSON.stringify(mcpRequest)
    })
    
    const result = await response.json()
    expect(result.error).toContain('Please login')
})
```

## Troubleshooting

### Common Issues

1. **Wrong login endpoint**:
   - Dashboard users: Use `/auth/login`
   - End-users: Use `/mcp-oidc/login`

2. **Session conflicts**:
   - Clear all cookies if sessions seem mixed
   - Check cookie domain scoping

3. **OAuth callback errors**:
   - Verify callback URLs in OAuth provider settings
   - Check wildcard domain configuration

### Debug Queries

```sql
-- Check platform users
SELECT count(*) FROM user;
SELECT * FROM session WHERE user_id = 'usr_123';

-- Check MCP users  
SELECT count(*) FROM mcp_oauth_user;
SELECT * FROM mcp_oauth_session WHERE user_id = 'mcp_usr_456';

-- No direct joins should exist between the systems!
```

## Related Documentation

- [VHost Routing Architecture](../02-architecture/vhost-routing.md)
- [Better Auth Integration Guide](./better-auth-guide.md)
- [Database Schema Design](../04-database/schema-design.md)
- [MCP Server API](../05-mcp-servers/mcp-api.md)