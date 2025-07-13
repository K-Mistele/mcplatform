import { requireSession } from '@/lib/auth/auth'
import { os } from '@orpc/server'
import { db, schema } from 'database'
import { and, eq, gte } from 'drizzle-orm'
import { z } from 'zod'

export const base = os.errors({
    UNAUTHORIZED: {},
    RESOURCE_NOT_FOUND: {},
    INVALID_SUBDOMAIN: {},
    SUBDOMAIN_ALREADY_EXISTS: {}
})

export const executeExample = os
    .input(
        z.object({
            name: z.string(),
            age: z.number()
        })
    )
    .handler(async ({ input }) => {
        return {
            name: input.name,
            age: input.age,
            message: `hello, ${input.name}!`
        }
    })

export const getToolCallsChart = base
    .input(
        z.object({
            timeRange: z.enum(['1h', '1d', '1w', '1m'])
        })
    )
    .handler(async ({ input }) => {
        try {
            const session = await requireSession()

            const now = new Date()
            let startTime: Date

            // Calculate start time based on range
            switch (input.timeRange) {
                case '1h':
                    startTime = new Date(now.getTime() - 60 * 60 * 1000)
                    break
                case '1d':
                    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                    break
                case '1w':
                    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    break
                case '1m':
                    startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                    break
            }

            const startTimeMs = startTime.getTime()

            // Query tool calls
            const toolCallsResult = await db
                .select({
                    id: schema.toolCalls.id,
                    toolName: schema.toolCalls.toolName,
                    createdAt: schema.toolCalls.createdAt
                })
                .from(schema.toolCalls)
                .leftJoin(schema.mcpServers, eq(schema.toolCalls.mcpServerId, schema.mcpServers.id))
                .where(
                    and(
                        eq(schema.mcpServers.organizationId, session.session.activeOrganizationId),
                        gte(schema.toolCalls.createdAt, startTimeMs)
                    )
                )
                .orderBy(schema.toolCalls.createdAt)

            // Query MCP connections - grouped by user per day to avoid counting reconnections
            const connectionsResult = await db
                .select({
                    distinctId: schema.mcpServerConnection.distinctId,
                    email: schema.mcpServerConnection.email,
                    createdAt: schema.mcpServerConnection.createdAt,
                    slug: schema.mcpServerConnection.slug
                })
                .from(schema.mcpServerConnection)
                .leftJoin(schema.mcpServers, eq(schema.mcpServerConnection.slug, schema.mcpServers.slug))
                .where(
                    and(
                        eq(schema.mcpServers.organizationId, session.session.activeOrganizationId),
                        gte(schema.mcpServerConnection.createdAt, startTimeMs)
                    )
                )
                .orderBy(schema.mcpServerConnection.createdAt)

            // Process tool calls data - filter out null createdAt values
            const validToolCalls = toolCallsResult.filter((r) => r.createdAt !== null) as Array<{
                id: string
                toolName: string
                createdAt: number
            }>
            const toolNames = [...new Set(validToolCalls.map((r) => r.toolName))]

            // Process connections data - filter out null createdAt values
            const validConnections = connectionsResult.filter((r) => r.createdAt !== null) as Array<{
                distinctId: string | null
                email: string | null
                createdAt: number
                slug: string | null
            }>
            const processedConnections = processConnectionsPerUserPerDay(validConnections, input.timeRange)

            // If no data at all, return empty structure
            if (validToolCalls.length === 0 && validConnections.length === 0) {
                return {
                    data: [],
                    toolNames: [],
                    connectionTypes: []
                }
            }

            // Create time series data
            const timeSeriesData = createTimeSeriesData(
                validToolCalls,
                processedConnections,
                input.timeRange,
                toolNames
            )

            return {
                data: timeSeriesData,
                toolNames: toolNames,
                connectionTypes: ['mcp_connections']
            }
        } catch (error) {
            console.error('Error in getToolCallsChart:', error)
            throw error
        }
    })

function processConnectionsPerUserPerDay(
    connections: Array<{ distinctId: string | null; email: string | null; createdAt: number; slug: string | null }>,
    timeRange: '1h' | '1d' | '1w' | '1m'
) {
    // Group connections by user and day to avoid counting reconnections
    const userDayMap = new Map<string, Set<string>>()

    for (const conn of connections) {
        const userId = conn.email || conn.distinctId || 'unknown'
        const date = new Date(conn.createdAt)
        const dateKey = formatDateForTimeRange(date, timeRange)

        if (!userDayMap.has(dateKey)) {
            userDayMap.set(dateKey, new Set())
        }
        userDayMap.get(dateKey)!.add(userId)
    }

    // Convert to connection events (one per unique user per time period)
    const processedConnections = []
    for (const [dateKey, users] of userDayMap.entries()) {
        for (const userId of users) {
            processedConnections.push({
                userId,
                dateKey,
                type: 'mcp_connections'
            })
        }
    }

    return processedConnections
}

function createTimeSeriesData(
    toolCalls: Array<{ id: string; toolName: string; createdAt: number }>,
    connections: Array<{ userId: string; dateKey: string; type: string }>,
    timeRange: '1h' | '1d' | '1w' | '1m',
    toolNames: string[]
) {
    const now = new Date()
    const timeSeriesMap = new Map<string, Record<string, number>>()

    // Initialize time buckets
    let intervals: number
    let intervalMs: number

    switch (timeRange) {
        case '1h':
            intervals = 12 // 5-minute intervals
            intervalMs = 5 * 60 * 1000
            break
        case '1d':
            intervals = 24 // hourly intervals
            intervalMs = 60 * 60 * 1000
            break
        case '1w':
            intervals = 7 // daily intervals
            intervalMs = 24 * 60 * 60 * 1000
            break
        case '1m':
            intervals = 30 // daily intervals
            intervalMs = 24 * 60 * 60 * 1000
            break
    }

    // Create time buckets
    for (let i = intervals - 1; i >= 0; i--) {
        const bucketTime = new Date(now.getTime() - i * intervalMs)
        const bucketKey = formatDateForTimeRange(bucketTime, timeRange)

        const bucket: Record<string, number> = {}
        // Initialize tool call counts
        for (const toolName of toolNames) {
            bucket[toolName] = 0
        }
        // Initialize connection counts
        bucket.mcp_connections = 0

        timeSeriesMap.set(bucketKey, bucket)
    }

    // Fill buckets with tool call data
    for (const item of toolCalls) {
        const itemTime = new Date(item.createdAt)
        const bucketKey = formatDateForTimeRange(itemTime, timeRange)

        const bucket = timeSeriesMap.get(bucketKey)
        if (bucket) {
            bucket[item.toolName] = (bucket[item.toolName] || 0) + 1
        }
    }

    // Fill buckets with connection data
    for (const conn of connections) {
        const bucket = timeSeriesMap.get(conn.dateKey)
        if (bucket) {
            bucket.mcp_connections = (bucket.mcp_connections || 0) + 1
        }
    }

    // Convert to array format
    return Array.from(timeSeriesMap.entries()).map(([date, metrics]) => ({
        date,
        ...(metrics || {})
    }))
}

function formatDateForTimeRange(date: Date, timeRange: '1h' | '1d' | '1w' | '1m'): string {
    switch (timeRange) {
        case '1h':
            return date.toISOString().slice(0, 16).replace('T', ' ')
        case '1d':
            return `${date.toISOString().slice(0, 13).replace('T', ' ')}:00`
        case '1w':
        case '1m':
            return date.toISOString().slice(0, 10)
    }
}

export const router = {
    example: {
        execute: executeExample
    },
    toolCalls: {
        getChart: getToolCallsChart
    }
}
