import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as authSchema from './src/auth-schema'
import * as mcpAuthSchema from './src/mcp-auth-schema'
import * as nonAuthSchema from './src/schema'

export const schema = {
    ...authSchema,
    ...nonAuthSchema,
    ...mcpAuthSchema
}
export const db = drizzle(process.env.DATABASE_URL!, {
    schema: schema
})
export * from './src/auth-schema'
export * from './src/mcp-auth-schema'
export * from './src/schema'
