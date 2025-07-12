import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { GlobeIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { OrganizationFormData } from './types'

interface OrganizationDomainStepProps {
    form: UseFormReturn<OrganizationFormData>
    onLogoDetected?: (logoUrl: string) => void
}

export function OrganizationDomainStep({ form, onLogoDetected }: OrganizationDomainStepProps) {
    const domain = form.watch('domain')
    const [logoLoaded, setLogoLoaded] = useState(false)

    // Generate logo URL when domain changes
    const logoUrl = domain ? `https://img.logo.dev/${domain}?token=pk_TFdOakUKSHuYLhmUlWaSbQ` : null

    // Reset logo loaded state when domain changes
    useEffect(() => {
        setLogoLoaded(false)
        // Clear any previously auto-detected logo when domain changes
        if (form.getValues('logo') === logoUrl) {
            form.setValue('logo', '')
        }
    }, [domain, logoUrl, form])

    const handleLogoLoad = () => {
        if (logoUrl) {
            setLogoLoaded(true)
            form.setValue('logo', logoUrl)
            onLogoDetected?.(logoUrl)
        }
    }

    const handleLogoError = () => {
        setLogoLoaded(false)
        // Only clear logo if it was the auto-detected one
        if (form.getValues('logo') === logoUrl) {
            form.setValue('logo', '')
        }
    }

    return (
        <div className='space-y-6 animate-in slide-in-from-right-3 duration-300'>
            <div className='text-center'>
                <div className='mx-auto mb-4 size-12 rounded-lg bg-primary/10 flex items-center justify-center'>
                    <GlobeIcon className='size-6 text-primary' />
                </div>
                <h2 className='text-2xl font-semibold tracking-tight'>What's your organization's domain?</h2>
                <p className='text-muted-foreground mt-2'>
                    Enter your company domain to help us provide a better experience.
                </p>
            </div>

            <div className='space-y-4'>
                <FormField
                    control={form.control}
                    name='domain'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Organization Domain (optional)</FormLabel>
                            <FormControl>
                                <Input placeholder='example.com' {...field} />
                            </FormControl>
                            <FormMessage />
                            <p className='text-xs text-muted-foreground'>
                                Enter your organization's domain (e.g., company.com)
                            </p>
                        </FormItem>
                    )}
                />

                {domain && logoUrl && (
                    <div className='flex items-center justify-center mt-4'>
                        <div className='p-4 rounded-lg border bg-muted/50 flex items-center space-x-3'>
                            <img
                                src={logoUrl}
                                alt={`${domain} logo`}
                                className='size-8 rounded'
                                onLoad={handleLogoLoad}
                                onError={handleLogoError}
                                style={{ display: logoLoaded ? 'block' : 'inline' }}
                            />
                            <span className='text-sm text-muted-foreground'>
                                {logoLoaded
                                    ? 'Great! We found your logo automatically'
                                    : "We'll try to find your logo automatically"}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
