# MCP Server Management & SST Database Operations

This guide covers how to manage MCP servers, perform database operations using SST, and important considerations for production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [SST Database Shell Operations](#sst-database-shell-operations)
- [MCP Server Deletion](#mcp-server-deletion)
- [Database Management Best Practices](#database-management-best-practices)
- [Common Operations](#common-operations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before performing any database operations, ensure you have:

1. **Bun installed** (this project uses Bun, not npm/yarn)
2. **Access to the appropriate stage** (dev, staging, production)
3. **SST configured** with proper AWS credentials
4. **Understanding of the database schema** (see `/packages/database/src/`)

## SST Database Shell Operations

### Connecting to the Database

Use SST shell to execute database operations safely:

```bash
# Connect to development database
bun sst shell --stage dev -- <command>

# Connect to staging database
bun sst shell --stage staging -- <command>

# Connect to production database (use with extreme caution)
bun sst shell --stage production -- <command>
```

### Basic Database Query Pattern

```bash
bun sst shell --stage dev -- bun -e "
import { db, tableName } from 'database';
import { eq } from 'drizzle-orm';

// Your database operations here
const result = await db.select().from(tableName);
console.log(result);
"
```

### Drizzle Studio Access

For visual database management:

```bash
# From project root
bun sst shell --stage dev -- bun run studio

# Or using the package script
bun studio
```

This opens Drizzle Studio at `http://localhost:4983` for database inspection and basic operations.

## MCP Server Deletion

### ⚠️ Critical Warning

**NEVER delete MCP servers in production without:**
1. Confirming with stakeholders
2. Taking a database backup
3. Understanding the impact on customers
4. Having a rollback plan

### Understanding the Data Relationships

Before deleting an MCP server, understand what data will be affected:

```bash
bun sst shell --stage dev -- bun -e "
import { db, mcpServers, toolCalls, mcpServerSession, mcpServerWalkthroughs, supportRequests, walkthroughStepCompletions } from 'database';
import { eq } from 'drizzle-orm';

const serverId = 'YOUR_SERVER_ID';

// Check what will be deleted
const toolCallsCount = await db.select().from(toolCalls).where(eq(toolCalls.mcpServerId, serverId));
const sessionsCount = await db.select().from(mcpServerSession).where(eq(mcpServerSession.mcpServerSlug, 'SERVER_SLUG'));
const walkthroughsCount = await db.select().from(mcpServerWalkthroughs).where(eq(mcpServerWalkthroughs.mcpServerId, serverId));
const supportCount = await db.select().from(supportRequests).where(eq(supportRequests.mcpServerId, serverId));

console.log('Impact Assessment:');
console.log('- Tool calls:', toolCallsCount.length);
console.log('- Sessions:', sessionsCount.length);
console.log('- Walkthroughs:', walkthroughsCount.length);
console.log('- Support requests:', supportCount.length);
"
```

### Step-by-Step Deletion Process

Due to foreign key constraints, deletion must follow this exact order:

```bash
bun sst shell --stage dev -- bun -e "
import { db, toolCalls, mcpServerSession, mcpServerWalkthroughs, supportRequests, mcpServers, walkthroughStepCompletions, mcpServerUser } from 'database';
import { eq, sql } from 'drizzle-orm';

const serverId = 'YOUR_SERVER_ID';
const serverSlug = 'YOUR_SERVER_SLUG';

console.log('🗑️ Starting deletion process for server:', serverId);

try {
  // Step 1: Delete walkthrough step completions
  console.log('1. Deleting walkthrough step completions...');
  await db.delete(walkthroughStepCompletions).where(eq(walkthroughStepCompletions.mcpServerId, serverId));

  // Step 2: Delete tool calls
  console.log('2. Deleting tool calls...');
  await db.delete(toolCalls).where(eq(toolCalls.mcpServerId, serverId));

  // Step 3: Delete sessions
  console.log('3. Deleting sessions...');
  await db.delete(mcpServerSession).where(eq(mcpServerSession.mcpServerSlug, serverSlug));

  // Step 4: Delete server walkthroughs
  console.log('4. Deleting server walkthroughs...');
  await db.delete(mcpServerWalkthroughs).where(eq(mcpServerWalkthroughs.mcpServerId, serverId));

  // Step 5: Delete support requests
  console.log('5. Deleting support requests...');
  await db.delete(supportRequests).where(eq(supportRequests.mcpServerId, serverId));

  // Step 6: Delete orphaned mcp_server_user records
  console.log('6. Deleting orphaned user records...');
  await db.delete(mcpServerUser).where(
    sql\`\${mcpServerUser.id} NOT IN (
      SELECT DISTINCT \${mcpServerSession.mcpServerUserId}
      FROM \${mcpServerSession}
      WHERE \${mcpServerSession.mcpServerUserId} IS NOT NULL
    )\`
  );

  // Step 7: Finally delete the server
  console.log('7. Deleting MCP server...');
  await db.delete(mcpServers).where(eq(mcpServers.id, serverId));

  console.log('✅ Successfully deleted MCP server:', serverId);

} catch (error) {
  console.error('❌ Error during deletion:', error);
  console.log('🔄 Database transaction was rolled back');
}
"
```

### Verification After Deletion

Always verify the deletion was successful:

```bash
bun sst shell --stage dev -- bun -e "
import { db, mcpServers } from 'database';
import { eq } from 'drizzle-orm';

const serverId = 'YOUR_SERVER_ID';
const server = await db.select().from(mcpServers).where(eq(mcpServers.id, serverId));

if (server.length === 0) {
  console.log('✅ Confirmation: MCP server successfully deleted');
} else {
  console.log('❌ Error: MCP server still exists');
}
"
```

## Database Management Best Practices

### 1. Always Use Transactions for Complex Operations

```bash
bun sst shell --stage dev -- bun -e "
import { db } from 'database';

await db.transaction(async (tx) => {
  // Multiple related operations here
  // If any fail, all are rolled back automatically
});
"
```

### 2. Test Operations in Development First

```bash
# Always test in dev first
bun sst shell --stage dev -- <operation>

# Then staging
bun sst shell --stage staging -- <operation>

# Finally production (with extreme caution)
bun sst shell --stage production -- <operation>
```

### 3. Create Backups Before Major Operations

```bash
# Using pg_dump through SST
bun sst shell --stage production -- pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4. Monitor Database Performance

```bash
# Check database connections
bun sst shell --stage production -- bun -e "
import { db } from 'database';
import { sql } from 'drizzle-orm';

const connections = await db.execute(sql\`
  SELECT count(*) as active_connections
  FROM pg_stat_activity
  WHERE state = 'active'
\`);
console.log('Active connections:', connections[0]);
"
```

## Common Operations

### Finding MCP Servers

```bash
# List all servers
bun sst shell --stage dev -- bun -e "
import { db, mcpServers } from 'database';
const servers = await db.select().from(mcpServers);
console.log(servers);
"

# Find by slug
bun sst shell --stage dev -- bun -e "
import { db, mcpServers } from 'database';
import { eq } from 'drizzle-orm';
const server = await db.select().from(mcpServers).where(eq(mcpServers.slug, 'your-slug'));
console.log(server);
"

# Find by organization
bun sst shell --stage dev -- bun -e "
import { db, mcpServers } from 'database';
import { eq } from 'drizzle-orm';
const servers = await db.select().from(mcpServers).where(eq(mcpServers.organizationId, 'org-id'));
console.log(servers);
"
```

### Analytics Queries

```bash
# Get server usage statistics
bun sst shell --stage dev -- bun -e "
import { db, toolCalls, mcpServerSession } from 'database';
import { eq, count, sql } from 'drizzle-orm';

const serverId = 'YOUR_SERVER_ID';

const stats = await db
  .select({
    toolCalls: count(toolCalls.id),
    sessions: count(mcpServerSession.mcpServerSessionId)
  })
  .from(toolCalls)
  .leftJoin(mcpServerSession, eq(toolCalls.mcpServerSessionId, mcpServerSession.mcpServerSessionId))
  .where(eq(toolCalls.mcpServerId, serverId));

console.log('Server statistics:', stats[0]);
"
```

### User Management

```bash
# Find users for a specific server
bun sst shell --stage dev -- bun -e "
import { db, mcpServerUser, mcpServerSession } from 'database';
import { eq } from 'drizzle-orm';

const serverSlug = 'your-server-slug';

const users = await db
  .select({
    userId: mcpServerUser.id,
    email: mcpServerUser.email,
    trackingId: mcpServerUser.trackingId,
    firstSeen: mcpServerUser.firstSeenAt
  })
  .from(mcpServerUser)
  .innerJoin(mcpServerSession, eq(mcpServerUser.id, mcpServerSession.mcpServerUserId))
  .where(eq(mcpServerSession.mcpServerSlug, serverSlug));

console.log('Users for server:', users);
"
```

## Troubleshooting

### Foreign Key Constraint Errors

If you encounter foreign key constraint errors:

1. **Check the order of deletion** - Follow the order specified in the deletion guide
2. **Identify missing relationships** - Some tables might not have been included
3. **Use cascade deletes** - Some foreign keys are set to CASCADE, others to SET NULL

### Connection Issues

```bash
# Test database connection
bun sst shell --stage dev -- bun -e "
import { db } from 'database';
import { sql } from 'drizzle-orm';

try {
  await db.execute(sql\`SELECT 1\`);
  console.log('✅ Database connection successful');
} catch (error) {
  console.log('❌ Database connection failed:', error);
}
"
```

### Query Performance Issues

```bash
# Check slow queries
bun sst shell --stage production -- bun -e "
import { db } from 'database';
import { sql } from 'drizzle-orm';

const slowQueries = await db.execute(sql\`
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000
  ORDER BY mean_exec_time DESC
  LIMIT 10
\`);
console.log('Slow queries:', slowQueries);
"
```

## Security Considerations

### 1. Environment Isolation

- **Never run production operations in development commands**
- **Always specify the correct stage explicitly**
- **Use different AWS profiles for different environments**

### 2. Access Control

- **Limit who has production database access**
- **Use IAM roles with minimal required permissions**
- **Log all production database operations**

### 3. Data Protection

- **Never log sensitive user data**
- **Encrypt sensitive fields in the database**
- **Follow GDPR/compliance requirements for data deletion**

## Emergency Procedures

### Rollback a Failed Operation

If an operation fails and you need to rollback:

1. **Stop the application** to prevent new data
2. **Restore from the most recent backup**
3. **Verify data integrity**
4. **Resume application operations**

### Data Recovery

```bash
# Restore from backup
psql $DATABASE_URL < backup_20240101_120000.sql
```

---

## Important Reminders

- **Always test in development first**
- **Take backups before major operations**
- **Understand foreign key relationships**
- **Use transactions for multi-step operations**
- **Monitor database performance**
- **Follow the principle of least privilege**

For additional help, refer to:
- [Database Schema Documentation](/docs/04-database/)
- [SST Documentation](https://sst.dev)
- [Drizzle ORM Documentation](https://orm.drizzle.team)