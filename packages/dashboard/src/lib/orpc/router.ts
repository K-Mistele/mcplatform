import { requireSession } from '@/lib/auth/auth'
import { renderWalkthroughStep } from '@/lib/template-engine'
import { os } from '@orpc/server'
import { db, schema } from 'database'
import { and, desc, eq, gte, or } from 'drizzle-orm'
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

export const getSessionToolCalls = base
    .input(
        z.object({
            sessionId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        const toolCalls = await db
            .select({
                id: schema.toolCalls.id,
                toolName: schema.toolCalls.toolName,
                input: schema.toolCalls.input,
                output: schema.toolCalls.output,
                createdAt: schema.toolCalls.createdAt,
                serverName: schema.mcpServers.name,
                serverSlug: schema.mcpServers.slug
            })
            .from(schema.toolCalls)
            .leftJoin(schema.mcpServers, eq(schema.toolCalls.mcpServerId, schema.mcpServers.id))
            .where(
                and(
                    eq(schema.toolCalls.mcpServerSessionId, input.sessionId),
                    eq(schema.mcpServers.organizationId, session.session.activeOrganizationId)
                )
            )
            .orderBy(schema.toolCalls.createdAt)

        return toolCalls
    })

export const getSessionSupportTickets = base
    .input(
        z.object({
            sessionId: z.string()
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        const supportTickets = await db
            .select({
                id: schema.supportRequests.id,
                title: schema.supportRequests.title,
                conciseSummary: schema.supportRequests.conciseSummary,
                status: schema.supportRequests.status,
                createdAt: schema.supportRequests.createdAt,
                serverName: schema.mcpServers.name,
                serverSlug: schema.mcpServers.slug
            })
            .from(schema.supportRequests)
            .leftJoin(schema.mcpServers, eq(schema.supportRequests.mcpServerId, schema.mcpServers.id))
            .where(
                and(
                    eq(schema.supportRequests.mcpServerSessionId, input.sessionId),
                    eq(schema.mcpServers.organizationId, session.session.activeOrganizationId)
                )
            )
            .orderBy(schema.supportRequests.createdAt)

        return supportTickets
    })

export const getSupportTicketActivities = base
    .input(
        z.object({
            ticketId: z.string(),
            limit: z.number().optional().default(50),
            offset: z.number().optional().default(0)
        })
    )
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Verify ticket belongs to user's organization
        const [ticket] = await db
            .select()
            .from(schema.supportRequests)
            .where(
                and(
                    eq(schema.supportRequests.id, input.ticketId),
                    eq(schema.supportRequests.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!ticket) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Support ticket not found'
            })
        }

        const activities = await db
            .select({
                id: schema.supportTicketActivities.id,
                createdAt: schema.supportTicketActivities.createdAt,
                activityType: schema.supportTicketActivities.activityType,
                content: schema.supportTicketActivities.content,
                contentType: schema.supportTicketActivities.contentType,
                metadata: schema.supportTicketActivities.metadata,
                userName: schema.user.name,
                userEmail: schema.user.email
            })
            .from(schema.supportTicketActivities)
            .leftJoin(schema.user, eq(schema.supportTicketActivities.userId, schema.user.id))
            .where(eq(schema.supportTicketActivities.supportRequestId, input.ticketId))
            .orderBy(desc(schema.supportTicketActivities.createdAt))
            .limit(input.limit)
            .offset(input.offset)

        return activities
    })

export const getOrganizationMembers = base.handler(async ({ errors }) => {
    const session = await requireSession()

    const members = await db
        .select({
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            image: schema.user.image
        })
        .from(schema.user)
        .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
        .where(eq(schema.member.organizationId, session.session.activeOrganizationId))

    return members
})

export const getSupportTicketWithMcpUser = base
    .input(z.object({ ticketId: z.string() }))
    .handler(async ({ input, errors }) => {
        const session = await requireSession()

        // Get support ticket with associated MCP server user via session relationship
        const [ticketWithMcpUser] = await db
            .select({
                // Support ticket fields
                ticketId: schema.supportRequests.id,
                title: schema.supportRequests.title,
                status: schema.supportRequests.status,
                createdAt: schema.supportRequests.createdAt,
                
                // MCP Server User fields (the end user who submitted the ticket)
                mcpUserTrackingId: schema.mcpServerUser.trackingId,
                mcpUserEmail: schema.mcpServerUser.email,
                mcpUserFirstSeen: schema.mcpServerUser.firstSeenAt,
                
                // MCP Server info
                mcpServerName: schema.mcpServers.name,
                mcpServerSlug: schema.mcpServers.slug
            })
            .from(schema.supportRequests)
            .leftJoin(schema.mcpServerSession, eq(schema.supportRequests.mcpServerSessionId, schema.mcpServerSession.mcpServerSessionId))
            .leftJoin(schema.mcpServerUser, eq(schema.mcpServerSession.mcpServerUserId, schema.mcpServerUser.id))
            .leftJoin(schema.mcpServers, eq(schema.supportRequests.mcpServerId, schema.mcpServers.id))
            .where(
                and(
                    eq(schema.supportRequests.id, input.ticketId),
                    eq(schema.supportRequests.organizationId, session.session.activeOrganizationId)
                )
            )

        if (!ticketWithMcpUser) {
            throw errors.RESOURCE_NOT_FOUND({
                message: 'Support ticket not found'
            })
        }

        return ticketWithMcpUser
    })

export const renderWalkthroughStepRPC = base
    .input(
        z.object({
            walkthrough: z.object({
                title: z.string(),
                description: z.string().nullable(),
                type: z.string().nullable()
            }),
            step: z.object({
                id: z.string(),
                title: z.string(),
                displayOrder: z.number(),
                contentFields: z.any()
            })
        })
    )
    .handler(async ({ input }) => {
        return renderWalkthroughStep(input.walkthrough.title, input.step as any)
    })

export const router = {
    example: {
        execute: executeExample
    },
    toolCalls: {
        getChart: getToolCallsChart
    },
    sessions: {
        getToolCalls: getSessionToolCalls,
        getSupportTickets: getSessionSupportTickets
    },
    supportTickets: {
        getActivities: getSupportTicketActivities,
        getWithMcpUser: getSupportTicketWithMcpUser
    },
    organization: {
        getMembers: getOrganizationMembers
    },
    walkthrough: {
        renderStep: renderWalkthroughStepRPC
    }
}
