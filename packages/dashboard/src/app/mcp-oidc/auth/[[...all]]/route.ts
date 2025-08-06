import { auth } from '@/lib/auth/mcp/auth'
import { cloneResponse } from '@/lib/utils'
import { toNextJsHandler } from 'better-auth/next-js'
import { NextResponse } from 'next/server'

const betterAuthHandler = toNextJsHandler(auth.handler)

const patchedBetterAuthHandler = async (req: Request) => {
    const url = new URL(req.url)

    const shouldPatchResponse = url.pathname.startsWith('/mcp-oidc/auth/callback')
    console.log('shouldPatchResponse', shouldPatchResponse)

    let response: Response
    if (req.method === 'GET') response = await betterAuthHandler.GET(req)
    else if (req.method === 'POST') response = await betterAuthHandler.POST(req)
    else response = new Response('Method Not Allowed', { status: 405 })

    // This is super annoying but is due to a bug in better-auth that we have to patch
    if (shouldPatchResponse && response.body) {
        const { response: clonedResponse, text } = cloneResponse(response)
        const responseText = await text
        try {
            const json = JSON.parse(responseText)
            if ('url' in json && 'redirect' in json) {
                // NOTE we should return the redirect to the URL
                console.log('should redirect to ', json.url)
                return NextResponse.redirect(json.url)
            }
        } catch (e) {
            console.error('error parsing response text', e)
        }
        return clonedResponse
    }

    return response
}

export const GET = patchedBetterAuthHandler
export const POST = patchedBetterAuthHandler
