'use client'

import { cn } from '@/lib/utils'
import Image from 'next/image'
import { useState } from 'react'

interface UserAvatarProps {
    image?: string | null
    fallbackValue: string
    name?: string | null
    size?: string
    className?: string
}

export function UserAvatar({ image, fallbackValue, name, size = '32px', className }: UserAvatarProps) {
    const [imageError, setImageError] = useState(false)
    const sizeNum = Number.parseInt(size.replace('px', ''))

    // Use identicon if no image, empty image, or image failed to load
    if (!image || imageError) {
        return (
            <div className={cn('overflow-hidden', className)}>
                <Image
                    src={`/api/identicon/${encodeURIComponent(fallbackValue)}`}
                    alt={name || 'User identicon'}
                    width={sizeNum}
                    height={sizeNum}
                    className="object-cover w-full h-full"
                />
            </div>
        )
    }

    return (
        <div className={cn('overflow-hidden', className)}>
            <Image
                src={image}
                alt={name || 'User avatar'}
                width={sizeNum}
                height={sizeNum}
                className="object-cover w-full h-full"
                onError={() => setImageError(true)}
            />
        </div>
    )
}
