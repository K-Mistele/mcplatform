import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'
import { Resource } from 'sst'

console.log(`loading drizzle config...`, __dirname)

if (!process.env.DATABASE_URL) {
    console.error('missing DATABASE_URL for migrations.')
    process.exit(1)
}
const dbUrl = `postgresql://${Resource.Postgres.username}:${Resource.Postgres.password}@${Resource.Postgres.host}:${Resource.Postgres.port}/${Resource.Postgres.database}`
export default defineConfig({
    dialect: 'postgresql',
    schema: ['./src/schema.ts', './src/auth-schema.ts', './src/mcp-auth-schema.ts'],
    dbCredentials: {
        url: process.env.DATABASE_URL
    },
    out: './migrations'
})
