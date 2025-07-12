import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { mcp } from 'better-auth/plugins'
import { db } from 'database'

export const auth = betterAuth({
    plugins: [
        mcp({
            loginPage: '/login'
        })
    ],
    database: drizzleAdapter(db, {
        provider: 'pg'
    })
})
