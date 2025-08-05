'use client'

export default function GithubIdenticon({ value = 'test', size = '100%' }: { value?: string; size?: string }) {
    // Convert size to number if it's a pixel value, otherwise use 40 as default
    const sizeValue = typeof size === 'string' && size.endsWith('px') ? Number.parseInt(size.replace('px', '')) : 40

    return (
        <img
            src={`/api/identicon/${encodeURIComponent(value)}`}
            alt={`Identicon for ${value}`}
            width={sizeValue}
            height={sizeValue}
            className="rounded-md"
        />
    )
}
