import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as authSchema from './src/auth-schema'
import * as nonAuthSchema from './src/schema'

export const db = drizzle(process.env.DATABASE_URL!)

export const schema = {
    ...authSchema,
    ...nonAuthSchema
}
