# SST Deployment Guide

This guide covers deploying MCPlatform using [SST (Serverless Stack)](https://sst.dev/) on AWS, including stage management, infrastructure provisioning, and operational procedures.

## Overview

MCPlatform uses SST v3 for Infrastructure as Code (IaC), deploying a comprehensive multi-service architecture on AWS with VPC, database, caching, job processing, and Next.js frontend.

## Prerequisites

### Required Tools
- **AWS CLI**: Configured with appropriate credentials
- **Bun**: Primary package manager and runtime  
- **SST CLI**: Installed globally (`bunx sst@latest`)
- **ngrok**: For local development webhook connections

### AWS Permissions
Your AWS credentials need the following services:
- EC2 (VPC, instances, security groups)
- RDS (PostgreSQL database)
- ElastiCache (Redis/Valkey)
- ECS (container services)
- Lambda (functions and migrations)
- Route 53 (DNS management)
- CloudFormation (stack management)
- IAM (service roles and policies)

### Environment Variables

**Required for all deployments** (see `.env.example`):
```bash
# Inngest (background job processing)
INNGEST_EVENT_KEY=evt_...
INNGEST_SIGNING_KEY=signkey_...

# OAuth providers
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Application secrets
BETTER_AUTH_SECRET=your_32_char_random_string
NEXT_PUBLIC_BETTER_AUTH_URL=https://your-domain.com
GOOGLE_API_KEY=your_google_api_key
TURBOPUFFER_API_KEY=tpuf_...
```

**Development-specific**:
```bash
NGROK_AUTH_TOKEN=your_ngrok_token
```

## Architecture Overview

**Infrastructure Components** (defined in `sst.config.ts:32-180`):

### 1. Networking Layer
```typescript
const vpc = new sst.aws.Vpc(`Vpc`, {
    nat: {
        type: 'managed'
    },
    bastion: true
})
```
- **VPC**: Private network with public/private subnets
- **NAT Gateway**: Managed NAT for outbound internet access
- **Bastion Host**: SSH access to private resources

### 2. Data Layer
```typescript
// PostgreSQL database
const postgres = new sst.aws.Postgres(`Postgres`, {
    vpc,
    database: 'postgres',
    proxy: false
})

// Redis instance (Valkey engine)
const redis = new sst.aws.Redis(`Redis`, {
    vpc,
    engine: 'valkey',
    cluster: { nodes: 1 }
})
```

### 3. Compute Layer  
```typescript
// ECS cluster for services
const cluster = new sst.aws.Cluster(`Cluster`, { vpc })

// Inngest service for background jobs
const inngest = new sst.aws.Service(`Inngest`, {
    cluster,
    image: 'inngest/inngest:latest',
    // ... configuration
})
```

### 4. Application Layer
```typescript
// Next.js application with wildcard domains
const nextApp = new sst.aws.Nextjs('Dashboard', {
    domain: {
        name: domainName,
        aliases: [`*.${domainName}`]  // Critical for VHost routing
    }
    // ... configuration
})
```

## Stage Management

### Stage Naming Convention

**Stages** (defined in `sst.config.ts:67,140`):
- `production` → Domain: `naptha.gg`
- `{stage}` → Domain: `{stage}.naptha.gg`
- `dev` (local) → Uses ngrok tunnel

### Protection Settings

```typescript
app(input) {
    return {
        removal: input?.stage === 'production' ? 'retain' : 'remove',
        protect: ['production'].includes(input?.stage),
    }
}
```

- **Production**: Resources retained on deletion, stack protected
- **Other stages**: Resources removed when stage deleted

## Deployment Procedures

### Development Environment Setup

#### 1. Configure Environment
```bash
# Copy environment template
cp .env.example .env.local

# Configure OAuth providers (see Environment Setup guide)
# Configure ngrok domain and auth token
```

#### 2. Start Development Stack
```bash
# Start all services (database, redis, inngest, nextjs, ngrok)
bun dev

# This runs `sst dev` which:
# - Provisions AWS infrastructure
# - Starts local Next.js development server
# - Connects Inngest to local app via ngrok
# - Opens Drizzle Studio for database management
```

#### 3. Development Services

**Running Services** (visible in SST console):
- **Dashboard**: Next.js app on `localhost:3000`
- **Inngest**: ECS service with ngrok webhook connection
- **Studio**: Drizzle Studio for database management
- **Ngrok**: Public tunnel for local development

### Staging Deployment

#### 1. Create New Stage
```bash
# Deploy to staging environment
bunx sst deploy --stage staging

# This creates:
# - staging.naptha.gg domain
# - Separate AWS resources with "staging" prefix
# - Production-like infrastructure without protection
```

#### 2. Configure DNS
SST automatically configures:
- Route 53 hosted zone for `staging.naptha.gg`
- Wildcard DNS (`*.staging.naptha.gg`) for MCP server routing
- SSL certificates via AWS Certificate Manager

#### 3. Database Migration
```bash
# Migrations run automatically via Lambda function
# See sst.config.ts:127-130
```

### Production Deployment

#### 1. Pre-deployment Checklist
- [ ] All environment variables configured in production environment
- [ ] DNS domain ownership verified
- [ ] OAuth apps configured with production callback URLs
- [ ] Database backup strategy confirmed
- [ ] Monitoring and alerting configured

#### 2. Initial Production Deployment
```bash
# Deploy to production (first time)
bunx sst deploy --stage production

# Provisions:
# - naptha.gg domain with SSL
# - Production-grade RDS PostgreSQL
# - Redis cluster for caching
# - ECS cluster with Inngest service
# - CloudFront distribution for Next.js
```

#### 3. Production Environment Variables

Set in AWS Systems Manager Parameter Store or similar:
```bash
# Inngest webhooks use production domain
NEXT_PUBLIC_BETTER_AUTH_URL=https://naptha.gg

# OAuth callbacks point to production
# GitHub: https://naptha.gg/api/auth/callback/github
# Google: https://naptha.gg/api/auth/callback/google
```

#### 4. DNS Configuration

**Critical for MCP Server VHost Routing**:
```typescript
domain: {
    name: domainName,
    dns: sst.aws.dns(),
    redirects: [`www.${domainName}`],
    aliases: [`*.${domainName}`]  // Enables unlimited subdomains
}
```

This enables:
- `naptha.gg` → Main application
- `customer1.naptha.gg` → Customer's MCP server
- `customer2.naptha.gg` → Another customer's MCP server

## Database Operations

### Automatic Migrations

**Migration Lambda** (defined in `sst.config.ts:111-130`):
```typescript
const migrator = new sst.aws.Function('DatabaseMigrator', {
    handler: 'packages/database/migrator.handler',
    copyFiles: [{ from: 'packages/database/migrations', to: 'migrations' }],
    environment: { DATABASE_URL: postgresConnectionString }
})

// Invoke migration on every deployment
new aws.lambda.Invocation('DatabaseMigratorInvocation', {
    input: Date.now().toString(),
    functionName: migrator.name
})
```

### Manual Migration Operations

**⚠️ Warning**: Never run migrations locally against production database!

```bash
# Generate migration (local only)
bun db:generate

# Migrations are automatically applied during SST deployments
# If manual intervention needed, use SST shell:
bunx sst shell --stage production
# Then run migration commands within that environment
```

### Database Access

**Development**:
```bash
# Drizzle Studio (automatically started with `bun dev`)
bun studio

# Direct database connection via bastion host
# (Connection string available in SST console)
```

**Production**:
```bash
# Connect via bastion host (see SST console for connection details)
# Use SST shell for safe access:
bunx sst shell --stage production
```

## Service Configuration

### Inngest Background Jobs

**Development Configuration** (hardcoded ngrok domain):
```typescript
'-u', $dev ? 'https://pro-model-sturgeon.ngrok-free.app/api/inngest' : appUrl
```

**Production Configuration**:
```typescript
environment: {
    INNGEST_POSTGRES_URI: `postgres://${username}:${password}@${host}:${port}/${database}`,
    INNGEST_REDIS_URI: `redis://${username}:${password}@${host}:${port}/1`,
    INNGEST_DEV: '0'
}
```

### Next.js Application

**Linked Resources** (`sst.config.ts:151`):
```typescript
link: [postgres, bucket, inngest, redis]
```

**Environment Variables Injected**:
- Database and Redis connection strings
- OAuth provider credentials  
- Inngest webhook configuration
- API keys for external services

### Redis Configuration

**Engine**: Valkey (Redis-compatible)
**Usage**: 
- Inngest job queuing and state management
- Application caching (via `REDIS_URL` environment variable)
- Session storage for high-performance auth

## Monitoring & Operations

### SST Console Access

```bash
# Access SST development console
bun dev
# Console available at printed URL

# Access deployed stage console  
bunx sst console --stage production
```

### CloudWatch Logs

**Service Logs**:
- **Lambda Functions**: CloudWatch Logs groups for migrator and other functions
- **ECS Services**: Inngest service logs in CloudWatch
- **Next.js Application**: CloudWatch Logs for Lambda@Edge functions

### Health Checks

**Application Health**:
- Next.js: `https://naptha.gg/api/health` (if implemented)
- Inngest: Service registry health checks on port 8288
- Database: Connection pooling and timeout monitoring

### Cost Management

**Cost Optimization**:
- **Development**: Resources removed when stage deleted
- **Production**: Resources retained but can be optimized:
  - RDS instance sizing based on usage
  - Redis node count adjustment
  - Lambda concurrency limits
  - CloudFront caching configuration

## Troubleshooting

### Common Deployment Issues

#### 1. Environment Variables Missing
```bash
Error: INNGEST_EVENT_KEY is not set
```
**Solution**: Verify all required environment variables in `.env.local` or stage configuration.

#### 2. OAuth Configuration Errors
```bash
Error: redirect_uri_mismatch
```
**Solution**: Update OAuth app callback URLs to match deployed domain:
- GitHub: `https://your-domain.com/api/auth/callback/github`
- Google: `https://your-domain.com/api/auth/callback/google`

#### 3. Domain Configuration Issues
```bash
Error: Domain already exists in another account
```
**Solution**: Ensure domain ownership and DNS configuration are correct.

#### 4. Migration Failures
```bash
Lambda migrator timeout
```
**Solution**: Check CloudWatch logs for specific migration errors.

### Development Troubleshooting

#### 1. ngrok Connection Issues
```bash
Error: Failed to establish ngrok tunnel
```
**Solution**: 
- Verify `NGROK_AUTH_TOKEN` is set correctly
- Check ngrok domain configuration in `scripts/ngrok.ts:6`
- Update hardcoded ngrok domain in `sst.config.ts:82`

#### 2. Local Database Connection
```bash
Error: Connection timeout to database
```
**Solution**: Ensure VPC and security groups allow local connections during development.

### Production Troubleshooting

#### 1. Subdomain Routing Issues
```bash
Error: MCP server must be accessed via direct subdomain
```
**Solution**: Verify wildcard DNS (`*.naptha.gg`) is properly configured.

#### 2. Inngest Webhook Connectivity
```bash
Error: Failed to connect to app webhook
```
**Solution**: 
- Check Inngest service is running in ECS
- Verify Next.js app `/api/inngest` endpoint is accessible
- Review security group and load balancer configurations

## Stage Cleanup

### Development Cleanup
```bash
# Remove development stack (safe - resources are not retained)
bunx sst remove --stage dev
```

### Staging Cleanup
```bash
# Remove staging stack
bunx sst remove --stage staging
# This removes all AWS resources for staging
```

### Production Cleanup
```bash
# Production resources are protected and retained
# Manual cleanup required through AWS Console if needed
bunx sst remove --stage production  # This will fail due to protection
```

## Security Considerations

### Network Security
- VPC with private subnets for database and cache
- NAT Gateway for controlled internet access
- Security groups limiting access between services
- Bastion host for secure admin access

### Application Security  
- Environment variables not logged or exposed
- OAuth secrets managed securely
- Database credentials auto-generated and rotated
- HTTPS enforced for all domains

### Access Control
- IAM roles with minimal required permissions
- Service-to-service authentication via AWS IAM
- Database access limited to application services
- Admin access only via bastion host or SST shell

## Performance Optimization

### Database Performance
- Connection pooling (TODO: implement PgBouncer per line 59)
- Read replicas for analytics queries
- Appropriate instance sizing based on workload

### Application Performance
- Next.js optimizations (warm Lambda functions)
- Redis caching for frequent queries
- CloudFront CDN for static assets
- Regional deployment (currently US-East-1)

### Cost Optimization
- Stage-based resource sizing
- Automatic scaling for ECS services
- Lambda concurrency management
- Regular cost monitoring and optimization

## Related Documentation

- [Development Environment Setup](../01-getting-started/dev-environment.md) - Local development configuration
- [VHost Routing System](../02-architecture/vhost-routing.md) - DNS and subdomain configuration requirements  
- [Database Schema](../04-database/schema-design.md) - Database structure and migration patterns
- [Testing Patterns](../07-testing/testing-guide.md) - Testing deployed services

## Advanced Infrastructure Configuration

### VPC Network Architecture

#### Subnet Configuration

**Public Subnets**:
- **Purpose**: NAT Gateways, Bastion Host, Load Balancers
- **CIDR**: Auto-calculated by SST
- **Internet Gateway**: Direct access for outbound traffic

**Private Subnets**:
- **Purpose**: RDS, Redis, ECS services, Lambda functions
- **CIDR**: Auto-calculated by SST
- **NAT Gateway**: Outbound internet access only

#### Security Groups Implementation

```typescript
// Database Security Group (auto-generated)
{
    inbound: [
        {
            protocol: 'tcp',
            port: 5432,
            source: 'vpc-cidr'  // Only VPC resources can connect
        }
    ],
    outbound: [
        {
            protocol: 'all',
            destination: '0.0.0.0/0'  // Required for software updates
        }
    ]
}

// ECS Service Security Group
{
    inbound: [
        {
            protocol: 'tcp',
            port: 8288,  // Inngest service
            source: 'alb-security-group'
        }
    ]
}
```

#### Network Access Control Lists (NACLs)

SST uses default NACLs but production deployments should consider:
- Custom NACLs for database subnets
- Stricter inbound/outbound rules
- Application-layer filtering

### Database Infrastructure Deep Dive

#### RDS Configuration

**Instance Specifications**:
```typescript
// Production configuration (inferred from SST defaults)
{
    engine: 'postgres',
    version: '15.x',           // Latest available
    instanceClass: 'db.t3.micro',  // Development/small production
    allocatedStorage: '20GB',       // Initial allocation
    storageType: 'gp2',           // General Purpose SSD
    multiAZ: false,               // Single AZ for cost optimization
    backupRetentionPeriod: 7,     // 7 days automated backups
    deletionProtection: true      // For production stage
}
```

**Connection Pooling Strategy**:
```javascript
// Connection pool configuration (recommended)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,                    // Maximum connections
    idleTimeoutMillis: 30000,   // Close idle connections
    connectionTimeoutMillis: 10000
})

// Usage pattern for high-concurrency applications
const client = await pool.connect()
try {
    const result = await client.query('SELECT * FROM users')
    return result.rows
} finally {
    client.release()  // Return to pool
}
```

#### Database Maintenance

**Automated Maintenance**:
- **Backup Window**: 3:00-4:00 AM UTC (configurable)
- **Maintenance Window**: Sunday 4:00-5:00 AM UTC
- **Minor Version Updates**: Automatic
- **Major Version Updates**: Manual approval required

**Manual Maintenance Tasks**:
```bash
# Connect to database via SST shell
bunx sst shell --stage production

# Common maintenance commands
ANALYZE;                           # Update table statistics
VACUUM (ANALYZE, VERBOSE);        # Reclaim storage space
REINDEX DATABASE postgres;         # Rebuild indexes

# Monitor database size
SELECT pg_size_pretty(pg_database_size('postgres')) as size;

# Check for slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;
```

### Redis/Valkey Configuration

#### Cluster Setup

```typescript
// Current configuration
const redis = new sst.aws.Redis(`Redis`, {
    vpc,
    engine: 'valkey',
    cluster: { 
        nodes: 1,                    // Single node for simplicity
        nodeType: 'cache.t3.micro'   // 0.5 GB memory
    }
})
```

**Production Optimization**:
```typescript
// Recommended production configuration
const redis = new sst.aws.Redis(`Redis`, {
    vpc,
    engine: 'valkey',
    cluster: {
        nodes: 3,                    // Multi-node for availability
        nodeType: 'cache.r6g.large', // 13.07 GB memory
        parameterGroup: 'valkey7.2.0'
    },
    automaticFailoverEnabled: true,
    multiAzEnabled: true
})
```

#### Redis Usage Patterns

**Session Storage**:
```javascript
// Session configuration with Redis
import { createSession } from '@/lib/session'

const sessionConfig = {
    store: new RedisStore({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        password: process.env.REDIS_PASSWORD,
        db: 0  // Dedicated database for sessions
    }),
    ttl: 86400,  // 24 hours
    prefix: 'sess:'
}
```

**Application Caching**:
```javascript
// Cached database queries
const getCachedData = async (key) => {
    const cached = await redis.get(`cache:${key}`)
    if (cached) {
        return JSON.parse(cached)
    }
    
    const data = await database.query(...)
    await redis.setex(`cache:${key}`, 300, JSON.stringify(data))  // 5 minute TTL
    return data
}
```

**Inngest Job Queue**:
```javascript
// Background job management
const queueJob = async (jobType, payload) => {
    await redis.lpush(`jobs:${jobType}`, JSON.stringify({
        id: nanoid(),
        payload,
        createdAt: Date.now()
    }))
}
```

### ECS and Container Orchestration

#### Inngest Service Configuration

**Service Definition**:
```typescript
const inngest = new sst.aws.Service(`Inngest`, {
    cluster,
    image: 'inngest/inngest:latest',
    cpu: '0.25 vCPU',              // 256 CPU units
    memory: '0.5 GB',               // 512 MB memory
    
    // Load balancer configuration
    loadBalancer: {
        ports: [
            { 
                listen: '80/http',
                forward: '8288/http'
            }
        ],
        health: {
            path: '/health',
            protocol: 'http',
            port: '8288'
        }
    },
    
    // Auto-scaling configuration
    scaling: {
        min: 1,
        max: 3,
        cpuUtilization: 70,
        memoryUtilization: 80
    }
})
```

**Container Health Monitoring**:
```bash
# Check service status
aws ecs describe-services --cluster mcplatform-production-cluster --services inngest-service

# View container logs
aws logs tail /ecs/inngest-service --follow

# Check task health
aws ecs describe-tasks --cluster mcplatform-production-cluster --tasks [task-arn]
```

#### Service Discovery and Load Balancing

**Application Load Balancer**:
- **Target Groups**: Health checks on `/health` endpoint
- **SSL Termination**: Automatic via ACM certificates
- **Sticky Sessions**: Not required (stateless services)

**Internal Service Communication**:
```javascript
// Service-to-service communication
const callInternalService = async (endpoint, data) => {
    const response = await fetch(`http://inngest.internal:8288/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`
        },
        body: JSON.stringify(data)
    })
    
    if (!response.ok) {
        throw new Error(`Service call failed: ${response.statusText}`)
    }
    
    return response.json()
}
```

### Lambda Functions and Serverless Components

#### Database Migration Function

**Handler Implementation**:
```javascript
// packages/database/migrator.handler
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

export const handler = async (event) => {
    console.log('Starting database migration...')
    
    try {
        const client = postgres(process.env.DATABASE_URL, { max: 1 })
        const db = drizzle(client)
        
        await migrate(db, {
            migrationsFolder: 'migrations',
            migrationsTable: 'drizzle_migrations'
        })
        
        console.log('Migration completed successfully')
        await client.end()
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: 'Migration completed',
                timestamp: new Date().toISOString()
            })
        }
    } catch (error) {
        console.error('Migration failed:', error)
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                timestamp: new Date().toISOString()
            })
        }
    }
}
```

**Migration Monitoring**:
```bash
# Check migration function logs
aws logs tail /aws/lambda/mcplatform-production-database-migrator --follow

# View migration history in database
bunx sst shell --stage production
psql $DATABASE_URL -c "SELECT * FROM drizzle_migrations ORDER BY created_at DESC LIMIT 10;"

# Manual migration rollback (if needed)
bunx sst shell --stage production
cd /app && bun run db:rollback --steps=1
```

#### Custom Lambda Functions

**API Gateway Integration** (if needed):
```typescript
// Custom Lambda for specific endpoints
const apiFunction = new sst.aws.Function('CustomAPI', {
    handler: 'packages/lambda/api.handler',
    url: true,  // Function URL
    environment: {
        DATABASE_URL: postgres.connectionString,
        REDIS_URL: redis.connectionString
    }
})

// Add to API Gateway routes
const api = new sst.aws.ApiGatewayV2('API', {
    routes: {
        'POST /api/custom': apiFunction.arn
    }
})
```

### DNS and Domain Management

#### Route 53 Configuration

**Hosted Zone Structure**:
```
naptha.gg. (primary domain)
├── A Record: 192.0.2.1 (CloudFront distribution)
├── AAAA Record: 2001:db8::1 (IPv6 support)
├── MX Records: mail servers
├── TXT Records: domain verification
└── *.naptha.gg. (wildcard)
    └── A Record: 192.0.2.1 (same CloudFront)
```

**SSL Certificate Management**:
```typescript
// Automatic certificate provisioning
domain: {
    name: domainName,
    dns: sst.aws.dns(),
    
    // Certificate validation
    certificate: {
        domain: domainName,
        alternativeNames: [`*.${domainName}`],
        validation: 'dns'  // Automatic DNS validation
    }
}
```

#### Custom Domain Configuration

**Multi-Region Setup** (future enhancement):
```typescript
// Multiple regions for better performance
const primaryRegion = new sst.aws.Nextjs('Dashboard-US', {
    domain: { name: 'naptha.gg' },
    region: 'us-east-1'
})

const europeanRegion = new sst.aws.Nextjs('Dashboard-EU', {
    domain: { name: 'eu.naptha.gg' },
    region: 'eu-west-1'
})
```

### Security Hardening

#### IAM Role Configuration

**Principle of Least Privilege**:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "rds:DescribeDBInstances",
                "rds:Connect"
            ],
            "Resource": "arn:aws:rds:*:*:db:mcplatform-production-*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "elasticache:DescribeCacheClusters"
            ],
            "Resource": "arn:aws:elasticache:*:*:cluster:mcplatform-production-*"
        },
        {
            "Effect": "Deny",
            "Action": [
                "rds:DeleteDBInstance",
                "rds:ModifyDBInstance"
            ],
            "Resource": "*"
        }
    ]
}
```

#### Network Security Enhancements

**VPC Endpoints** (for improved security):
```typescript
// Private endpoints for AWS services
const vpcEndpoints = {
    s3: new aws.ec2.VpcEndpoint('S3Endpoint', {
        vpcId: vpc.id,
        serviceName: 'com.amazonaws.us-east-1.s3',
        vpcEndpointType: 'Gateway'
    }),
    
    rds: new aws.ec2.VpcEndpoint('RDSEndpoint', {
        vpcId: vpc.id,
        serviceName: 'com.amazonaws.us-east-1.rds',
        vpcEndpointType: 'Interface'
    })
}
```

**Web Application Firewall (WAF)**:
```typescript
// CloudFront WAF configuration
const webAcl = new aws.wafv2.WebAcl('WebACL', {
    scope: 'CLOUDFRONT',
    defaultAction: { allow: {} },
    
    rules: [
        {
            name: 'RateLimitRule',
            priority: 1,
            action: { block: {} },
            statement: {
                rateBasedStatement: {
                    limit: 10000,  // Requests per 5 minutes
                    aggregateKeyType: 'IP'
                }
            }
        },
        {
            name: 'AWSManagedRulesCommonRuleSet',
            priority: 2,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: 'AWS',
                    name: 'AWSManagedRulesCommonRuleSet'
                }
            }
        }
    ]
})
```

### Backup and Disaster Recovery

#### RDS Backup Strategy

**Automated Backups**:
- **Daily Snapshots**: Automatic at 3:00 AM UTC
- **Retention Period**: 7 days for development, 30 days for production
- **Cross-Region Replication**: Manual setup for critical production data

**Manual Backup Procedures**:
```bash
# Create manual snapshot
aws rds create-db-snapshot \
    --db-instance-identifier mcplatform-production-postgres \
    --db-snapshot-identifier manual-backup-$(date +%Y%m%d-%H%M%S)

# List available snapshots
aws rds describe-db-snapshots \
    --db-instance-identifier mcplatform-production-postgres

# Restore from snapshot (creates new instance)
aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier mcplatform-production-postgres-restored \
    --db-snapshot-identifier manual-backup-20240902-120000
```

#### Application Data Backup

**Database Export Strategy**:
```bash
# Full database export
bunx sst shell --stage production
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Table-specific exports
pg_dump $DATABASE_URL \
    --table=organizations \
    --table=mcp_servers \
    --table=walkthroughs > critical-data-backup.sql

# Export to S3
aws s3 cp backup-$(date +%Y%m%d).sql s3://mcplatform-backups/database/
```

#### Disaster Recovery Procedures

**RTO/RPO Targets**:
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Data Loss Tolerance**: Maximum 1 hour of transactions

**Recovery Playbook**:
1. **Assess Impact**: Determine scope of outage
2. **Activate Incident Response**: Notify stakeholders
3. **Database Recovery**: Restore from latest snapshot
4. **Application Deployment**: Deploy to new infrastructure if needed
5. **DNS Failover**: Update DNS records if required
6. **Verification**: Full system functionality testing
7. **Post-Incident Review**: Document lessons learned

### Performance Monitoring and Optimization

#### CloudWatch Metrics

**Key Performance Indicators**:
```javascript
// Custom CloudWatch metrics
const publishMetric = async (metricName, value, unit = 'Count') => {
    await cloudWatch.putMetricData({
        Namespace: 'MCPlatform/Application',
        MetricData: [{
            MetricName: metricName,
            Value: value,
            Unit: unit,
            Timestamp: new Date(),
            Dimensions: [{
                Name: 'Stage',
                Value: process.env.SST_STAGE
            }]
        }]
    }).promise()
}

// Usage tracking
await publishMetric('ToolCalls', 1)
await publishMetric('ActiveSessions', sessionCount)
await publishMetric('ResponseTime', responseTime, 'Milliseconds')
```

**Database Performance Monitoring**:
```sql
-- Monitor active connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Identify slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements 
WHERE mean_time > 1000  -- Queries taking more than 1 second
ORDER BY mean_time DESC;

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Application Performance Monitoring

**Next.js Performance Tracking**:
```javascript
// Performance monitoring with Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'

const sendToAnalytics = (metric) => {
    fetch('/api/analytics', {
        method: 'POST',
        body: JSON.stringify({
            name: metric.name,
            value: metric.value,
            delta: metric.delta,
            id: metric.id
        })
    })
}

// Track Core Web Vitals
getCLS(sendToAnalytics)
getFID(sendToAnalytics)
getFCP(sendToAnalytics)
getLCP(sendToAnalytics)
getTTFB(sendToAnalytics)
```

**API Performance Monitoring**:
```javascript
// API response time tracking
const trackAPICall = (endpoint, startTime, statusCode) => {
    const duration = Date.now() - startTime
    
    publishMetric(`API/${endpoint}/ResponseTime`, duration, 'Milliseconds')
    publishMetric(`API/${endpoint}/Calls`, 1)
    publishMetric(`API/${endpoint}/${statusCode}`, 1)
}

// Usage in API routes
export async function POST(request) {
    const startTime = Date.now()
    
    try {
        const result = await processRequest(request)
        trackAPICall('mcp-server', startTime, 200)
        return Response.json(result)
    } catch (error) {
        trackAPICall('mcp-server', startTime, 500)
        throw error
    }
}
```

### Cost Optimization Strategies

#### Resource Right-Sizing

**Database Optimization**:
```bash
# Monitor database utilization
aws cloudwatch get-metric-statistics \
    --namespace AWS/RDS \
    --metric-name CPUUtilization \
    --dimensions Name=DBInstanceIdentifier,Value=mcplatform-production-postgres \
    --statistics Average \
    --start-time 2024-09-01T00:00:00Z \
    --end-time 2024-09-02T00:00:00Z \
    --period 3600

# Recommendation: Upgrade if CPU > 80% consistently
# Recommendation: Downgrade if CPU < 20% consistently
```

**Lambda Cost Optimization**:
```typescript
// Optimize Lambda function configuration
const optimizedFunction = new sst.aws.Function('OptimizedFunction', {
    handler: 'handler.main',
    timeout: '30 seconds',      // Reduce from default 6 minutes
    memory: '256 MB',           // Right-size based on profiling
    environment: {
        NODE_OPTIONS: '--max-old-space-size=256'  // Match memory limit
    }
})
```

#### Cost Monitoring Dashboard

**CloudWatch Dashboard**:
```javascript
// Custom cost tracking
const costDashboard = {
    widgets: [
        {
            type: 'metric',
            properties: {
                metrics: [
                    ['AWS/Billing', 'EstimatedCharges', 'Currency', 'USD'],
                    ['AWS/RDS', 'DatabaseConnections', 'DBInstanceIdentifier', 'mcplatform-production-postgres'],
                    ['AWS/ECS', 'CPUUtilization', 'ServiceName', 'inngest-service']
                ],
                period: 3600,
                stat: 'Average',
                region: 'us-east-1',
                title: 'MCPlatform Cost and Utilization'
            }
        }
    ]
}
```

### Advanced Troubleshooting Guide

#### Infrastructure Debugging

**SST Stack Issues**:
```bash
# Debug SST deployment
bunx sst deploy --stage production --verbose

# Check CloudFormation stack status
aws cloudformation describe-stacks --stack-name mcplatform-production

# View stack events
aws cloudformation describe-stack-events --stack-name mcplatform-production

# Check for failed resources
aws cloudformation list-stack-resources --stack-name mcplatform-production \
    | grep -v "CREATE_COMPLETE\|UPDATE_COMPLETE"
```

**Network Connectivity Issues**:
```bash
# Test VPC connectivity from bastion host
ssh -i ~/.ssh/bastion-key.pem ec2-user@bastion-ip

# Test database connectivity
telnet rds-endpoint.amazonaws.com 5432

# Test Redis connectivity  
redis-cli -h redis-endpoint.amazonaws.com -p 6379 ping

# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
```

#### Database Debugging

**Connection Issues**:
```sql
-- Check current connections
SELECT 
    pid,
    usename,
    application_name,
    client_addr,
    state,
    query_start,
    query
FROM pg_stat_activity 
ORDER BY query_start DESC;

-- Kill problematic connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle in transaction' 
AND query_start < now() - interval '1 hour';
```

**Performance Issues**:
```sql
-- Check for locks
SELECT 
    l.pid,
    l.mode,
    l.granted,
    a.query,
    a.state
FROM pg_locks l 
JOIN pg_stat_activity a ON l.pid = a.pid 
WHERE NOT l.granted;

-- Analyze table statistics
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    last_vacuum,
    last_analyze
FROM pg_stat_user_tables 
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;
```

#### Application Debugging

**Next.js Issues**:
```bash
# Check application logs
aws logs tail /aws/lambda/mcplatform-production-dashboard --follow

# Check build logs
bunx sst logs --stage production --function dashboard

# Debug SSR issues
NODE_ENV=production bunx next build
bunx next start
```

**Inngest Service Issues**:
```bash
# Check service health
curl -f http://inngest-service.internal:8288/health

# Check Inngest logs
aws ecs describe-services --cluster mcplatform-production-cluster --services inngest
aws logs tail /ecs/inngest-service --follow

# Debug job processing
bunx sst shell --stage production
redis-cli -h $REDIS_HOST -p $REDIS_PORT
LLEN inngest:jobs  # Check job queue length
```

### Production Deployment Checklist

#### Pre-Deployment Validation

**Code Quality Checks**:
```bash
# Run all tests
bun run tests

# Type checking
bun run typecheck

# Lint code
bun run lint

# Build verification
bun run build

# Security audit
bun audit
```

**Infrastructure Validation**:
```bash
# Validate SST configuration
bunx sst validate --stage production

# Check AWS credentials and permissions
aws sts get-caller-identity
aws iam simulate-principal-policy \
    --policy-source-arn $(aws sts get-caller-identity --query Arn --output text) \
    --action-names rds:CreateDBInstance ec2:RunInstances \
    --resource-arns "*"

# Verify domain ownership
dig naptha.gg NS
dig naptha.gg SOA
```

**Environment Configuration**:
```bash
# Validate environment variables
node -e "
const required = ['BETTER_AUTH_SECRET', 'INNGEST_EVENT_KEY', 'GITHUB_CLIENT_ID'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
    console.error('Missing required environment variables:', missing);
    process.exit(1);
}
console.log('All required environment variables are set');
"
```

#### Post-Deployment Verification

**System Health Checks**:
```bash
# Check application availability
curl -f https://naptha.gg/api/health

# Verify MCP server routing
curl -f https://test-server.naptha.gg/api/mcpserver/mcp

# Test authentication flow
curl -f https://naptha.gg/api/auth/session

# Validate database connectivity
bunx sst shell --stage production
psql $DATABASE_URL -c "SELECT 1;" || echo "Database connection failed"

# Check background job processing
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

**Performance Verification**:
```bash
# Load testing with curl
for i in {1..100}; do
    curl -w "@curl-format.txt" -s -o /dev/null https://naptha.gg/
done

# Database performance check
bunx sst shell --stage production
psql $DATABASE_URL -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins + n_tup_upd + n_tup_del as total_changes,
    seq_scan,
    seq_tup_read
FROM pg_stat_user_tables 
WHERE seq_scan > 1000 OR seq_tup_read > 10000;
"
```

**Monitoring Setup Verification**:
```bash
# Check CloudWatch logs are flowing
aws logs describe-log-streams --log-group-name /aws/lambda/mcplatform-production-dashboard

# Verify metrics are being published
aws cloudwatch list-metrics --namespace MCPlatform/Application

# Test alerting (if configured)
aws sns publish --topic-arn arn:aws:sns:us-east-1:123456789:alerts \
    --message "Test alert from deployment verification"
```

## Additional Resources

- [SST Documentation](https://sst.dev/docs/) - Official SST guides
- [AWS Best Practices](https://aws.amazon.com/architecture/well-architected/) - AWS Well-Architected Framework
- [Next.js Deployment](https://nextjs.org/docs/deployment) - Next.js production deployment guide
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization) - Database optimization
- [Redis Best Practices](https://redis.io/docs/manual/admin/) - Cache optimization strategies
- [AWS Cost Optimization](https://aws.amazon.com/aws-cost-management/) - Cost monitoring and reduction