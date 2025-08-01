/**
 * this API route is the entrypoint for the remote-transport (SSE or streamable HTTP) MCP server.
 * It uses a catch-all route segment to allow for the following patterns:
 *
 * /api/mcpserver/sse - SSE transport (no tracking ID)
 * /api/mcpserver/mcp - Streamable HTTP transport (no tracking ID)
 * /api/mcpserver/{trackingid}/sse - SSE transport (with tracking ID)
 * /api/mcpserver/{trackingid}/mcp - Streamable HTTP transport (with tracking ID)
 */
import { createHandlerForServer, getMcpServerConfiguration } from '@/lib/mcp'
import { getAndTrackMcpServerUser } from '@/lib/mcp/tracking'
import type { McpServerConfig } from '@/lib/mcp/types'
import { cloneResponse, safelyReadRequest } from '@/lib/utils'
import { NextResponse } from 'next/server'

/**
 * The route handler itself
 * @param request
 * @param context
 * @returns
 */
async function streamableHttpServerHandler(request: Request, context: { params: Promise<{ slug: string[] }> }) {
    const { slug } = await context.params

    // Check to see if the optional route parameter is present; which is the tracking ID.
    const trackingId = maybeGetTrackingId(slug)
    let req: Request
    if (request.body) {
        const { request: newRequest, text: requestBody } = safelyReadRequest(request)
        req = newRequest
        requestBody.then((text) => console.log(`JSON RPC REQUEST:`, text))
    } else {
        req = request
    }

    // Load the MCP server configuration matching the slug in the request Host
    let mcpServer: McpServerConfig
    try {
        mcpServer = await getMcpServerConfiguration(request)
        if (!mcpServer) return NextResponse.json({ error: 'MCP server not found' }, { status: 404 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Idempotently track the user based on tracking ID and/or email
    const userData = await getAndTrackMcpServerUser({
        trackingId,
        serverConfig: mcpServer
    })

    // Create the MCP server handler
    const requestHandler = createHandlerForServer({
        serverConfig: mcpServer,
        trackingId,
        email: userData?.email ?? null,
        mcpServerUserId: userData.mcpServerUserId,
        serverSessionId: userData.serverSessionId
    })

    // await the handler with the request.
    const response = await requestHandler(req)
    const { response: newResponse, text: responseText } = cloneResponse(response)
    responseText.then((text) => console.log(`JSON RPC RESPONSE:`, text))

    // If the user data is present, set the session ID in the response headers.
    newResponse.headers.set('Mcp-Session-Id', userData.serverSessionId)
    return newResponse
}

/**
 * This helper function checks to see if the optional route parameter for the tracking IDs is present.
 * @param slug - the catch-all route segment
 * @returns the tracking ID if present, otherwise null
 */
function maybeGetTrackingId(slug: string[]): string | null {
    if (slug.length === 1) return null
    if (slug.length === 2) return slug[0]
    return null
}

export {
    streamableHttpServerHandler as DELETE,
    streamableHttpServerHandler as GET,
    streamableHttpServerHandler as PATCH,
    streamableHttpServerHandler as POST,
    streamableHttpServerHandler as PUT
}
