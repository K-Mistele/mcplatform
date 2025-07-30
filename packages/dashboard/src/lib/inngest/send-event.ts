import { inngest } from './client'

// Helper function to send events to Inngest
export async function sendEvent(eventName: string, data: any) {
    try {
        const result = await inngest.send({
            name: eventName,
            data,
        })
        console.log(`Event "${eventName}" sent successfully:`, result)
        return result
    } catch (error) {
        console.error(`Error sending event "${eventName}":`, error)
        throw error
    }
}

// Typed event sender functions
export const inngestEvents = {
    // Test event
    sendHelloWorld: (name?: string) => 
        sendEvent('test/hello.world', { name }),

    // User signup event
    sendUserSignup: (userId: string, email: string, organizationId: string) => 
        sendEvent('user/signup', { userId, email, organizationId }),

    // MCP webhook event
    sendMcpWebhook: (serverId: string, webhookType: string, payload: any) => 
        sendEvent('mcp/webhook.received', { serverId, webhookType, payload }),
}