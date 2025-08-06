import { type NextRequest, NextResponse } from 'next/server'

// Define your parent domain. Any subdomain of this will be allowed.
const PARENT_DOMAIN = 'naptha.gg'

// Store common CORS headers in a constant
const CORS_HEADERS = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
}

export function middleware(request: NextRequest) {
    // Get the origin of the request
    const origin = request.headers.get('origin')

    // If there's no origin, we don't need to add CORS headers
    if (!origin) {
        return NextResponse.next()
    }

    // Safely parse the origin's hostname
    const originHostname = new URL(origin).hostname

    // Check if the origin is a valid subdomain of your parent domain
    const isAllowedOrigin =
        originHostname === PARENT_DOMAIN ||
        originHostname.endsWith(`.${PARENT_DOMAIN}`) ||
        originHostname.endsWith('localhost')

    // Handle Preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
        if (isAllowedOrigin) {
            // Respond to preflight with allowed origin and methods
            const headers = { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin }
            return new NextResponse(null, { status: 204, headers })
        }
        // If not an allowed origin, let the browser handle the error
        return new NextResponse(null, { status: 204 })
    }

    // Handle actual requests
    const response = NextResponse.next()

    // If the origin is allowed, add the necessary CORS headers to the response
    if (isAllowedOrigin) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        Object.entries(CORS_HEADERS).forEach(([key, value]) => {
            response.headers.set(key, value)
        })
    }

    return response
}

export const config = {
    matcher: ['/api/:path*', '/mcp-oidc/:path*']
}
