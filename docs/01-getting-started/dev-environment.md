# Development Environment Setup

This guide provides detailed setup instructions for MCPlatform development environment.

## Runtime Environment

MCPlatform uses **Bun** as the primary runtime. Never use Node.js, npm, yarn, or pnpm.

### Bun Command Mappings

| Instead of | Use |
|------------|-----|
| `node file.js` | `bun file.js` |
| `ts-node file.ts` | `bun file.ts` |
| `npm install` | `bun install` |
| `npm run script` | `bun run script` |
| `jest` / `vitest` | `bun test` |
| `webpack` / `esbuild` | `bun build` |

### Why Bun?

- **No dotenv needed**: Bun automatically loads `.env` files
- **Built-in TypeScript**: Direct `.ts` file execution
- **Fast package management**: Significantly faster than npm/yarn
- **Integrated test runner**: Uses `bun:test` framework
- **Better SQLite support**: Uses `bun:sqlite` instead of `better-sqlite3`

## Package Architecture

MCPlatform is organized as a monorepo with these workspaces:

```
packages/
├── dashboard/          # Next.js application (main app)
├── database/          # Drizzle ORM schemas and migrations  
├── shared/            # Shared utilities and types
└── ui/               # Reusable UI components
```

Each package has its own:
- `package.json` with dependencies
- `tsconfig.json` for TypeScript config
- `README.md` with package-specific docs

## Database Setup

### Schema Management

MCPlatform uses **Drizzle ORM** with two separate authentication schemas:

1. **Platform Auth** (`auth-schema.ts`): For dashboard users
2. **MCP Auth** (`mcp-auth-schema.ts`): For end-user OAuth

### Database Operations

```bash
# Generate migrations (ASK BEFORE RUNNING)
bun run db:generate

# Run migrations (ASK BEFORE RUNNING) 
bun run db:migrate

# Push schema changes directly (development only)
bun run db:push

# Open database browser
bun run studio
```

⚠️ **CRITICAL**: Never run migrations without explicit permission. Database changes require coordination.

### Connection Details

- Database connection is managed through SST
- Connection string format: `postgres://user:pass@host:port/db`
- VPC-isolated RDS instance in AWS
- Redis for caching and session storage

## SST Development Setup

SST (Serverless Stack) manages AWS infrastructure and local development.

### SST Commands

```bash
# Start full development environment
bun run dev

# Deploy to production
sst deploy --stage production

# Remove all resources from the specified stage
sst remove --stage eproduction

# Enter SST shell for debugging. This enables the code / file you're running to access your linked SST resources
bun sst shell

# execute a command in the context of the SST shell
bun sst shell -- bun test --timeout 15000 path/to/tests
```

### Resource Provisioning

When you run `bun run dev`, SST creates:

1. **VPC**: Private network with NAT gateway
2. **RDS**: PostgreSQL database instance
3. **Redis**: Valkey-compatible cache
4. **ECS**: Cluster for Inngest background jobs
5. **Lambda**: Database migration function
6. **S3**: File storage bucket

Initial provisioning takes 2-3 minutes. Subsequent starts are faster.

## ngrok Configuration

MCPlatform requires external connectivity for OAuth callbacks and Inngest webhooks.

### Setup

1. **Create ngrok account** at https://ngrok.com
2. **Get auth token** from ngrok dashboard
3. **Configure ngrok**:
   ```bash
   ngrok config add-authtoken <your-token>
   ```

### Development Flow

ngrok is started automatically with `bun run dev`, but you can run it manually:

```bash
bun run ngrok
```

This creates a tunnel: `https://random-name.ngrok-free.app` → `http://localhost:3000`

### ngrok in SST Config

The SST configuration (`sst.config.ts:82`) hardcodes an ngrok URL for development:
```typescript
$dev ? 'https://pro-model-sturgeon.ngrok-free.app/api/inngest' : appUrl
```

Update this URL if your ngrok subdomain changes.

## Code Formatting

MCPlatform uses **Biome** for linting and formatting.

### Configuration

Settings in `biome.jsonc`:
- 4-space indentation
- 120-character line width  
- Single quotes
- Trailing commas

### Commands

```bash
# Format and fix all files
bun lint

# Check formatting without fixing
bunx @biomejs/biome check

# Format specific files
bunx @biomejs/biome format --write src/**/*.ts
```

## Testing Setup

### Test Framework

Uses `bun:test` with these patterns:

```typescript
import { test, expect, describe } from 'bun:test'

describe('Feature Name', () => {
    test('should do something', () => {
        expect(true).toBe(true)
    })
})
```

### Test Organization

```
packages/dashboard/tests/
├── 01-feature-name/
│   ├── unit/
│   ├── integration/
│   └── e2e/
```

### Running Tests

```bash
# Run all tests
bun run tests

# Run specific test file  
bun run tests packages/dashboard/tests/auth/login.test.ts

# Run tests with pattern matching
bun run tests --grep "auth"

# Run with timeout (default 15s)
bun test --timeout 30000
```

## Puppeteer UI Testing

MCPlatform includes Puppeteer for automated UI testing.

### Configuration

- **Resolution**: 1920x1080
- **Mode**: Headless
- **User Data**: `/Users/kyle/Library/Application Support/Google/Chrome/Default`
- **Login**: Use `/login-for-claude` endpoint for automatic login

### Example Test

```typescript
import { test, expect } from 'bun:test'
import puppeteer from 'puppeteer'

test('dashboard loads correctly', async () => {
    const browser = await puppeteer.launch({ 
        headless: true,
        userDataDir: '/Users/kyle/Library/Application Support/Google/Chrome/Default'
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })
    
    await page.goto('http://localhost:3000/login-for-claude')
    await page.waitForSelector('[data-testid="dashboard"]')
    
    await browser.close()
})
```

## Development Ports

| Service | Port | Purpose |
|---------|------|---------|
| Next.js | 3000 | Main application |
| Drizzle Studio | 3001 | Database browser |
| Inngest | 8288 | Background jobs |
| ngrok | 4040 | Tunnel management |

## Environment Variables Deep Dive

### Required Variables

```bash
# Background Jobs
INNGEST_EVENT_KEY=evt_xxxx            # From Inngest dashboard
INNGEST_SIGNING_KEY=signkey_xxxx      # From Inngest dashboard

# OAuth Providers  
GITHUB_CLIENT_ID=Iv1.xxxx             # GitHub OAuth app
GITHUB_CLIENT_SECRET=xxxx             # GitHub OAuth secret
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx

# Authentication
BETTER_AUTH_SECRET=32-char-hex-string  # Generate with crypto.randomBytes(32).toString('hex')
NEXT_PUBLIC_BETTER_AUTH_URL=https://dev.naptha.gg  # Your domain

# APIs
GOOGLE_API_KEY=AIzaSyXXXX            # For Google APIs
TURBOPUFFER_API_KEY=tpuf_xxxx        # Vector database
```

### Variable Sources

- **Inngest**: Create account at https://inngest.com
- **GitHub OAuth**: Create app at https://github.com/settings/applications/new
- **Google OAuth**: Create app at https://console.cloud.google.com/apis/credentials
- **Turbopuffer**: Sign up at https://turbopuffer.com

### Security Notes

- Never commit `.env` to git
- Use different keys for different stages
- Rotate secrets regularly
- Keep production secrets separate

## IDE Configuration

### VS Code Settings

Recommended `.vscode/settings.json`:

```json
{
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "biomejs.biome",
    "typescript.preferences.includePackageJsonAutoImports": "on",
    "files.associations": {
        "*.ts": "typescript",
        "*.tsx": "typescriptreact"
    }
}
```

### TypeScript Configuration

Each package has its own `tsconfig.json` extending from the root:

- **Strict mode** enabled
- **Path mapping** for `@/` aliases
- **ESNext** target for modern features
- **Bundler** module resolution

## Common Development Issues

### "Module not found" errors
- Run `bun install` to ensure dependencies are installed
- Check import paths use `@/` aliases correctly
- Verify package.json workspaces configuration

### "Database connection failed"
- Ensure SST resources are provisioned
- Check VPC security groups allow connections
- Verify environment variables are loaded

### "OAuth callback errors"  
- Ensure ngrok tunnel is active
- Check OAuth app callback URLs match ngrok domain
- Verify NEXT_PUBLIC_BETTER_AUTH_URL is correct

### "Hot reload not working"
- Check Next.js dev server is running on port 3000
- Verify file changes are saved
- Restart dev server if needed

### "Tests failing"
- Ensure database is accessible in test environment
- Check test isolation and cleanup
- Verify test data setup

## Next Steps

- Review [Development Workflow](./development-workflow.md) for daily patterns
- Understand [VHost Routing](../02-architecture/vhost-routing.md) for MCP servers
- Learn [Authentication Systems](../03-authentication/dual-auth-system.md)
- Set up [Testing Patterns](../07-testing/testing-guide.md)