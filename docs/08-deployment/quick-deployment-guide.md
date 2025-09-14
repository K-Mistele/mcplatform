# MCPlatform Quick Deployment Management

Essential commands for managing deployed MCPlatform instances.

## Check What's Deployed

```bash
# List all stages
bun sst state list

# Check specific stage resources
bun sst state export --stage dev
```

## Access Logs

### Next.js Application Logs
```bash
# Find log groups (formatted)
aws logs describe-log-groups --region us-east-1 --log-group-name-prefix="/aws/lambda/mcplatform-dev" --query 'logGroups[].logGroupName' --output text | tr '\t' '\n'

# Follow logs (replace with actual log group name)
aws logs tail "/aws/lambda/mcplatform-dev-DashboardServerUseast1Function-wdsaeear" --region us-east-1 --follow
```

### Database Access
```bash
# One tunnel serves all database connections:

# Terminal 1: Start tunnel (keep this running for everything)
bun sst tunnel --stage dev

# Terminal 2: Run Drizzle Studio
bun run studio
# Access: https://local.drizzle.studio/

# Terminal 3 (or any other): Connect with psql (uses same tunnel)
bun sst shell --stage dev -- psql $DATABASE_URL
```

## Service Management

### Restart Services
```bash
# Redeploy entire stage (restarts all services)
bun sst deploy --stage dev

# Force redeploy without changes
bun sst deploy --stage dev --force
```

## Health Checks

```bash
# Check application
curl -I https://dev.naptha.gg/

# Test database connection (need tunnel running first)
# Terminal 1: bun sst tunnel --stage dev
# Terminal 2: bun sst shell --stage dev -- psql $DATABASE_URL -c "SELECT version();"
```

## Monitoring (AWS CLI for viewing only)

```bash
# Check ECS service status
aws ecs describe-services --region us-east-1 --cluster mcplatform-dev-ClusterCluster-{id} --services Inngest --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'

# List all services
aws ecs list-clusters --region us-east-1 --query "clusterArns[?contains(@, 'mcplatform-dev')]" --output text
```

## Stage Management

```bash
# Deploy new stage
bun sst deploy --stage {stage-name}

# Remove stage (be careful!)
bun sst remove --stage {stage-name}
```

## Quick Troubleshooting

### Application Not Responding
1. Check logs: `aws logs tail "/aws/lambda/mcplatform-dev-Dashboard..." --region us-east-1`
2. Check health: `curl -I https://dev.naptha.gg/`

### Database Issues
1. Test connection: `bun sst tunnel --stage dev -- psql -c "SELECT 1;"`
2. Check RDS status: `aws rds describe-db-instances --region us-east-1 --query 'DBInstances[?contains(DBInstanceIdentifier, `mcplatform-dev`)].DBInstanceStatus'`

### Inngest Service Down
1. Check status: `aws ecs describe-services --region us-east-1 --cluster mcplatform-dev-ClusterCluster-{id} --services Inngest`
2. Restart: `bun sst deploy --stage dev --force`

---

**Note:** Replace `{id}` and `{stage-name}` with actual values from your deployment.