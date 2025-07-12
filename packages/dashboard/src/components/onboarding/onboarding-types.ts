import * as z from 'zod'

export const organizationSchema = z.object({
    name: z.string().min(2, {
        message: 'Organization name must be at least 2 characters.'
    }),
    slug: z
        .string()
        .min(2, {
            message: 'Organization slug must be at least 2 characters.'
        })
        .regex(/^[a-z0-9-]+$/, {
            message: 'Slug must contain only lowercase letters, numbers, and hyphens.'
        }),
    domain: z
        .string()
        .optional()
        .refine((val) => !val || val.length >= 3, {
            message: 'Domain must be at least 3 characters.'
        })
        .refine((val) => !val || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val), {
            message: 'Please enter a valid domain (e.g., example.com)'
        }),
    logo: z.string().url({ message: 'Invalid logo URL' }).optional(),
    logoAutoDetected: z.boolean().optional()
})

export type OrganizationFormData = z.infer<typeof organizationSchema>
export type OnboardingStep = 'name' | 'domain' | 'logo' | 'complete'
export type SlugStatus = 'checking' | 'available' | 'taken' | 'error' | 'idle'
