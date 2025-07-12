import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as authSchema from './src/auth-schema'
import * as nonAuthSchema from './src/schema'

export const schema = {
    ...authSchema,
    ...nonAuthSchema
}
export const db = drizzle(process.env.DATABASE_URL!, {
    schema: schema
})

export type {
    Account,
    Invitation,
    Member,
    OAuthAccessToken,
    OAuthApplication,
    OAuthConsent,
    Organization,
    Session,
    User,
    Verification
} from './src/auth-schema'
export { authSchema }
