import { RegisterForm } from '@/components/register-form'
import { Suspense } from 'react'

export default function SignupPage() {
    return (
        <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="w-full max-w-sm">
                <Suspense fallback={<div>Loading...</div>}>
                    <RegisterForm />
                </Suspense>
            </div>
        </div>
    )
}
