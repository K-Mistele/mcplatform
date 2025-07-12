'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authClient } from '@/lib/auth.client'
import type { Member, Organization } from 'database'
import { BuildingIcon, LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

interface SelectOrganizationProps {
    organizations: Array<{
        organization: Organization | null
        member: Member
    }>
}

export function SelectOrganization({ organizations }: SelectOrganizationProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

    const handleSelectOrganization = async (organizationId: string, organizationName: string) => {
        setIsLoading(true)
        setSelectedOrgId(organizationId)

        try {
            await authClient.organization.setActive({
                organizationId
            })

            toast.success('Organization selected!', {
                description: `Welcome to ${organizationName}`
            })

            router.push('/dashboard')
        } catch (error) {
            toast.error('Failed to select organization', {
                description: 'Please try again.'
            })
            console.error('Organization selection error:', error)
        } finally {
            setIsLoading(false)
            setSelectedOrgId(null)
        }
    }

    return (
        <Card className="w-full max-w-md">
            <CardHeader>
                <CardTitle className="text-2xl">Select Organization</CardTitle>
                <CardDescription>Choose which organization you'd like to work with</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {organizations.map(({ organization, member }) => {
                        if (!organization) return null

                        const isCurrentlyLoading = isLoading && selectedOrgId === organization.id

                        return (
                            <Button
                                key={organization.id}
                                variant="outline"
                                className="w-full h-auto p-4 justify-start"
                                onClick={() => handleSelectOrganization(organization.id, organization.name)}
                                disabled={isLoading}
                            >
                                <div className="flex items-center space-x-3 w-full">
                                    <div className="flex-shrink-0">
                                        {organization.logo ? (
                                            <img
                                                src={organization.logo}
                                                alt={`${organization.name} logo`}
                                                className="size-8 rounded"
                                            />
                                        ) : (
                                            <div className="size-8 rounded bg-muted flex items-center justify-center">
                                                <BuildingIcon className="size-4 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow text-left">
                                        <div className="font-medium">{organization.name}</div>
                                        <div className="text-sm text-muted-foreground capitalize">{member.role}</div>
                                    </div>
                                    {isCurrentlyLoading && (
                                        <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
                                    )}
                                </div>
                            </Button>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
