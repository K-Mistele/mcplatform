import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { mcp } from 'better-auth/plugins'
import { db, mcpAuthSchema } from 'database'

export const auth = betterAuth({
    basePath: '/authtenant/auth',
    database: drizzleAdapter(db, {
        provider: 'pg', // or "pg" or "mysql"
        schema: {
            user: mcpAuthSchema.mcpOAuthUser,
            session: mcpAuthSchema.mcpOAuthSession,
            account: mcpAuthSchema.mcpOAuthAccount,
            verification: mcpAuthSchema.mcpOAuthVerification,
            oauthApplication: mcpAuthSchema.mcpOAuthApplication,
            oauthAccessToken: mcpAuthSchema.mcpOAuthAccessToken,
            oauthConsent: mcpAuthSchema.mcpOAuthConsent
        }
    }),
    plugins: [
        mcp({
            loginPage: '/authtenant/login'
        })
    ],
    emailAndPassword: {
        enabled: true
    },
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
        }
    }
})

// Type definitions for Better Auth session with organization context
type BaseSession = typeof auth.$Infer.Session
type SessionWithRequiredOrg = BaseSession & {
    session: BaseSession['session'] & {
        activeOrganizationId: string
    }
}
// Type-safe overloaded function
interface GetSessionOverloads {
    (): Promise<SessionWithRequiredOrg>
    (params: { data: { organizationRequired: boolean } }): Promise<BaseSession>
    (params?: { data?: { organizationRequired?: true } }): Promise<SessionWithRequiredOrg>
}
