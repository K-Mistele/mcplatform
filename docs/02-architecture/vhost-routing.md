# VHost Routing Architecture

MCPlatform uses a unique Virtual Host (VHost) routing system to serve unlimited MCP servers through a single API endpoint using subdomain-based routing.

## Overview

Instead of path-based routing (e.g., `/api/servers/acme-corp`), MCPlatform uses subdomain-based routing (e.g., `acme-corp.naptha.gg`) to dynamically resolve and serve different MCP servers. This approach enables:

- **Unlimited scalability**: No URL path conflicts between customer servers
- **Clean separation**: Each customer gets their own subdomain
- **Standard MCP compliance**: Servers appear as independent endpoints
- **Security isolation**: Natural request isolation by subdomain

## Request Flow Diagram

```
1. Client Request
   └── acme-corp.naptha.gg/api/mcpserver/...

2. DNS Resolution
   └── *.naptha.gg → Load Balancer

3. Host Header Extraction
   └── host: "acme-corp.naptha.gg"

4. Subdomain Extraction  
   └── subdomain: "acme-corp"

5. Database Lookup
   └── SELECT * FROM mcp_servers WHERE slug = 'acme-corp'

6. Dynamic Handler Creation
   └── createHandlerForServer(serverConfig)

7. MCP Protocol Response
   └── Standard MCP JSON-RPC response
```

## Implementation Details

### Host Header Processing

The core routing logic is in `packages/dashboard/src/lib/mcp/index.ts:117-159`:

```typescript
export async function getMcpServerConfiguration(request: Request) {
    // Get application base URL from environment
    const thisUrl = new URL(process.env.NEXT_PUBLIC_BETTER_AUTH_URL)
    
    // Extract host from header or request URL
    const requestHost = request.headers.get('host') ?? new URL(request.url).host
    const requestHostname = requestHost.split(':')[0] // Remove port
    
    // Parse domain segments
    const thisUrlDomainSegments = thisUrl.hostname.split('.')
    const requestUrlDomainSegments = requestHostname.split('.')
    
    // Prevent direct access to main domain
    if (thisUrl.hostname === requestHostname) {
        throw new Error('MCP server connections must use the configured VHost')
    }
    
    // Validate subdomain structure (one level under main domain)
    const requestIsOneLevelUnderApplicationOnSameDomain =
        requestUrlDomainSegments.length === thisUrlDomainSegments.length + 1 &&
        requestUrlDomainSegments.slice(-thisUrlDomainSegments.length).join('.') === thisUrlDomainSegments.join('.')
    
    if (!requestIsOneLevelUnderApplicationOnSameDomain) {
        throw new Error('MCP server must be accessed via a direct subdomain of the application')
    }
    
    // Extract subdomain slug
    const subdomain = requestUrlDomainSegments[0]
    
    // Database lookup
    const [serverConfig] = await db
        .select()
        .from(schema.mcpServers)
        .where(eq(schema.mcpServers.slug, subdomain))
        .limit(1)
    
    return serverConfig ?? null
}
```

### DNS Configuration

The wildcard DNS setup is configured in `sst.config.ts:147-149`:

```typescript
domain: {
    name: domainName,               // naptha.gg
    dns: sst.aws.dns(),
    redirects: [`www.${domainName}`],
    aliases: [`*.${domainName}`]    // *.naptha.gg → ALB
}
```

This creates:
- **Main domain**: `naptha.gg` → Dashboard application  
- **Wildcard**: `*.naptha.gg` → Same ALB, routed by Host header
- **WWW redirect**: `www.naptha.gg` → `naptha.gg`

### Database Schema

MCP servers are stored with routing information:

```sql
CREATE TABLE mcp_servers (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,          -- Subdomain identifier
    name TEXT NOT NULL,                 -- Display name
    organization_id TEXT NOT NULL,      -- Owner organization
    domain TEXT,                        -- Future: custom domains
    -- ... other config fields
);
```

The `slug` field must be:
- **Unique globally**: No two servers can have the same slug
- **DNS-safe**: Valid subdomain characters only
- **Permanent**: Cannot be changed after creation (affects user integrations)

## Security Considerations

### Subdomain Validation

1. **Length limits**: Slugs are limited to prevent DNS issues
2. **Character restrictions**: Only alphanumeric and hyphens
3. **Reserved names**: Certain slugs are blocked (api, www, mail, etc.)
4. **Ownership verification**: Only organization members can create servers

### Request Isolation

Subdomains provide natural request isolation:
- **Cookie scope**: Cookies are isolated per subdomain
- **CORS policies**: Each subdomain has independent CORS rules  
- **Rate limiting**: Applied per subdomain, not globally
- **Logging**: Requests tagged with server identifier

### SSL/TLS Handling

Wildcard certificate covers all subdomains:
- **Certificate**: `*.naptha.gg` wildcard cert
- **Automatic renewal**: Handled by AWS Certificate Manager
- **HTTPS enforcement**: All HTTP requests redirect to HTTPS
- **HSTS headers**: Prevent downgrade attacks

## Performance Implications

### Database Query Pattern

Each request requires one database query:
```sql
SELECT * FROM mcp_servers WHERE slug = $subdomain LIMIT 1;
```

**Optimization strategies**:
- **Index on slug**: Primary lookup path
- **Connection pooling**: Reuse database connections
- **Query caching**: Redis cache for frequently accessed servers
- **Read replicas**: Scale read operations

### Memory Usage

Each subdomain creates a separate MCP handler instance:
- **Handler lifecycle**: Created per request, not cached
- **Memory footprint**: Minimal per-request overhead
- **Garbage collection**: Handlers cleaned up after response
- **Resource limits**: No built-in limits on concurrent subdomains

### CDN Considerations

Wildcard domains work with CDN caching:
- **Cache keys**: Include subdomain in cache key
- **Purging**: Can purge per-subdomain or globally
- **Edge optimization**: Static assets served from CDN
- **Geographic distribution**: Reduced latency worldwide

## Debugging VHost Issues

### Common Problems

1. **DNS propagation delays**:
   ```bash
   # Check DNS resolution
   nslookup your-slug.naptha.gg
   dig your-slug.naptha.gg
   ```

2. **SSL certificate issues**:
   ```bash
   # Test SSL connectivity
   openssl s_client -connect your-slug.naptha.gg:443
   ```

3. **Host header manipulation**:
   ```bash
   # Test with explicit host header
   curl -H "Host: your-slug.naptha.gg" https://naptha.gg/api/mcpserver/...
   ```

### Development Testing

Local development uses different domains:
- **Production**: `*.naptha.gg`
- **Staging**: `*.staging.naptha.gg` 
- **Development**: `*.dev.naptha.gg`
- **Local**: Requires ngrok for external access

Test subdomain routing locally:
```bash
# Start development server
bun run dev

# Access via ngrok subdomain  
curl https://your-slug.your-ngrok-domain.ngrok-free.app/api/mcpserver/...
```

### Monitoring and Logging

Track routing performance:
- **Request logs**: Include subdomain in log entries
- **Error tracking**: Monitor failed subdomain resolutions
- **Performance metrics**: Database query time by subdomain
- **Usage analytics**: Popular subdomains and traffic patterns

Example log entry:
```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info", 
  "message": "MCP server request",
  "subdomain": "acme-corp",
  "server_id": "srv_12345",
  "response_time_ms": 45,
  "status": 200
}
```

## Scaling Considerations

### Database Scaling

As the number of MCP servers grows:
- **Sharding**: Partition servers across databases
- **Read replicas**: Scale lookup operations
- **Caching**: Redis cache for hot subdomains
- **Indexing**: Optimize slug lookups

### Infrastructure Scaling

Wildcard domains scale automatically:
- **Load balancer**: Handles all subdomains equally
- **Auto-scaling**: Application servers scale with traffic
- **CDN**: Caches responses across all subdomains
- **Monitoring**: Track per-subdomain metrics

### Rate Limiting

Implement per-subdomain rate limiting:
```typescript
// Example rate limiting by subdomain
const rateLimitKey = `mcp_requests:${subdomain}`
const currentCount = await redis.incr(rateLimitKey)
if (currentCount === 1) {
    await redis.expire(rateLimitKey, 60) // 1 minute window
}
if (currentCount > 100) { // 100 requests per minute
    throw new Error('Rate limit exceeded')
}
```

## Future Enhancements

### Custom Domains

Support customer-provided domains:
- **CNAME setup**: Point customer domain to MCPlatform
- **SSL certificates**: Automatic cert generation
- **Domain verification**: Prove domain ownership
- **Migration path**: Move from subdomain to custom domain

### Geographic Routing

Route subdomains to regional endpoints:
- **Geolocation**: Detect user location
- **Regional databases**: Reduce query latency
- **Data residency**: Comply with local regulations
- **Failover**: Automatic fallback to other regions

### Advanced Security

Enhanced subdomain security:
- **DDoS protection**: Per-subdomain rate limiting
- **WAF rules**: Custom rules per subdomain
- **Access controls**: IP allowlisting per subdomain
- **Audit logging**: Detailed security events

## Related Documentation

- [Dual Authentication System](../03-authentication/dual-auth-system.md)
- [MCP Server API](../05-mcp-servers/mcp-api.md)
- [Database Schema Design](../04-database/schema-design.md)
- [Deployment Guide](../08-deployment/sst-deployment.md)