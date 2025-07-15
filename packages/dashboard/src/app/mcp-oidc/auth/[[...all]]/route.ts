import { auth } from '@/lib/auth/mcp/auth'
import { toNextJsHandler } from 'better-auth/next-js'

export const { GET, POST } = toNextJsHandler(auth.handler)
