import { inngest } from '../client'

// Example function: Hello World
export const helloWorld = inngest.createFunction(
    { id: 'hello-world', name: 'Hello World' },
    { event: 'test/hello.world' },
    async ({ event, step }) => {
        await step.run('log-hello', async () => {
            console.log(`Hello ${event.data.name || 'World'}!`)
            return { message: `Hello ${event.data.name || 'World'}!` }
        })

        return { success: true, message: `Processed hello for ${event.data.name || 'World'}` }
    }
)
