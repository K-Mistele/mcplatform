# Quick Start Guide

Welcome to MCPlatform! This guide will get you set up and running in under 30 minutes.

## Prerequisites

Before starting, ensure you have:

- [Bun](https://bun.sh/) installed (v1.0 or later)
- AWS CLI configured with credentials
- [ngrok](https://ngrok.com/) account and authtoken
- Git configured

### Quick Verification

```bash
# Verify prerequisites
bun --version    # Should show 1.0+
aws sts get-caller-identity  # Should show your AWS account
ngrok config check  # Should show valid configuration
```

## Environment Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd mcplatform
   bun install
   ```

2. **Set up environment variables:**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Fill in the required values (see [Environment Variables](#environment-variables) section below).

3. **Install SST tunnel (first time only):**
   ```bash
   sudo sst tunnel install
   ```
   
   This creates a network interface for secure tunnels to AWS resources. You only need to run this once on your machine.

4. **Start the development environment:**
   ```bash
   bun run dev
   ```

   This command:
   - Provisions AWS resources (VPC, RDS, Redis, etc.)
   - Sets up the Next.js application
   - Starts ngrok for external connectivity
   - Runs database migrations automatically

5. **Access the application:**
   
   Once the setup completes, you'll see output similar to:
   ```
   Dashboard: https://your-stage.naptha.gg
   Local dev: http://localhost:3000
   ```

   For development, use the `/login-for-claude` endpoint to automatically log in.

## Environment Variables

Create a `.env` file with these required values:

```bash
# Inngest (background jobs)
INNGEST_EVENT_KEY=your-inngest-event-key
INNGEST_SIGNING_KEY=your-inngest-signing-key

# OAuth - GitHub
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# OAuth - Google
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Authentication
BETTER_AUTH_SECRET=your-random-32-char-secret
NEXT_PUBLIC_BETTER_AUTH_URL=https://your-stage.naptha.gg

# External APIs
GOOGLE_API_KEY=your-google-api-key
TURBOPUFFER_API_KEY=your-turbopuffer-api-key
```

### Generating Secrets

```bash
# Generate a random secret for BETTER_AUTH_SECRET
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## First Steps

1. **Access the Dashboard:**
   Navigate to `http://localhost:3000/login-for-claude` to automatically log in.

2. **Create an Organization:**
   Follow the onboarding flow to set up your first organization.

3. **Create an MCP Server:**
   - Go to "MCP Servers" section
   - Click "Create New Server"
   - Choose a unique slug (this becomes your subdomain)
   - Configure your server settings

4. **Test Your MCP Server:**
   Your server will be available at `https://your-slug.your-stage.naptha.gg`

## Common Commands

| Command | Purpose |
|---------|---------|
| `bun run dev` | Start development environment with SST |
| `bun run next:dev` | Start only Next.js (requires SST resources) |
| `bun run lint` | Format code with Biome |
| `bun run tests` | Run all tests |
| `bun run studio` | Open Drizzle Studio for database inspection |
| `bun run ngrok` | Start ngrok tunnel manually |

## Common Setup Issues

### "AWS credentials not found"
- Ensure AWS CLI is configured: `aws configure`
- Verify credentials: `aws sts get-caller-identity`

### "ngrok failed to start"
- Check ngrok auth token: `ngrok config check`
- Set auth token: `ngrok config add-authtoken <your-token>`

### "Database connection failed"
- Wait for SST resources to provision (can take 2-3 minutes)
- Check SST console output for errors
- Verify VPC and security group settings

### "Environment variables not loaded"
- Ensure `.env` file is in the project root
- Bun loads `.env` automatically - don't use `dotenv`
- Restart `bun run dev` after changing environment variables

### "Port 3000 already in use"
- Kill existing Next.js processes: `pkill -f "next dev"`
- The dev server should always be running on port 3000
- Never run `bun run build` or `bun run dev` multiple times

## Development Workflow

1. **Making Changes:**
   - Edit files in `packages/dashboard/src/`
   - Changes hot-reload automatically
   - Use `bun lint` to format code

2. **Database Changes:**
   - **NEVER run migrations without permission**
   - Ask before running `bun run db:generate` or `bun run db:migrate`
   - Use `bun run studio` to inspect the database

3. **Testing:**
   - Run `bun run tests` for full test suite
   - Tests use `bun:test` framework
   - UI tests use Puppeteer with Chrome

4. **Debugging:**
   - Check browser console for frontend errors
   - Use `bun run studio` to inspect database state
   - Check SST console for AWS resource logs

## Next Steps

- Read the [Development Environment Setup](./dev-environment.md) for detailed configuration
- Learn about [Development Workflow](./development-workflow.md) patterns
- Understand [VHost Routing](../02-architecture/vhost-routing.md) for MCP servers
- Review [Authentication Systems](../03-authentication/dual-auth-system.md) architecture

## Getting Help

- Check the [Troubleshooting Guide](../08-deployment/troubleshooting.md)
- Review existing issue patterns in CLAUDE.md
- File issues in the repository issue tracker