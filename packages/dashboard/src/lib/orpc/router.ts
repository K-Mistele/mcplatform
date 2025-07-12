import { os } from '@orpc/server'
import { z } from 'zod'

export const base = os.errors({
    UNAUTHORIZED: {},
    RESOURCE_NOT_FOUND: {}
})

export const executeExample = os
    .input(
        z.object({
            name: z.string(),
            age: z.number()
        })
    )
    .handler(async ({ input }) => {
        return {
            name: input.name,
            age: input.age,
            message: `hello, ${input.name}!`
        }
    })

export const router = {
    example: {
        execute: executeExample
    }
}
