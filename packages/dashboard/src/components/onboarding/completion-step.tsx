'use client'
import { CheckCircleIcon, LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface CompletionStepProps {
    organizationName: string
}

export function CompletionStep({ organizationName }: CompletionStepProps) {
    const router = useRouter()

    useEffect(() => {
        const timeout = setTimeout(() => {
            router.push('/dashboard')
        }, 3000)

        return () => clearTimeout(timeout)
    }, [router])
    return (
        <div className="space-y-6 animate-in fade-in-0 zoom-in-95 duration-500">
            <div className="text-center">
                <div className="mx-auto mb-4 size-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircleIcon className="size-6 text-green-500" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">All set!</h2>
                <p className="text-muted-foreground mt-2">
                    Your organization "{organizationName}" has been created successfully.
                </p>
            </div>

            <div className="flex items-center justify-center">
                <LoaderCircleIcon className="size-6 animate-spin text-primary" />
            </div>

            <p className="text-sm text-muted-foreground text-center">Redirecting to your dashboard...</p>
        </div>
    )
}
