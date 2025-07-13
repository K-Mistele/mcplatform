import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const headers = request.headers
    console.log(headers)
    console.log(headers.get('host'))
    return NextResponse.json({ host: headers.get('host') })
}
