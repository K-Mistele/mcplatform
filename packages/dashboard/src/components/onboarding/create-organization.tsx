import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Form } from '@/components/ui/form'
import { Progress } from '@/components/ui/progress'
import { authClient } from '@/lib/auth.client'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeftIcon, ArrowRightIcon, LoaderCircleIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { CompletionStep } from './completion-step'
import { OrganizationDomainStep } from './organization-domain-step'
import { OrganizationLogoStep } from './organization-logo-step'
import { OrganizationNameStep } from './organization-name-step'
import type { OnboardingStep, OrganizationFormData, SlugStatus } from './types'

const logger = createLogger('/onboarding-flow')

interface OnboardingFlowProps {
    session: any // You can type this more strictly based on your auth session type
}

export function OnboardingFlow({ session }: OnboardingFlowProps) {
    const router = useRouter()
    const { track } = useMixpanel()
    const [currentStep, setCurrentStep] = useState<OnboardingStep>('name')
    const [isLoading, setIsLoading] = useState(false)
    const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')

    const form = useForm<OrganizationFormData>({
        resolver: zodResolver(organizationSchema),
        defaultValues: {
            name: '',
            slug: '',
            domain: '',
            logo: '',
            logoAutoDetected: false
        }
    })

    // Track onboarding started when component mounts
    useEffect(() => {
        track('onboarding_started')
    }, [])

    const getStepProgress = () => {
        // Adjust progress calculation based on whether logo step will be shown
        const logoAutoDetected = form.getValues('logoAutoDetected')
        const totalSteps = logoAutoDetected ? 3 : 4 // Skip logo step if auto-detected

        switch (currentStep) {
            case 'name':
                return Math.round((1 / totalSteps) * 100)
            case 'domain':
                return Math.round((2 / totalSteps) * 100)
            case 'logo':
                return Math.round((3 / totalSteps) * 100)
            case 'complete':
                return 100
            default:
                return 0
        }
    }

    const getStepText = () => {
        const logoAutoDetected = form.getValues('logoAutoDetected')
        const totalSteps = logoAutoDetected ? 3 : 4

        switch (currentStep) {
            case 'name':
                return `1 of ${totalSteps}`
            case 'domain':
                return `2 of ${totalSteps}`
            case 'logo':
                return `3 of ${totalSteps}`
            case 'complete':
                return `${totalSteps} of ${totalSteps}`
            default:
                return '1 of 4'
        }
    }

    const handleLogoDetected = (logoUrl: string) => {
        form.setValue('logoAutoDetected', true)
    }

    const handleNext = async () => {
        if (currentStep === 'name') {
            // Validate name step and ensure slug is available
            const nameValid = await form.trigger(['name'])
            if (!nameValid || slugStatus !== 'available') {
                if (slugStatus !== 'available') {
                    toast.error('Please wait for slug validation to complete')
                }
                return
            }

            // Track name step completion
            const values = form.getValues()
            track('onboarding_name_completed', {
                organization_name: values.name,
                organization_slug: values.slug,
                slug_was_available: slugStatus === 'available'
            })

            setCurrentStep('domain')
        } else if (currentStep === 'domain') {
            // Validate domain step
            const domainValid = await form.trigger(['domain'])
            if (!domainValid) {
                return
            }

            // Track domain step completion
            const values = form.getValues()
            track('onboarding_domain_completed', {
                domain_provided: !!values.domain,
                domain: values.domain || null,
                logo_auto_detected: values.logoAutoDetected
            })

            // Check if logo was auto-detected
            const logoAutoDetected = form.getValues('logoAutoDetected')
            if (logoAutoDetected) {
                // Skip logo step and go directly to submission
                await handleSubmit()
            } else {
                setCurrentStep('logo')
            }
        } else if (currentStep === 'logo') {
            // Track logo step completion
            const values = form.getValues()
            track('onboarding_logo_completed', {
                logo_provided: !!values.logo,
                logo_source: values.logoAutoDetected ? 'auto' : 'manual'
            })

            await handleSubmit()
        }
    }

    const handleBack = () => {
        if (currentStep === 'domain') {
            setCurrentStep('name')
        } else if (currentStep === 'logo') {
            setCurrentStep('domain')
        }
    }

    const handleSkipDomain = async () => {
        // Clear the domain field when skipping
        form.setValue('domain', '')

        // Track domain step completion (skipped)
        track('onboarding_domain_completed', {
            domain_provided: false,
            domain: null,
            logo_auto_detected: false,
            skipped: true
        })

        // Check if logo was auto-detected
        const logoAutoDetected = form.getValues('logoAutoDetected')
        if (logoAutoDetected) {
            // Skip logo step and go directly to submission
            await handleSubmit()
        } else {
            setCurrentStep('logo')
        }
    }

    const handleSubmit = async () => {
        const values = form.getValues()

        try {
            setIsLoading(true)
            setCurrentStep('complete')

            const result = await authClient.organization.create({
                name: values.name,
                slug: values.slug,
                logo: values.logo || undefined,
                metadata: values.domain ? { domain: values.domain } : undefined
            })

            if (result.error) {
                toast.error('Failed to create organization', {
                    description: result.error.message || 'Please try again with a different name or slug.'
                })
                // Go back to the appropriate step based on whether logo was auto-detected
                const logoAutoDetected = values.logoAutoDetected
                setCurrentStep(logoAutoDetected ? 'domain' : 'logo')
                return
            }

            // Track successful organization creation
            track('onboarding_completed', {
                organization_id: result.data?.id,
                organization_name: values.name,
                organization_slug: values.slug,
                has_domain: !!values.domain,
                has_logo: !!values.logo,
                logo_source: values.logoAutoDetected ? 'auto' : values.logo ? 'manual' : 'none'
            })
        } catch (error) {
            toast.error('Failed to create organization', {
                description: 'An unexpected error occurred. Please try again.'
            })
            console.error('Organization creation error:', error)
            // Go back to the appropriate step based on whether logo was auto-detected
            const logoAutoDetected = form.getValues('logoAutoDetected')
            setCurrentStep(logoAutoDetected ? 'domain' : 'logo')
        } finally {
            setIsLoading(false)
        }
    }

    const renderStepContent = () => {
        switch (currentStep) {
            case 'name':
                return <OrganizationNameStep form={form} slugStatus={slugStatus} setSlugStatus={setSlugStatus} />
            case 'domain':
                return <OrganizationDomainStep form={form} onLogoDetected={handleLogoDetected} />
            case 'logo':
                return <OrganizationLogoStep form={form} />
            case 'complete':
                return <CompletionStep organizationName={form.getValues('name')} />
            default:
                return null
        }
    }

    const renderActionButtons = () => {
        if (currentStep === 'complete') {
            return null
        }

        const logoAutoDetected = form.getValues('logoAutoDetected')
        const isLastStep = currentStep === 'logo' || (currentStep === 'domain' && logoAutoDetected)

        return (
            <div className="flex justify-between space-x-4 pt-6">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 'name' || isLoading}
                    className={currentStep === 'name' ? 'invisible' : ''}
                >
                    <ArrowLeftIcon className="size-4 mr-2" />
                    Back
                </Button>

                <div className="flex space-x-2">
                    {currentStep === 'domain' && (
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleSkipDomain}
                            disabled={isLoading}
                            className="text-muted-foreground"
                        >
                            Skip for now
                        </Button>
                    )}
                    <Button type="button" onClick={handleNext} disabled={isLoading} className="min-w-[120px]">
                        {isLoading ? (
                            <>
                                <LoaderCircleIcon className="size-4 animate-spin mr-2" />
                                Creating...
                            </>
                        ) : isLastStep ? (
                            'Create Organization'
                        ) : (
                            <>
                                Next
                                <ArrowRightIcon className="size-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="pb-2">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Step {getStepText()}</span>
                            <span>{getStepProgress()}%</span>
                        </div>
                        <Progress value={getStepProgress()} className="h-2" />
                    </div>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <div className="min-h-[400px]">{renderStepContent()}</div>
                        {renderActionButtons()}
                    </Form>
                </CardContent>
            </Card>
        </div>
    )
}
