import { generateIdenticonPngBuffer } from 'common'

const COLOR_PALETTE = ['#34D399', '#F87171', '#60A5FA', '#FBBF24', '#C084FC']

export async function GET(
    request: Request,
    context: {
        params: Promise<{
            identifier: string
        }>
    }
) {
    const { identifier } = await context.params
    const url = new URL(request.url)

    // Parse optional size parameter (default 5)
    const size = Number.parseInt(url.searchParams.get('size') || '5', 10)

    // Parse optional pixel size parameter (default 20)
    const pixelSize = Number.parseInt(url.searchParams.get('pixelSize') || '20', 10)

    // Parse optional padding parameter (default 0.2)
    const padding = Number.parseFloat(url.searchParams.get('padding') || '0.2')

    const pngBuffer = generateIdenticonPngBuffer(identifier, size, pixelSize, padding, COLOR_PALETTE)

    return new Response(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000' // Cache for 1 year since identicons are deterministic
        }
    })
}
