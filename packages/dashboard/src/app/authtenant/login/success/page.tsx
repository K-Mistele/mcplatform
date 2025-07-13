import appIcon from '@/assets/appicon.png'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircleIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

export default function LoginSuccessPage() {
    return (
        <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
            <div className="flex flex-col items-center w-full gap-6">
                <div className="flex items-center justify-center gap-2">
                    <Image src={appIcon} alt="McPlatform" height={40} width={40} />
                    <a href="https://naptha.ai" className="flex items-center gap-2 self-center font-black">
                        McPlatform by Naptha.ai
                    </a>
                </div>

                <Card className="w-full max-w-sm">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <CheckCircleIcon className="h-16 w-16 text-green-500" />
                        </div>
                        <CardTitle className="text-xl">Login Successful!</CardTitle>
                        <CardDescription>
                            You have successfully logged in. Please return to your MCP client
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-4">
                            <Button variant="outline" asChild className="w-full">
                                <Link href="/authtenant/login">Back to Login</Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="text-muted-foreground text-center text-xs text-balance">
                    It is safe to close this page.
                </div>
            </div>
        </div>
    )
}
