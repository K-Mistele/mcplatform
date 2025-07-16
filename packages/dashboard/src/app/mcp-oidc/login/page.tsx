import appIcon from '@/assets/appicon.png'
import { OidcLoginForm } from '@/components/oidc-login-form'
import Image from 'next/image'

export default function AuthtenantLoginPage() {
    return (
        <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="flex flex-col items-center w-full max-w-sm gap-6">
                <div className="flex items-center justify-center gap-2">
                    <Image src={appIcon} alt="McPlatform" height={40} width={40} />
                    <a href="https://naptha.ai" className="flex items-center gap-2 self-center font-black">
                        McPlatform by Naptha.ai
                    </a>
                </div>

                <OidcLoginForm />
            </div>
        </div>
    )
}
