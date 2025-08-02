import { Redis } from 'ioredis'
import { Resource } from 'sst'

const { username, password, host, port } = Resource.Redis
export const redisClient = new Redis({
    host,
    port,
    username,
    password,
    tls: {
        rejectUnauthorized: true
    },
    db: 0
})

export const DOCUMENT_EXPIRATION_SECONDS = 60 * 60 * 24 // 1 day
