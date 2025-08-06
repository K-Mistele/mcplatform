import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { mcp } from 'better-auth/plugins'
import {
    db,
    mcpOAuthAccessToken,
    mcpOAuthAccount,
    mcpOAuthApplication,
    mcpOAuthConsent,
    mcpOAuthSession,
    mcpOAuthUser,
    mcpOAuthVerification
} from 'database'

const betterAuthBaseUrl = new URL(process.env.NEXT_PUBLIC_BETTER_AUTH_URL as string)
const trustedOrigins = [betterAuthBaseUrl.origin, betterAuthBaseUrl.host, `*.${betterAuthBaseUrl.host}`]
export const auth = betterAuth({
    advanced: {
        useSecureCookies: false, // Try for demo
        crossSubDomainCookies: {
            enabled: true
        }
    },
    basePath: '/mcp-oidc/auth',
    database: drizzleAdapter(db, {
        provider: 'pg', // or "pg" or "mysql"
        schema: {
            user: mcpOAuthUser,
            session: mcpOAuthSession,
            account: mcpOAuthAccount,
            verification: mcpOAuthVerification,
            oauthApplication: mcpOAuthApplication,
            oauthAccessToken: mcpOAuthAccessToken,
            oauthConsent: mcpOAuthConsent
        }
    }),
    plugins: [
        mcp({
            loginPage: '/mcp-oidc/login'
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
    },
    trustedOrigins: trustedOrigins
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
