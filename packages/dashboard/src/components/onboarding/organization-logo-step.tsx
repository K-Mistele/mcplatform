import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { UploadIcon } from 'lucide-react'
import type { UseFormReturn } from 'react-hook-form'
import type { OrganizationFormData } from './types'

interface OrganizationLogoStepProps {
    form: UseFormReturn<OrganizationFormData>
}

export function OrganizationLogoStep({ form }: OrganizationLogoStepProps) {
    return (
        <div className='space-y-6 animate-in slide-in-from-right-3 duration-300'>
            <div className='text-center'>
                <div className='mx-auto mb-4 size-12 rounded-lg bg-primary/10 flex items-center justify-center'>
                    <UploadIcon className='size-6 text-primary' />
                </div>
                <h2 className='text-2xl font-semibold tracking-tight'>Add your organization logo</h2>
                <p className='text-muted-foreground mt-2'>
                    Provide a URL for your organization logo. You can always change this later.
                </p>
            </div>

            <div className='space-y-4'>
                <FormField
                    control={form.control}
                    name='logo'
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Logo URL (optional)</FormLabel>
                            <FormControl>
                                <Input placeholder='https://example.com/logo.png' {...field} />
                            </FormControl>
                            <FormMessage />
                            <p className='text-xs text-muted-foreground'>
                                Enter a valid URL for your organization logo
                            </p>
                        </FormItem>
                    )}
                />

                {form.watch('logo') && (
                    <div className='flex items-center justify-center'>
                        <div className='size-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden'>
                            <img
                                src={form.watch('logo')}
                                alt='Logo preview'
                                className='size-full object-cover'
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
