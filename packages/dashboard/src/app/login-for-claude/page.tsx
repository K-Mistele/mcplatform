'use client'

import { authClient } from '@/lib/auth/auth.client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'

export default function LoginForClaudePage() {
    const router = useRouter()
    useEffect(() => {
        authClient.signIn
            .email(
                {
                    email: 'claude@claude.com',
                    password: 'supersecurepassword'
                },
                {
                    onSuccess: () => {},
                    onError: (error: any) => {
                        toast.error('Authentication failed', {
                            description: error.message || 'Please try again or use a different authentication method.'
                        })
                    }
                }
            )
            .then(() => {
                authClient.organization
                    .setActive({
                        organizationId: '6A0FiFkRLHlTC665fUjFBhePGXk2raqC'
                    })
                    .then(() => router.push('/dashboard'))
            })
    }, [])
    return <div>Logging in...</div>
}
