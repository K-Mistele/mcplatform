import { OnboardingFlow } from '@/components/onboarding/create-organization'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function NewOrganizationPage() {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if (!session) {
        redirect('/login')
    }
    return <OnboardingFlow session={session} />
}
