import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { mcp, organization } from 'better-auth/plugins'
import { 
    db, 
    schema, 
    user, 
    session, 
    account, 
    verification, 
    invitation, 
    member, 
    organization as organizationTable, 
    oauthApplication, 
    oauthAccessToken, 
    oauthConsent 
} from 'database'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: 'pg', // or "pg" or "mysql"
        schema: {
            user,
            session,
            account,
            verification,
            invitation,
            member,
            organization: organizationTable,
            oauthApplication,
            oauthAccessToken,
            oauthConsent
        }
    }),
    plugins: [
        organization(),
        mcp({
            loginPage: '/login'
        })
    ],
    emailAndPassword: {
        enabled: true
    },
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string
        },
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

const sessionHelper = async (
    data: {
        organizationRequired: boolean
    } = {
        organizationRequired: true
    }
) => {
    const session = await auth.api.getSession({
        headers: await headers()
    })
    if (!session || !session.user) {
        redirect('/login')
    }
    if (data.organizationRequired && !session.session.activeOrganizationId) {
        const memberships = await db.select().from(schema.member).where(eq(schema.member.userId, session.user.id))
        if (memberships.length === 0) {
            console.log('user is not a member of any organizations, prompting them to create one!')
            redirect('/organization/new')
        }
        console.log('user is a member of multiple organizations, prompting them to select one!')
        redirect('/organization/select')
    }
    return session
}
export const requireSession = sessionHelper as GetSessionOverloads
