/**
 * this API route is the entrypoint for the remote-transport (SSE or streamable HTTP) MCP server.
 * It uses a catch-all route segment to allow for the following patterns:
 *
 * /api/mcpserver/sse - SSE transport (no tracking ID)
 * /api/mcpserver/mcp - Streamable HTTP transport (no tracking ID)
 * /api/mcpserver/{trackingid}/sse - SSE transport (with tracking ID)
 * /api/mcpserver/{trackingid}/mcp - Streamable HTTP transport (with tracking ID)
 */
import { NextResponse } from 'next/server'

export async function GET(request: Request, context: { params: Promise<{ slug: string[] }> }) {
    const { slug } = await context.params

    // Check to see if the optional route parameter is present.
    const trackingId = maybeGetTrackingId(slug)

    return NextResponse.json({ trackingId, slug })
}

function maybeGetTrackingId(slug: string[]): string | null {
    if (slug.length === 1) return null
    if (slug.length === 2) return slug[0]
    return null
}
