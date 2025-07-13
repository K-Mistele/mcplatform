'use client'

import { UsersTable } from '@/components/users-table'
import { use } from 'react'

interface McpUserConnection {
    distinctId: string | null
    email: string | null
    firstSeenAt: number | null
    connectionCreatedAt: number | null
    serverName: string | null
    serverSlug: string | null
    transport: string | null
}

interface SupportTicketCount {
    email: string | null
    lifetimeCount: number
}

interface OpenTicketCount {
    email: string | null
    openCount: number
}

interface UsersClientProps {
    mcpUsersPromise: Promise<McpUserConnection[]>
    supportTicketCountsPromise: Promise<SupportTicketCount[]>
    openTicketCountsPromise: Promise<OpenTicketCount[]>
}

export function UsersClient({
    mcpUsersPromise,
    supportTicketCountsPromise,
    openTicketCountsPromise
}: UsersClientProps) {
    // Use the 'use' hook to unwrap promises - this will suspend until resolved
    const mcpUsersWithConnections = use(mcpUsersPromise)
    const supportTicketCounts = use(supportTicketCountsPromise)
    const openTicketCounts = use(openTicketCountsPromise)

    // Create maps for quick lookup
    const supportTicketMap = new Map<string, { lifetime: number; open: number }>()

    // Add lifetime counts
    for (const row of supportTicketCounts) {
        if (row.email) {
            supportTicketMap.set(row.email, {
                lifetime: row.lifetimeCount,
                open: 0
            })
        }
    }

    // Add open counts
    for (const row of openTicketCounts) {
        if (row.email) {
            const existing = supportTicketMap.get(row.email)
            if (existing) {
                existing.open = row.openCount
            } else {
                supportTicketMap.set(row.email, {
                    lifetime: row.openCount, // If we only have open tickets, use that as lifetime too
                    open: row.openCount
                })
            }
        }
    }

    // Group by user to combine their server connections
    const userMap = new Map<string, any>()

    for (const row of mcpUsersWithConnections) {
        const userId = row.distinctId

        // Skip rows where distinctId is null
        if (!userId) {
            continue
        }

        if (!userMap.has(userId)) {
            const supportTickets = supportTicketMap.get(row.email || '') || { lifetime: 0, open: 0 }

            userMap.set(userId, {
                id: userId,
                distinctId: userId,
                name: row.email?.split('@')[0] || 'Unknown User', // Use email prefix as name
                email: row.email,
                image: null,
                createdAt: new Date(row.firstSeenAt || Date.now()),
                lifetimeSupportTickets: supportTickets.lifetime,
                openSupportTickets: supportTickets.open,
                connectedServers: []
            })
        }

        // Add server connection if it exists and is not already added
        if (row.serverSlug) {
            const user = userMap.get(userId)
            const existingServer = user.connectedServers.find((server: any) => server.serverSlug === row.serverSlug)

            if (!existingServer) {
                user.connectedServers.push({
                    distinctId: userId,
                    serverName: row.serverName || 'Unknown Server',
                    serverSlug: row.serverSlug,
                    firstSeenAt: row.connectionCreatedAt,
                    transport: row.transport
                })
            }
        }
    }

    const usersWithServers = Array.from(userMap.values())

    return <UsersTable data={usersWithServers} />
}
