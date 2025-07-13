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
                    email: 'claude@example.com',
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
                        organizationId: '4sYO1Vv2KTkrXb7NLoBUKyUQYSR6HO1n'
                    })
                    .then(() => router.push('/dashboard'))
            })
    }, [])
    return <div>Logging in...</div>
}
