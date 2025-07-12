'use server'

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
