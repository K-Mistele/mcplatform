'use server'

import { mcpServerAuthTypeSchema, supportRequestMethodSchema } from 'database'
import { redirect } from 'next/navigation'
import z from 'zod'
import { requireSession } from './auth'
import { base } from './router'

export const redirectExample = base
    .handler(async ({ input, errors }) => {
        throw errors.UNAUTHORIZED({
            message: 'Unauthorized'
        })
    })
    .actionable({
        context: async () => ({}) // Optional: provide initial context if needed
    })

export const createMcpServer = base
    .input(
        z.object({
            name: z.string(),
            authType: mcpServerAuthTypeSchema,
            informationMessage: z.string().optional(),
            supportTicketType: supportRequestMethodSchema
        })
    )
    .handler(async ({ input, errors, context }) => {
        redirect('/does-not-exist')
    })
    .actionable({
        context: async () => ({
            session: await requireSession()
        })
    })
