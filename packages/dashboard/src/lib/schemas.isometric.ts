import { z } from 'zod'

const supportRequestStatusValues = ['pending', 'in_progress', 'resolved', 'closed'] as const
const supportRequestMethodValues = ['slack', 'linear', 'dashboard'] as const
const mcpServerAuthTypeValues = ['oauth', 'none', 'collect_email'] as const

export const supportRequestStatusSchema = z.enum(supportRequestStatusValues)
export const supportRequestMethodSchema = z.enum(supportRequestMethodValues)
export const mcpServerAuthTypeSchema = z.enum(mcpServerAuthTypeValues)

export const createMcpServerSchema = z.object({
    name: z.string(),
    authType: mcpServerAuthTypeSchema,
    informationMessage: z.string().optional(),
    supportTicketType: supportRequestMethodSchema
})
