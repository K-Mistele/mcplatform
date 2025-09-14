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

// Domain configuration
const DOMAIN_NAME = process.env.DOMAIN_NAME || 'naptha.gg'

// Ngrok configuration for development
const NGROK_STATIC_URL = process.env.NGROK_STATIC_URL

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
        const vpc = new sst.aws.Vpc(`Vpc`, {
            nat: {
                type: 'managed'
            },
            bastion: true
        })

        // ECS cluster to run the inngest service
        const cluster = new sst.aws.Cluster(`Cluster`, { vpc })

        // Redis instance for inngest and caching
        const redis = new sst.aws.Redis(`Redis`, {
            vpc,
            engine: 'valkey',
            cluster: {
                nodes: 1
            }
        })

        // Postgre database for inngest and the app
        const postgres = new sst.aws.Postgres(`Postgres`, {
            vpc,
            database: 'postgres',
            proxy: false
        })

        // Bucket for the app
        const bucket = new sst.aws.Bucket(`Bucket`, {
            enforceHttps: true
        })

        // Configure the next.js app domain; this will be used to connect inngest to the app.
        const appDomain = $app.stage === 'production' ? DOMAIN_NAME : `${$app.stage}.${DOMAIN_NAME}`
        const appUrl = `https://${appDomain}/api/inngest`

        // URL-encode the postgres and redis passwords since inngest uses net/url in go
        // and it needs them URL-encoded since they have special characters
        const urlEncodedPostgresPassword = $resolve([postgres.password]).apply(([postgresPw]) =>
            encodeURIComponent(postgresPw!)
        )
        const urlEncodedRedisPassword = $resolve([redis.password]).apply(([redisPw]) => encodeURIComponent(redisPw!))

        // Configure the inngest service
        const inngestCommand = [
            'inngest',
            'start',
            '-u',
            $dev ? `https://${NGROK_STATIC_URL}/api/inngest` : appUrl,
            '--signing-key',
            INNGEST_SIGNING_KEY,
            '--event-key',
            INNGEST_EVENT_KEY
        ]
        if ($app.stage === 'production') inngestCommand.push('--no-ui')
        const inngest = new sst.aws.Service(`Inngest`, {
            cluster,
            image: 'inngest/inngest:latest',
            command: inngestCommand,
            environment: {
                INNGEST_EVENT_KEY,
                INNGEST_SIGNING_KEY,
                INNGEST_POSTGRES_URI: $interpolate`postgres://${postgres.username}:${urlEncodedPostgresPassword}@${postgres.host}:${postgres.port}/${postgres.database}`,
                INNGEST_REDIS_URI: $interpolate`redis://${redis.username}:${urlEncodedRedisPassword}@${redis.host}:${redis.port}/1`,
                INNGEST_DEV: '0'
            },
            link: [redis, postgres],
            loadBalancer: {
                ports: [{ listen: '8288/tcp' }]
            },
            serviceRegistry: {
                port: 8288
            },
            // force it to deploy with SST dev since we need to test!
            dev: false
        })

        const migrator = new sst.aws.Function('DatabaseMigrator', {
            link: [postgres],
            vpc,
            handler: 'packages/database/migrator.handler',
            copyFiles: [
                {
                    from: 'packages/database/migrations',
                    to: 'migrations'
                }
            ],
            environment: {
                DATABASE_URL: $interpolate`postgres://${postgres.username}:${urlEncodedPostgresPassword}@${postgres.host}:${postgres.port}/${postgres.database}`
            },
            dev: false // force it to deploy with SST dev since we need to test!
        })

        new aws.lambda.Invocation('DatabaseMigratorInvocation', {
            input: Date.now().toString(),
            functionName: migrator.name
        })

        // start drizzle studio
        new sst.x.DevCommand('Studio', {
            link: [postgres],
            dev: {
                command: 'bun run studio'
            }
        })

        const domainName = $app.stage === 'production' ? DOMAIN_NAME : `${$app.stage}.${DOMAIN_NAME}`

        const nextApp = new sst.aws.Nextjs('Dashboard', {
            path: './packages/dashboard',
            regions: ['us-east-1'],
            domain: {
                name: domainName,
                dns: sst.aws.dns(),
                redirects: [`www.${domainName}`],
                aliases: [`*.${domainName}`]
            },
            link: [postgres, bucket, inngest, redis],
            vpc,
            environment: {
                INNGEST_EVENT_KEY,
                INNGEST_SIGNING_KEY,
                INNGEST_BASE_URL: inngest.url,
                GITHUB_CLIENT_ID,
                GITHUB_CLIENT_SECRET,
                GOOGLE_CLIENT_ID,
                GOOGLE_CLIENT_SECRET,
                NEXT_PUBLIC_BETTER_AUTH_URL: $dev ? NEXT_PUBLIC_BETTER_AUTH_URL : `https://${domainName}`,
                BETTER_AUTH_SECRET,
                GOOGLE_API_KEY,
                TURBOPUFFER_API_KEY
            },
            warm: 1,
            dev: {
                command: 'bun run dev'
            }
        })

        // Set up ngrok so that the inngest service can connect to the app
        new sst.x.DevCommand('Ngrok', {
            link: [nextApp],
            dev: {
                command: 'bun run scripts/ngrok.ts'
            }
        })
    }
})
