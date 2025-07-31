import { z } from 'zod'

export const namespaceSlugSchema = z
    .string()
    .min(6)
    .max(64)
    .transform((slug) => slug.toLowerCase())
    .refine((slug) => slug.match(/^[a-z0-9-]+$/), {
        message: 'Slug must contain only lowercase letters, numbers, and hyphens'
    })

export const namespaceNameSchema = z.string().min(3).max(128)
