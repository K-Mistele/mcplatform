import { organizationClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react' // make sure to import from better-auth/react

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
    plugins: [organizationClient()]
})
