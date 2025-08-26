import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { db, schema } from 'database'
import { and, eq, gt } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth'
import { acceptInvitationAction } from '@/lib/orpc/actions/organization'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { IconCheck, IconAlertTriangle, IconUsersGroup } from '@tabler/icons-react'
import Link from 'next/link'

interface AcceptInvitationPageProps {
    params: {
        invitationId: string
    }
}

export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
    const { invitationId } = await params

    // Get the invitation and verify it's valid
    const [invitation] = await db
        .select({
            id: schema.invitation.id,
            email: schema.invitation.email,
            role: schema.invitation.role,
            status: schema.invitation.status,
            expiresAt: schema.invitation.expiresAt,
            organizationId: schema.invitation.organizationId,
            organizationName: schema.organization.name,
            inviterName: schema.user.name,
            inviterEmail: schema.user.email
        })
        .from(schema.invitation)
        .innerJoin(schema.organization, eq(schema.invitation.organizationId, schema.organization.id))
        .innerJoin(schema.user, eq(schema.invitation.inviterId, schema.user.id))
        .where(eq(schema.invitation.id, invitationId))

    if (!invitation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <IconAlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <CardTitle>Invitation Not Found</CardTitle>
                        <CardDescription>
                            This invitation link is invalid or has been removed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <Link href="/login">
                            <Button>Go to Login</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Check if invitation is expired
    const now = new Date()
    const expiryDate = new Date(invitation.expiresAt)
    const isExpired = now > expiryDate

    // Check if invitation is already used
    const isUsed = invitation.status !== 'pending'

    if (isExpired || isUsed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                            <IconAlertTriangle className="h-6 w-6 text-orange-600" />
                        </div>
                        <CardTitle>
                            {isExpired ? 'Invitation Expired' : 'Invitation Already Used'}
                        </CardTitle>
                        <CardDescription>
                            {isExpired 
                                ? 'This invitation has expired. Please ask for a new invitation.'
                                : 'This invitation has already been accepted.'
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Contact {invitation.inviterName} ({invitation.inviterEmail}) for assistance.
                        </p>
                        <Link href="/login">
                            <Button>Go to Login</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Check if user is already logged in (without requiring organization membership)
    const session = await auth.api.getSession({
        headers: await headers()
    })

    // If not logged in, show login prompt
    if (!session?.session) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                            <IconUsersGroup className="h-6 w-6 text-blue-600" />
                        </div>
                        <CardTitle>Join {invitation.organizationName}</CardTitle>
                        <CardDescription>
                            {invitation.inviterName} has invited you to join their organization as a{' '}
                            <strong>{invitation.role}</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="text-sm text-muted-foreground space-y-2">
                            <p><strong>Organization:</strong> {invitation.organizationName}</p>
                            <p><strong>Role:</strong> {invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1)}</p>
                            <p><strong>Invited by:</strong> {invitation.inviterName}</p>
                            <p><strong>Email:</strong> {invitation.email}</p>
                            <p><strong>Expires:</strong> {expiryDate.toLocaleDateString()}</p>
                        </div>
                        
                        <div className="text-center space-y-3">
                            <p className="text-sm text-muted-foreground">
                                Please log in or create an account to accept this invitation.
                            </p>
                            <div className="flex gap-2">
                                <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`} className="flex-1">
                                    <Button className="w-full">Log In</Button>
                                </Link>
                                <Link href={`/signup?redirect=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`} className="flex-1">
                                    <Button variant="outline" className="w-full">Sign Up</Button>
                                </Link>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // User is logged in, check if the invitation email matches their account
    if (session.user.email !== invitation.email) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                            <IconAlertTriangle className="h-6 w-6 text-orange-600" />
                        </div>
                        <CardTitle>Email Mismatch</CardTitle>
                        <CardDescription>
                            This invitation was sent to {invitation.email}, but you're logged in as {session.user.email}.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Please log out and sign in with the correct email address.
                        </p>
                        <div className="flex gap-2">
                            <Link href={`/login?redirect=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`} className="flex-1">
                                <Button variant="outline" className="w-full">Switch Account</Button>
                            </Link>
                            <Link href="/dashboard" className="flex-1">
                                <Button className="w-full">Go to Dashboard</Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Accept the invitation automatically
    try {
        await acceptInvitationAction({
            invitationId
        })

        // Success! Redirect to dashboard
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                            <IconCheck className="h-6 w-6 text-green-600" />
                        </div>
                        <CardTitle>Welcome to {invitation.organizationName}!</CardTitle>
                        <CardDescription>
                            You have successfully joined the organization as a{' '}
                            <strong>{invitation.role}</strong>.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            You now have access to all organization resources and can start collaborating with your team.
                        </p>
                        <Link href="/dashboard">
                            <Button className="w-full">Go to Dashboard</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    } catch (error) {
        // Handle errors
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/50">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                            <IconAlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <CardTitle>Error Accepting Invitation</CardTitle>
                        <CardDescription>
                            Something went wrong while accepting the invitation.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            Please try again or contact {invitation.inviterName} for assistance.
                        </p>
                        <Link href="/dashboard">
                            <Button>Go to Dashboard</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }
}