import { z } from 'zod'

const supportRequestStatusValues = ['pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard'] as const
const mcpServerAuthTypeValues = ['oauth', 'none', 'collect_email'] as const

export const supportRequestStatusSchema = z.enum(supportRequestStatusValues)
export const supportRequestMethodSchema = z.enum(supportRequestMethodValues)
export const mcpServerAuthTypeSchema = z.enum(mcpServerAuthTypeValues)

export const createMcpServerSchema = z.object({
    name: z.string(),
    slug: z
        .string()
        .min(6, 'Slug is required')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    authType: mcpServerAuthTypeSchema,
    informationMessage: z.string().optional(),
    supportTicketType: supportRequestMethodSchema
})

export const validateSubdomainSchema = z.object({
    subdomain: z.string().min(6, 'Subdomain is required')
})
