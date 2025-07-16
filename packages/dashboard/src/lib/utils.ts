import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
export const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'

function readStreamSafely(stream: ReadableStream): { text: Promise<string>; stream: ReadableStream } {
    const [stream1, stream2] = stream.tee()

    const textPromise = new Promise<string>((resolve, reject) => {
        const chunks: string[] = []
        const decoder = new TextDecoder()
        const reader = stream1.getReader()

        const read = async () => {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                chunks.push(decoder.decode(value))
            }
        }

        read().then(() => resolve(chunks.join('')))
    })
    return { text: textPromise, stream: stream2 }
}

export function cloneResponse(response: Response): { response: Response; text: Promise<string> } {
    const { stream, text } = readStreamSafely(response.body!)
    return {
        response: new Response(stream, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
        }),
        text
    }
}

export function safelyReadRequest(request: Request): { request: Request; text: Promise<string> } {
    const { stream, text } = readStreamSafely(request.body!)
    return {
        request: new Request(request.url, {
            method: request.method,
            headers: request.headers,
            body: stream,
            // @ts-ignore this is necessary:
            duplex: 'half'
        }),
        text
    }
}
