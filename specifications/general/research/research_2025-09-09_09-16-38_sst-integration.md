---
date: 2025-09-09T09:16:38-05:00
researcher: claude
git_commit: e6cc18672e9e31c5121252df6bdad18f72758096
branch: master
repository: mcplatform
topic: "SST Integration in MCPlatform Codebase"
tags: [research, sst, infrastructure, deployment, aws]
status: complete
last_updated: 2025-09-09
last_updated_by: claude
type: research
---

# Research: SST Integration in MCPlatform Codebase

**Date**: 2025-09-09T09:16:38-05:00
**Researcher**: claude
**Git Commit**: e6cc18672e9e31c5121252df6bdad18f72758096
**Branch**: master
**Repository**: mcplatform

## Research Question
How is SST (Serverless Stack) integrated into the MCPlatform codebase? Check out docs/ for any information that's in there as well.

## Summary
MCPlatform uses SST v3 as its primary Infrastructure as Code (IaC) solution for AWS deployment. SST orchestrates a comprehensive multi-service architecture including VPC networking, PostgreSQL database, Redis cache, ECS container services, S3 storage, Lambda functions, and a Next.js application with custom domain routing. The integration is deeply embedded throughout the codebase with type-safe resource access, automatic environment variable injection, and stage-based deployment management.

## Detailed Findings

### Core SST Configuration (`sst.config.ts`)
The main SST configuration defines the complete AWS infrastructure stack:

- **App Configuration** (`sst.config.ts:23-31`): Defines app name, resource lifecycle management (retain for production, remove for dev), and AWS as the home provider
- **VPC Infrastructure** (`sst.config.ts:33-38`): Creates isolated network with managed NAT gateway and bastion host for secure access
- **Database Layer** (`sst.config.ts:53-57`): PostgreSQL instance within VPC with proxy disabled for direct connections
- **Cache Layer** (`sst.config.ts:44-50`): Redis/Valkey cluster with single node configuration
- **Compute Layer** (`sst.config.ts:41`): ECS cluster for containerized services
- **Storage Layer** (`sst.config.ts:60-62`): S3 bucket with HTTPS enforcement
- **Background Processing** (`sst.config.ts:87-107`): Inngest service running in ECS with load balancer configuration
- **Database Migrations** (`sst.config.ts:109-128`): Lambda function for automated database migrations on deployment
- **Next.js Application** (`sst.config.ts:140-168`): Frontend application with custom domain and wildcard DNS

### Resource Access Patterns
The codebase uses consistent patterns for accessing SST-provisioned resources:

#### Database Access Pattern
```typescript
// packages/database/index.ts:14-18
import { Resource } from 'sst'
const pg = Resource.Postgres
const dbUrl = `postgresql://${pg.username}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`
export const db = drizzle(dbUrl, { schema: schema })
```

#### Redis Integration Pattern
```typescript
// packages/retrieval/src/redis.ts:4-15
import { Resource } from 'sst'
const { username, password, host, port } = Resource.Redis
export const redisClient = new Redis({ host, port, username, password })
```

#### S3 Storage Pattern
```typescript
// packages/retrieval/src/documents/s3-storage.ts:33-35
import { Resource } from 'sst/resource'
const command = new PutObjectCommand({
    Bucket: Resource.Bucket.name,
    Key: `${organizationId}/${namespaceId}/${documentRelativePathWithExtension}`
})
```

### Environment and Stage Management

#### Stage-Based Configuration
- **Production**: Domain `naptha.gg` with resource retention and protection
- **Development/Staging**: Domain `{stage}.naptha.gg` with resource removal on deletion
- **Local Development**: Uses `sst dev` with ngrok tunneling for external service integration

#### Environment Variable Management
SST handles environment variables through resource linking:
- **Database credentials**: Automatically injected via resource linking
- **Service URLs**: Available through `Resource.ServiceName.url`
- **Stage-specific configuration**: Conditional based on `$app.stage` and `$dev` flags

### Development Workflow Integration

#### Commands and Scripts
- `bun dev` → `sst dev`: Starts development environment with cloud resources
- `bun run tests` → `bun sst shell -- bun test`: Runs tests within SST context
- Script integration: All database scripts require `sst shell` for resource access

#### Type Safety
SST generates TypeScript definitions (`sst-env.d.ts`) in each package:
```typescript
declare module "sst" {
  export interface Resource {
    "Postgres": { "database": string, "host": string, "password": string, "port": number, "username": string }
    "Redis": { "host": string, "password": string, "port": number, "username": string }
    "Bucket": { "name": string }
  }
}
```

### Multi-Tenant Architecture Support
SST enables the platform's multi-tenant architecture through:

- **Wildcard DNS** (`sst.config.ts:147`): `aliases: [`*.${domainName}`]` enables unlimited subdomains for MCP servers
- **VHost-based routing**: Each customer gets a subdomain (e.g., `customer1.naptha.gg`) routed to the same Next.js app
- **Domain management**: Automatic SSL certificate provisioning and DNS management

## Code References
- `sst.config.ts:23-178` - Complete SST configuration and infrastructure definition
- `packages/database/index.ts:3,14-18` - Database resource access pattern
- `packages/retrieval/src/redis.ts:2,4-15` - Redis resource access pattern
- `packages/retrieval/src/documents/s3-storage.ts:5,33-35` - S3 bucket access pattern
- `packages/dashboard/src/app/api/inngest/route.ts:3,5-12` - Service URL access pattern
- `package.json:11-17` - SST development commands and test configuration
- `docs/08-deployment/sst-deployment.md` - Comprehensive deployment guide (1451 lines)

## Architecture Insights

### Infrastructure Design Patterns
1. **Resource Linking**: All services use SST's linking system for automatic credential injection
2. **Stage Isolation**: Complete environment separation through SST stages
3. **Type Safety**: Auto-generated TypeScript definitions ensure compile-time safety
4. **Development Parity**: Local development uses same cloud resources as production

### Service Communication Architecture
- **Database**: Direct connections from all services using SST-provided credentials
- **Cache**: Shared Redis instance across Next.js app and Inngest service
- **Background Jobs**: Inngest service communicates with Next.js app via webhooks
- **File Storage**: S3 bucket shared across services with consistent access patterns

### Security and Operations
- **Network Isolation**: VPC provides private networking for databases and cache
- **Credential Management**: SST handles all AWS credentials and service authentication
- **Migration Strategy**: Automated database migrations via Lambda functions on deployment
- **Monitoring Integration**: Built-in AWS CloudWatch integration through SST

## Historical Context (from specifications/)

### Infrastructure Decision Documentation
Based on research documents in `specifications/general/research/`:

- **Technology Stack**: SST chosen for TypeScript-first infrastructure configuration and AWS integration
- **Multi-Tenant Design**: VHost routing through wildcard DNS eliminates need for manual subdomain configuration
- **Database Architecture**: Triple-schema design (auth, mcp-auth, application) with PostgreSQL + Drizzle ORM
- **Development Workflow**: Bun runtime chosen for performance, SST dev mode for development-production parity

### Deployment Strategy Evolution
From `specifications/general/handoffs/`:

- **Initial Implementation**: Focus on development environment setup and basic infrastructure
- **Production Planning**: Complete deployment guide created covering operations, troubleshooting, and maintenance
- **Documentation Strategy**: Comprehensive documentation plan includes SST-specific deployment procedures

## Related Research
- `specifications/general/research/research_2025-08-29_13-34-14_comprehensive-documentation-plan.md` - Documentation strategy including SST deployment guide
- `specifications/general/research/research_2025-09-03_08-31-57_drizzle-orm-usage.md` - Database architecture with SST integration
- `docs/08-deployment/sst-deployment.md` - Complete SST deployment and operations guide

## Open Questions
1. **CI/CD Integration**: How will automated deployments integrate with SST stages?
2. **Multi-Region Strategy**: Plans for deploying across multiple AWS regions?
3. **Cost Optimization**: Strategies for right-sizing resources across different stages?
4. **Disaster Recovery**: Backup and recovery procedures for SST-managed infrastructure?
5. **Monitoring**: Integration with application performance monitoring tools?

---

## Implementation Notes

### Current State
- **Complete Infrastructure**: All AWS resources defined and provisioned via SST
- **Type-Safe Access**: Full TypeScript integration with auto-generated resource definitions  
- **Development Workflow**: Functional development environment with `sst dev`
- **Documentation**: Comprehensive 1451-line deployment guide available

### Next Steps Identified
1. **Environment Templates**: Create `.env.example` from SST requirements
2. **CI/CD Pipeline**: Implement automated deployment workflows
3. **Monitoring Setup**: Configure application and infrastructure monitoring
4. **Cost Monitoring**: Implement cost tracking and optimization strategies
5. **Multi-Stage Testing**: Establish testing procedures across SST stages