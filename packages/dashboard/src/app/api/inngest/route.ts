import { type NextRequest, NextResponse } from 'next/server'

// export const { GET, POST, PUT } = serve({
//     client: inngest,
//     functions: []
// })
export async function GET(request: NextRequest) {
    console.log('request', request)
    return NextResponse.json({ message: 'Hello, world!' })
}

export async function POST(request: NextRequest) {
    console.log('request', request)
    return NextResponse.json({ message: 'Hello, world!' })
}

export async function PUT(request: NextRequest) {
    console.log('request', request)
    return NextResponse.json({ message: 'Hello, world!' })
}
