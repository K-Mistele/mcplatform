import { router } from '@/lib/orpc/router'
import { RPCHandler } from '@orpc/server/fetch'

const handler = new RPCHandler(router)

async function handleRequest(request: Request) {
    const { response } = await handler.handle(request, {
        prefix: '/rpc',
        context: {} // Provide initial context if needed
    })

    return response ?? new Response('Not found', { status: 404 })
}

export const HEAD = handleRequest
export const GET = handleRequest
export const POST = handleRequest
export const PUT = handleRequest
export const PATCH = handleRequest
export const DELETE = handleRequest
