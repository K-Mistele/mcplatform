import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request): Promise<Response | NextResponse> {
    console.log(`authorize route hit at `, request.url, request.headers.get('host'))

    console.log('headers:', await headers())
    const { searchParams } = new URL(request.url)
    const applicationBaseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL

    console.log(`redirecting to ${applicationBaseUrl}/mcp-oidc/auth/mcp/authorize?${searchParams.toString()}`)
    return NextResponse.redirect(`${applicationBaseUrl}/mcp-oidc/auth/mcp/authorize?${searchParams.toString()}`, {
        status: 302
    })
}
