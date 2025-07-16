'use client'
import { createAuthClient } from 'better-auth/react' // make sure to import from better-auth/react
import { useRef } from 'react'

export const authClient = createAuthClient({
    baseURL: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL!}/mcp-oidc/auth`
})

/**
 * @deprecated use useAuthClient instead
 * @returns
 */
export function useAuthClient() {
    const clientRef = useRef<ReturnType<typeof createAuthClient> | null>(null)

    const getClient = () => {
        if (!clientRef.current) {
            clientRef.current = createAuthClient({
                //baseURL: `${window.location.protocol}//${window.location.host}/mcp-oidc/auth`
                baseURL: `${process.env.NEXT_PUBLIC_BETTER_AUTH_URL!}/mcp-oidc/auth`
            })
        }
        return clientRef.current
    }

    return getClient
}
