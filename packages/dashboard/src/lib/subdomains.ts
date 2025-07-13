import { redis } from '@/lib/redis'
type SubdomainData = {
    createdAt: number
}

export async function getSubdomainData(subdomain: string) {
    const sanitizedSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '')
    const data = (await redis.get(`subdomain:${sanitizedSubdomain}`)) as SubdomainData | null
    return data
}

export async function getAllSubdomains() {
    const keys = await redis.keys('subdomain:*')

    if (!keys.length) {
        return []
    }

    const values = await redis.mget(...keys)

    return keys.map((key, index) => {
        const subdomain = key.replace('subdomain:', '')
        const data = values[index] as SubdomainData | null

        return {
            subdomain,
            createdAt: data?.createdAt || Date.now()
        }
    })
}
