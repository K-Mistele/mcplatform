'use client'
import appIcon from '@/assets/appicon.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth/auth.client'
import { cn } from '@/lib/utils'
import { GithubIcon, LoaderCircle } from 'lucide-react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useKey } from 'react-use'
import { toast } from 'sonner'

export function RegisterForm({ className, ...props }: React.ComponentProps<'div'>) {
    const searchParams = useSearchParams()
    const redirectUrl = searchParams.get('redirect') || '/dashboard'
    
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [name, setName] = useState('')
    const [domain, setDomain] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const router = useRouter()
    const credentialRegister = async () => {
        setIsLoading(true)
        const { data, error } = await authClient.signUp.email({
            email, // user email address
            password, // user password -> min 8 characters by default
            name, // user display name
            image: `https://img.logo.dev/${domain}?token=pk_TFdOakUKSHuYLhmUlWaSbQ`, // User image URL (optional)
            callbackURL: redirectUrl // A URL to redirect to after the user verifies their email (optional)
        })
        if (error) {
            toast.error(error.message)
            return
        }
        toast.success('Account created successfully')
        setIsLoading(false)
        // Wait briefly for auth state to settle before redirecting
        setTimeout(() => router.push(redirectUrl), 100)
    }
    const socialLogin = async (provider: 'google' | 'github') => {
        const { data, error } = await authClient.signIn.social({
            provider,
            callbackURL: redirectUrl
        })
        if (error) {
            toast.error(`Unable to sign in with ${provider}`)
            return
        }
    }

    // Handle Enter key press for credential login
    useKey('Enter', () => {
        if (email.trim() && password.trim()) {
            credentialRegister()
        }
    })
    return (
        <div className={cn('flex flex-col gap-6', className)} {...props}>
            <form>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center justify-center gap-2">
                            <Image src={appIcon} alt="McPlatform" height={40} width={40} />
                            <a href="https://naptha.ai" className="flex items-center gap-2 self-center font-black">
                                McPlatform by Naptha.ai
                            </a>
                        </div>
                    </div>
                    <div className="flex flex-col gap-6">
                        <div className="grid gap-3">
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                type="text"
                                placeholder="John Doe"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <div className="grid gap-3">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john.doe@example.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="grid gap-3">
                            <Label htmlFor="password">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="********"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <Button
                            type="button"
                            className="w-full"
                            onClick={credentialRegister}
                            disabled={isLoading || !email.length || !password.length}
                        >
                            {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : 'Register'}
                        </Button>
                    </div>
                    <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                        <span className="bg-background text-muted-foreground relative z-10 px-2">Or</span>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Button
                            variant="outline"
                            type="button"
                            className="w-full"
                            onClick={() => socialLogin('github')}
                        >
                            <GithubIcon />
                            Continue with GitHub
                        </Button>
                        <Button
                            variant="outline"
                            type="button"
                            className="w-full"
                            onClick={() => socialLogin('google')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path
                                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                    fill="currentColor"
                                />
                            </svg>
                            Continue with Google
                        </Button>
                    </div>
                </div>
            </form>
            <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
                By clicking continue, you agree to our <a href="/#">Terms of Service</a> and{' '}
                <a href="/#">Privacy Policy</a>.
            </div>
            <div className="text-center text-sm">
                Already have an account?{' '}
                <a href={`/login${redirectUrl !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`} className="underline underline-offset-4">
                    Sign in
                </a>
            </div>
        </div>
    )
}
