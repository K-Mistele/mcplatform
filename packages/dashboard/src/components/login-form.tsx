'use client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authClient } from '@/lib/auth/auth.client'
import { cn } from '@/lib/utils'
import { GithubIcon, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { useKey } from 'react-use'
import { toast } from 'sonner'

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
    const {
        data: session,
        isPending, //loading state
        error, //error object
        refetch //refetch the session
    } = authClient.useSession()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const [isLoading, setIsLoading] = useState(false)

    // // automatically login if user is already logged in
    // useEffect(() => {
    //     if (router && session && !isPending && !error && session.user && session.user.id) {
    //         router.push('/dashboard')
    //     }
    // }, [session, isPending, error, router])

    const credentialLogin = async () => {
        if (!username.length || !password.length) {
            toast.error('Please enter a username and password')
            return
        }
        setIsLoading(true)
        const { data, error } = await authClient.signIn.email({
            email: username,
            password: password,
            callbackURL: '/dashboard'
        })
        if (error) {
            toast.error('Invalid username or password')
            setIsLoading(false)
            return
        }
        setIsLoading(false)
    }

    // Handle Enter key press for credential login
    useKey('Enter', () => {
        if (username.trim() && password.trim()) {
            credentialLogin()
        }
    })

    const socialLogin = async (provider: 'google' | 'github') => {
        const { data, error } = await authClient.signIn.social({
            provider,
            callbackURL: '/dashboard'
        })
        if (error) {
            toast.error(`Unable to sign in with ${provider}`)
            return
        }
    }

    return (
        <div className={cn('flex flex-col gap-6', className)} {...props}>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>Login with your Apple or Google account</CardDescription>
                </CardHeader>
                <CardContent>
                    <form>
                        <div className="grid gap-6">
                            <div className="flex flex-col gap-4">
                                <Button
                                    variant="outline"
                                    className="w-full cursor-pointer"
                                    onClick={() => socialLogin('github')}
                                    type="button"
                                >
                                    <GithubIcon />
                                    Login with GitHub
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full cursor-pointer"
                                    onClick={() => socialLogin('google')}
                                    type="button"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                        <path
                                            d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                                            fill="currentColor"
                                        />
                                    </svg>
                                    Login with Google
                                </Button>
                            </div>
                            <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                                <span className="bg-card text-muted-foreground relative z-10 px-2">
                                    Or continue with
                                </span>
                            </div>
                            <div className="grid gap-6">
                                <div className="grid gap-3">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="m@example.com"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <div className="flex items-center">
                                        <Label htmlFor="password">Password</Label>
                                        <a
                                            href="/forgot-password"
                                            className="ml-auto text-sm underline-offset-4 hover:underline"
                                        >
                                            Forgot your password?
                                        </a>
                                    </div>
                                    <Input
                                        id="password"
                                        type="password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                <Button type="button" className="w-full" onClick={credentialLogin}>
                                    {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : 'Login'}
                                </Button>
                            </div>
                            <div className="text-center text-sm">
                                Don&apos;t have an account?{' '}
                                <a href="/signup" className="underline underline-offset-4">
                                    Sign up
                                </a>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
            <div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
                By clicking continue, you agree to our <a href="/terms">Terms of Service</a> and{' '}
                <a href="/privacy">Privacy Policy</a>.
            </div>
        </div>
    )
}
