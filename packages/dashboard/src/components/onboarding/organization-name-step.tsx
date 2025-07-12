import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth.client'
import { useDebounce } from '@uidotdev/usehooks'
import { Building2Icon, CheckIcon, LoaderCircleIcon, XIcon } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { OrganizationFormData, SlugStatus } from './onboarding-types'

interface OrganizationNameStepProps {
    form: UseFormReturn<OrganizationFormData>
    slugStatus: SlugStatus
    setSlugStatus: (status: SlugStatus) => void
}

export function OrganizationNameStep({ form, slugStatus, setSlugStatus }: OrganizationNameStepProps) {
    // Watch the organization name
    const organizationName = form.watch('name')
    const currentSlug = form.watch('slug')

    // Debounce the organization name
    const debouncedName = useDebounce(organizationName, 500)

    // Generate slug from name
    const generateSlugFromName = (name: string): string => {
        return name
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove punctuation
            .replace(/\s+/g, '-') // Replace spaces with dashes
            .replace(/-+/g, '-') // Replace multiple dashes with single dash
            .replace(/^-|-$/g, '') // Remove leading/trailing dashes
    }

    // Check if slug is available
    const isSlugAvailable = async (slug: string): Promise<boolean> => {
        try {
            const result = await authClient.organization.checkSlug({ slug })
            return !!result.data?.status
        } catch (error) {
            console.error('Error checking slug:', error)
            return false
        }
    }

    // Generate unique slug with fallback
    const generateUniqueSlug = async (baseName: string): Promise<string> => {
        const baseSlug = generateSlugFromName(baseName)

        if (!baseSlug) {
            return nanoid(6).toLowerCase()
        }

        // Check if base slug is available
        if (await isSlugAvailable(baseSlug)) {
            return baseSlug
        }

        // If taken, add nanoid
        return `${baseSlug}-${nanoid(6).toLowerCase()}`
    }

    // Effect to handle slug generation when debounced name changes
    useEffect(() => {
        if (!debouncedName || debouncedName.length < 2) {
            setSlugStatus('idle')
            form.setValue('slug', '')
            return
        }

        const updateSlug = async () => {
            setSlugStatus('checking')
            try {
                const uniqueSlug = await generateUniqueSlug(debouncedName)
                form.setValue('slug', uniqueSlug)
                setSlugStatus('available')
            } catch (error) {
                console.error('Error generating slug:', error)
                setSlugStatus('error')
            }
        }

        updateSlug()
    }, [debouncedName, form, setSlugStatus])

    const renderSlugStatus = () => {
        if (!currentSlug) return null

        switch (slugStatus) {
            case 'checking':
                return (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <LoaderCircleIcon className="size-4 animate-spin" />
                        <span>Checking availability...</span>
                    </div>
                )
            case 'available':
                return (
                    <div className="flex items-center space-x-2 text-sm text-green-600">
                        <CheckIcon className="size-4" />
                        <span>Available: {currentSlug}</span>
                    </div>
                )
            case 'taken':
                return (
                    <div className="flex items-center space-x-2 text-sm text-destructive">
                        <XIcon className="size-4" />
                        <span>Slug is taken</span>
                    </div>
                )
            case 'error':
                return (
                    <div className="flex items-center space-x-2 text-sm text-destructive">
                        <XIcon className="size-4" />
                        <span>Error checking availability</span>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <div className="space-y-6 animate-in slide-in-from-right-3 duration-300">
            <div className="text-center">
                <div className="mx-auto mb-4 size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2Icon className="size-6 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">What's your organization called?</h2>
                <p className="text-muted-foreground mt-2">
                    This will be the name that appears on your dashboard and in team invitations.
                </p>
            </div>

            <div className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Organization Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Acme Inc." className="text-lg py-6" autoFocus {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Slug display - readonly */}
                <div className="space-y-2">
                    <label htmlFor="organization-slug" className="text-sm font-medium">
                        URL Slug
                    </label>
                    <div className="relative">
                        <Input
                            id="organization-slug"
                            value={currentSlug}
                            readOnly
                            disabled
                            className="font-mono bg-muted"
                            placeholder="Will be generated automatically..."
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        This will be automatically generated from your organization name
                    </p>
                    {renderSlugStatus()}
                </div>
            </div>
        </div>
    )
}
