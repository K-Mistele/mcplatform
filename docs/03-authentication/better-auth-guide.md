# Better Auth Integration Guide

This guide covers the integration of Better Auth v1 in MCPlatform, including CLI commands, schema management, and plugin configuration.

## Better Auth Overview

Better Auth is a comprehensive authentication library for TypeScript applications. MCPlatform uses Better Auth v1 with:
- **Dual instances**: Separate auth systems for platform and MCP users
- **Drizzle ORM integration**: Type-safe database operations  
- **Plugin architecture**: Organization and MCP-specific plugins
- **OAuth providers**: GitHub and Google integration

## CLI Commands

Better Auth provides CLI commands for schema generation and management.

### Schema Generation

⚠️ **IMPORTANT**: Never run these commands without explicit permission. Database changes require coordination.

```bash
# Navigate to dashboard package
cd packages/dashboard

# Generate auth tables (ASK FIRST)
bunx @better-auth/cli generate

# Generate with specific database
bunx @better-auth/cli generate --database postgres

# Generate for custom auth instance
bunx @better-auth/cli generate --config ./lib/auth/mcp/auth.ts
```

### Migration Workflow

Better Auth integrates with the existing Drizzle migration system:

```bash
# 1. Generate Better Auth schema changes
bunx @better-auth/cli generate

# 2. This updates the auth schema files
# packages/database/src/auth-schema.ts
# packages/database/src/mcp-auth-schema.ts

# 3. Generate Drizzle migrations (ASK FIRST)
cd packages/database
bun run db:generate

# 4. Run migrations (ASK FIRST)  
bun run db:migrate
```

## Schema Architecture

### Auto-generated vs Custom Schemas

Better Auth generates base schemas, but MCPlatform extends them:

**Auto-generated** (`generated` by Better Auth CLI):
```typescript
// Base user table structure
export const user = pgTable('user', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    // ... standard Better Auth fields
})
```

**Custom extensions** (`packages/database/src/auth-schema.ts`):
```typescript
export const session = pgTable('session', {
    // ... Better Auth standard fields
    activeOrganizationId: text('active_organization_id')
        .references(() => organization.id), // Custom field
    ipAddress: text('ip_address'),         // Custom tracking
    userAgent: text('user_agent')          // Custom tracking
})
```

### Schema Separation

MCPlatform maintains two separate auth schemas:

1. **Platform Schema** (`auth-schema.ts`):
   - Tables: `user`, `session`, `account`, `verification`, `organization`
   - Purpose: Dashboard authentication and multi-tenancy

2. **MCP Schema** (`mcp-auth-schema.ts`):
   - Tables: `mcp_oauth_user`, `mcp_oauth_session`, `mcp_oauth_account`
   - Purpose: End-user OAuth and de-anonymization

## Configuration

### Platform Auth Instance

Located in `packages/dashboard/src/lib/auth/auth.ts`:

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { organization } from 'better-auth/plugins'
import { db } from 'database'

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg' // PostgreSQL
    }),
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
    
    // Email/password authentication
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,
        sendEmailVerificationOnSignUp: true
    },
    
    // Social providers
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            scope: ['user:email'] // Minimal scope
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            scope: ['openid', 'email', 'profile']
        }
    },
    
    // Plugins
    plugins: [
        organization({
            allowUserToCreateOrganization: true,
            organizationLimit: 5, // Max orgs per user
            organizationMembershipLimit: 100, // Max members per org
            sendInvitationEmail: false // Handle invitations separately
        })
    ],
    
    // Session configuration
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24,      // Update daily
        cookieCache: {
            enabled: true,
            maxAge: 5 * 60 * 1000 // 5 minutes
        }
    },
    
    // Advanced options
    advanced: {
        generateId: () => nanoid(), // Custom ID generation
        crossSubDomainCookies: {
            enabled: true,
            domain: '.naptha.gg' // Share across subdomains
        }
    }
})
```

### MCP Auth Instance

Located in `packages/dashboard/src/lib/auth/mcp/auth.ts`:

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { mcp } from 'better-auth/plugins' // Custom MCP plugin
import { db } from 'database'

export const mcpAuth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg',
        // Map to MCP-specific tables
        tables: {
            user: 'mcp_oauth_user',
            session: 'mcp_oauth_session',
            account: 'mcp_oauth_account'
        }
    }),
    secret: process.env.BETTER_AUTH_SECRET!, // Same secret, different instance
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL!,
    basePath: '/api/mcp-oidc', // Different base path
    
    // OAuth only - no email/password
    emailAndPassword: {
        enabled: false
    },
    
    // Same social providers
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
            redirectURI: '/api/mcp-oidc/callback/github' // Different callback
        },
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            redirectURI: '/api/mcp-oidc/callback/google'
        }
    },
    
    // MCP-specific plugin
    plugins: [
        mcp({
            // Custom configuration for MCP servers
            trackingEnabled: true,
            sessionTracking: true
        })
    ],
    
    // Shorter sessions for end-users
    session: {
        expiresIn: 60 * 60 * 24, // 1 day
        updateAge: 60 * 60 * 2,   // Update every 2 hours
    }
})
```

## Plugin Configuration

### Organization Plugin

The organization plugin provides multi-tenancy for platform users:

```typescript
organization({
    // User permissions
    allowUserToCreateOrganization: true,
    organizationLimit: 5, // Max organizations per user
    
    // Organization settings
    organizationMembershipLimit: 100,
    organizationRoles: ['owner', 'admin', 'member'], // Custom roles
    
    // Invitation handling
    sendInvitationEmail: false, // We handle emails separately
    invitationExpiresIn: 60 * 60 * 24 * 7, // 7 days
    
    // Database schema
    schema: {
        organization: 'organization',
        member: 'organization_member',
        invitation: 'organization_invitation'
    }
})
```

### Custom MCP Plugin

The MCP plugin handles end-user specific functionality:

```typescript
// Hypothetical MCP plugin configuration
mcp({
    // Tracking configuration
    trackingEnabled: true,
    trackingSampling: 1.0, // Track 100% of requests
    
    // Session management
    sessionTracking: true,
    crossSubdomainSessions: true,
    
    // User data handling
    emailRequired: true,
    profilePictureEnabled: true,
    
    // Analytics integration
    analyticsProvider: 'custom',
    customAnalytics: {
        trackUserSessions: true,
        trackToolUsage: true,
        trackErrors: true
    }
})
```

## Environment Variables

### Required Variables

```bash
# Core Better Auth configuration
BETTER_AUTH_SECRET=your-32-char-hex-secret
NEXT_PUBLIC_BETTER_AUTH_URL=https://naptha.gg

# OAuth Provider Credentials
GITHUB_CLIENT_ID=Iv1.your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your_google_client_secret

# Database (handled by SST)
DATABASE_URL=postgres://user:pass@host:port/db
```

### OAuth Provider Setup

**GitHub OAuth Application**:
1. Go to https://github.com/settings/applications/new
2. **Application name**: `MCPlatform (Production)`
3. **Homepage URL**: `https://naptha.gg`
4. **Authorization callback URLs**:
   - `https://naptha.gg/api/auth/callback/github` (Platform)
   - `https://*.naptha.gg/api/mcp-oidc/callback/github` (MCP)

**Google OAuth Application**:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create new OAuth 2.0 Client ID
3. **Application type**: Web application
4. **Name**: `MCPlatform Production`
5. **Authorized JavaScript origins**:
   - `https://naptha.gg`
   - `https://*.naptha.gg`
6. **Authorized redirect URIs**:
   - `https://naptha.gg/api/auth/callback/google` (Platform)
   - `https://*.naptha.gg/api/mcp-oidc/callback/google` (MCP)

## Client-Side Usage

### Platform Auth (Dashboard)

```typescript
// Using Better Auth React hooks
import { useSession } from '@/lib/auth/client'
import { signIn, signOut } from '@/lib/auth/client'

export function DashboardHeader() {
    const { data: session, loading } = useSession()
    
    if (loading) return <Spinner />
    
    if (!session) {
        return <button onClick={() => signIn('github')}>Sign In</button>
    }
    
    return (
        <div>
            <span>Welcome {session.user.name}</span>
            <button onClick={() => signOut()}>Sign Out</button>
        </div>
    )
}
```

### MCP Auth (End Users)

```typescript
// Custom MCP auth client
import { useMcpSession } from '@/lib/auth/mcp/client'

export function McpLoginPrompt() {
    const { session, loading } = useMcpSession()
    
    if (loading) return <div>Checking authentication...</div>
    
    if (!session) {
        return (
            <div>
                <p>Please sign in to continue:</p>
                <a href="/api/mcp-oidc/sign-in/github">
                    Sign in with GitHub
                </a>
                <a href="/api/mcp-oidc/sign-in/google">
                    Sign in with Google  
                </a>
            </div>
        )
    }
    
    return <div>Authenticated as {session.user.email}</div>
}
```

## Server-Side Usage

### Session Verification

```typescript
// Platform auth in server components
import { auth } from '@/lib/auth'

export async function requireSession() {
    const session = await auth.api.getSession({
        headers: headers() // Next.js headers
    })
    
    if (!session) {
        redirect('/auth/login')
    }
    
    return session
}

// MCP auth in API routes
import { mcpAuth } from '@/lib/auth/mcp'

export async function verifyMcpSession(request: Request) {
    const session = await mcpAuth.api.getSession({
        headers: request.headers
    })
    
    return session // Can be null
}
```

### Organization Context

```typescript
// Get user's active organization
export async function getCurrentOrganization(userId: string) {
    const orgMembers = await auth.api.getOrganizations({
        user: { id: userId }
    })
    
    return orgMembers.find(m => m.role === 'owner') || orgMembers[0]
}
```

## Debugging Auth Issues

### Common Problems

1. **Session not found**:
   ```bash
   # Check cookies in browser DevTools
   # Look for: better-auth.session.token
   
   # Verify session in database
   SELECT * FROM session WHERE token = 'token_value';
   ```

2. **OAuth callback errors**:
   ```bash
   # Check redirect URI configuration
   # Ensure wildcard domains are properly configured
   # Verify environment variables are loaded
   ```

3. **Cross-subdomain issues**:
   ```typescript
   // Check cookie domain configuration
   advanced: {
       crossSubDomainCookies: {
           enabled: true,
           domain: '.naptha.gg' // Note the leading dot
       }
   }
   ```

### Debug Queries

```sql
-- Platform users and sessions
SELECT u.email, s.created_at, s.expires_at 
FROM "user" u 
JOIN session s ON u.id = s.user_id 
WHERE s.expires_at > NOW();

-- MCP users and sessions
SELECT u.email, s.created_at, s.expires_at
FROM mcp_oauth_user u  
JOIN mcp_oauth_session s ON u.id = s.user_id
WHERE s.expires_at > NOW();

-- Organization memberships
SELECT u.email, o.name, om.role
FROM "user" u
JOIN organization_member om ON u.id = om.user_id  
JOIN organization o ON om.organization_id = o.id;
```

### Logging

Enable Better Auth debugging:

```typescript
export const auth = betterAuth({
    // ... other config
    logger: {
        level: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
        disabled: false
    }
})
```

## Troubleshooting Common Issues

### Migration Problems

```bash
# If schema generation fails
bunx @better-auth/cli generate --force

# If migrations conflict
cd packages/database
rm -rf migrations/*  # DANGEROUS - ask first
bun run db:generate
```

### Authentication Loops

```typescript
// Check for infinite redirects
// Ensure login pages don't require auth
// Verify session validation logic

// pages/auth/login/page.tsx
export default function LoginPage() {
    // Should NOT call requireSession()
    return <LoginForm />
}
```

### OAuth Provider Issues

```bash
# Test OAuth flow manually
curl -X GET "https://naptha.gg/api/auth/sign-in/github"

# Check provider configuration
# Verify callback URLs match exactly
# Ensure scopes are correct
```

## Related Documentation

- [Dual Authentication System](./dual-auth-system.md)
- [Database Schema Design](../04-database/schema-design.md)  
- [Development Environment Setup](../01-getting-started/dev-environment.md)
- [Troubleshooting Guide](../08-deployment/troubleshooting.md)