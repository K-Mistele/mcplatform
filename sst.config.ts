/// <reference path="./.sst/platform/config.d.ts" />

const requireEnv = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

const INNGEST_EVENT_KEY = requireEnv('INNGEST_EVENT_KEY')
const INNGEST_SIGNING_KEY = requireEnv('INNGEST_SIGNING_KEY')

const GITHUB_CLIENT_ID = requireEnv('GITHUB_CLIENT_ID')
const GITHUB_CLIENT_SECRET = requireEnv('GITHUB_CLIENT_SECRET')

const GOOGLE_CLIENT_ID = requireEnv('GOOGLE_CLIENT_ID')
const GOOGLE_CLIENT_SECRET = requireEnv('GOOGLE_CLIENT_SECRET')

const BETTER_AUTH_SECRET = requireEnv('BETTER_AUTH_SECRET')
const NEXT_PUBLIC_BETTER_AUTH_URL = requireEnv('NEXT_PUBLIC_BETTER_AUTH_URL')
const GOOGLE_API_KEY = requireEnv('GOOGLE_API_KEY')
const TURBOPUFFER_API_KEY = requireEnv('TURBOPUFFER_API_KEY')

export default $config({
    app(input) {
        return {
            name: 'mcplatform',
            removal: input?.stage === 'production' ? 'retain' : 'remove',
            protect: ['production'].includes(input?.stage),
            home: 'aws'
        }
    },
    async run() {
        const vpc = new sst.aws.Vpc(`McpPlatformVpc`)

        const cluster = new sst.aws.Cluster(`McpPlatformCluster`, { vpc })

        const redis = new sst.aws.Redis(`McpPlatformRedis`, {
            vpc,
            engine: 'valkey',
            cluster: {
                nodes: 1
            }
        })

        const postgres = new sst.aws.Postgres(`McpPlatformPostgres`, {
            vpc,
            database: 'postgres'
        })

        const bucket = new sst.aws.Bucket(`McpPlatformBucket`, {
            enforceHttps: true
        })

        const appDomain = $app.stage === 'production' ? 'naptha.gg' : `${$app.stage}.naptha.gg`
        const appUrl = `https://${appDomain}/api/inngest`

        const inngestCommand = ['inngest', 'start', '-u', appUrl]
        //if ($app.stage !== 'production') inngestCommand.push('--no-ui')
        const inngest = new sst.aws.Service(`McpPlatformInngestService`, {
            cluster,
            image: 'inngest/inngest:latest',
            command: inngestCommand,
            environment: {
                INNGEST_EVENT_KEY,
                INNGEST_SIGNING_KEY,
                INNGEST_POSTGRES_URI: $interpolate`postgres://${postgres.username}:${postgres.password}@${postgres.host}:${postgres.port}/${postgres.database}`,
                INNGEST_REDIS_URI: $interpolate`redis://${redis.username}:${redis.password}@${redis.host}:${redis.port}/1`
            },
            link: [redis, postgres],
            loadBalancer: {
                ports: [{ listen: '8288/tcp' }]
            },
            serviceRegistry: {
                port: 8288
            },
            dev: false // force it to deploy with SST dev since we need to test!
        })

        const nextjsApp = new sst.aws.Nextjs(`McpPlatformNextjsApp`, {
            vpc,
            link: [postgres, bucket],
            path: 'packages/dashboard',
            environment: {
                INNGEST_EVENT_KEY,
                INNGEST_SIGNING_KEY,
                INNGEST_BASE_URL: inngest.url,
                DATABASE_URL: $interpolate`postgres://${postgres.username}:${postgres.password}@${postgres.host}:${postgres.port}/${postgres.database}`,
                GITHUB_CLIENT_ID,
                GITHUB_CLIENT_SECRET,
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                NEXT_PUBLIC_BETTER_AUTH_URL,
                BETTER_AUTH_SECRET,
                GOOGLE_API_KEY,
                TURBOPUFFER_API_KEY
            },
            dev: false,
            domain: appDomain
        })
    }
})
