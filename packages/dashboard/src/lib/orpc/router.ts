import { requireSession } from '@/lib/auth/auth'
import { os } from '@orpc/server'
import { db, schema } from 'database'
import { and, eq, gte, or } from 'drizzle-orm'
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
            // Join with mcpServerUser to get tracking info
            const connectionsResult = await db
                .select({
                    distinctId: schema.mcpServerUser.trackingId,
                    email: schema.mcpServerUser.email,
                    connectionTimestamp: schema.mcpServerSession.connectionTimestamp,
                    connectionDate: schema.mcpServerSession.connectionDate,
                    slug: schema.mcpServers.slug
                })
                .from(schema.mcpServerSession)
                .leftJoin(schema.mcpServers, eq(schema.mcpServerSession.mcpServerSlug, schema.mcpServers.slug))
                .leftJoin(schema.mcpServerUser, eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id))
                .where(
                    and(
                        eq(schema.mcpServers.organizationId, session.session.activeOrganizationId),
                        or(
                            gte(schema.mcpServerSession.connectionTimestamp, startTimeMs),
                            gte(schema.mcpServerSession.connectionDate, startTime.toISOString().slice(0, 10))
                        )
                    )
                )
                .orderBy(schema.mcpServerSession.connectionTimestamp, schema.mcpServerSession.connectionDate)

            // Process tool calls data - filter out null createdAt values
            const validToolCalls = toolCallsResult.filter((r) => r.createdAt !== null) as Array<{
                id: string
                toolName: string
                createdAt: number
            }>
            const toolNames = [...new Set(validToolCalls.map((r) => r.toolName))]

            // Process connections data - use connectionTimestamp when available, fallback to connectionDate
            const validConnections = connectionsResult
                .filter((r) => r.connectionTimestamp !== null || r.connectionDate !== null)
                .map((r) => ({
                    distinctId: r.distinctId,
                    email: r.email,
                    createdAt: r.connectionTimestamp || new Date(r.connectionDate!).getTime(),
                    slug: r.slug
                }))

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
    // Group connections by user and time period to avoid counting reconnections
    const userTimeMap = new Map<string, Set<string>>()

    for (const conn of connections) {
        const userId = conn.email || conn.distinctId || 'unknown'
        const date = new Date(conn.createdAt)
        const dateKey = formatDateForTimeRange(date, timeRange)

        if (!userTimeMap.has(dateKey)) {
            userTimeMap.set(dateKey, new Set())
        }
        userTimeMap.get(dateKey)!.add(userId)
    }

    // Convert to connection events with both dateKey and timestamp for flexible matching
    const processedConnections = []
    for (const [dateKey, users] of userTimeMap.entries()) {
        for (const userId of users) {
            // Find the original connection to get the timestamp
            const originalConn = connections.find(
                (c) =>
                    (c.email || c.distinctId || 'unknown') === userId &&
                    formatDateForTimeRange(new Date(c.createdAt), timeRange) === dateKey
            )

            processedConnections.push({
                userId,
                dateKey,
                timestamp: originalConn?.createdAt || 0,
                type: 'mcp_connections'
            })
        }
    }

    return processedConnections
}

function createTimeSeriesData(
    toolCalls: Array<{ id: string; toolName: string; createdAt: number }>,
    connections: Array<{ userId: string; dateKey: string; timestamp: number; type: string }>,
    timeRange: '1h' | '1d' | '1w' | '1m',
    toolNames: string[]
) {
    const now = new Date()
    const nowMs = now.getTime()
    const timeSeriesMap = new Map<string, { timestamp: number; metrics: Record<string, number> }>()

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
        const bucketTime = new Date(nowMs - i * intervalMs)
        const bucketKey = formatDateForTimeRange(bucketTime, timeRange)

        const metrics: Record<string, number> = {}
        // Initialize tool call counts
        for (const toolName of toolNames) {
            metrics[toolName] = 0
        }
        // Initialize connection counts
        metrics.mcp_connections = 0

        timeSeriesMap.set(bucketKey, {
            timestamp: bucketTime.getTime(),
            metrics
        })
    }

    // Fill buckets with tool call data
    for (const item of toolCalls) {
        const roundedTimestamp = roundToNearestBucket(item.createdAt, timeRange, nowMs)
        const roundedTime = new Date(roundedTimestamp)
        const bucketKey = formatDateForTimeRange(roundedTime, timeRange)

        const bucket = timeSeriesMap.get(bucketKey)
        if (bucket) {
            bucket.metrics[item.toolName] = (bucket.metrics[item.toolName] || 0) + 1
        }
    }

    // Fill buckets with connection data - use rounded timestamp for accurate bucket matching
    for (const conn of connections) {
        if (conn.timestamp) {
            const roundedTimestamp = roundToNearestBucket(conn.timestamp, timeRange, nowMs)
            const roundedTime = new Date(roundedTimestamp)
            const bucketKey = formatDateForTimeRange(roundedTime, timeRange)
            const bucket = timeSeriesMap.get(bucketKey)

            if (bucket) {
                bucket.metrics.mcp_connections = (bucket.metrics.mcp_connections || 0) + 1
            }
        }
    }

    // Convert to array format
    return Array.from(timeSeriesMap.values()).map(({ timestamp, metrics }) => ({
        date: timestamp,
        ...metrics
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

function roundToNearestBucket(timestamp: number, timeRange: '1h' | '1d' | '1w' | '1m', referenceTime: number): number {
    let intervalMs: number

    switch (timeRange) {
        case '1h':
            intervalMs = 5 * 60 * 1000 // 5 minutes
            break
        case '1d':
            intervalMs = 60 * 60 * 1000 // 1 hour
            break
        case '1w':
        case '1m':
            intervalMs = 24 * 60 * 60 * 1000 // 1 day
            break
    }

    // Find which bucket this timestamp should belong to
    const timeDiff = referenceTime - timestamp
    const bucketIndex = Math.round(timeDiff / intervalMs)

    // Return the bucket time
    return referenceTime - bucketIndex * intervalMs
}

export const router = {
    example: {
        execute: executeExample
    },
    toolCalls: {
        getChart: getToolCallsChart
    }
}
