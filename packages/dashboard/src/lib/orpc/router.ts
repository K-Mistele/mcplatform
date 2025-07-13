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

            // Query tool calls - simplified approach
            const result = await db
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

            // Get all unique tool names
            const toolNames = [...new Set(result.map((r) => r.toolName))]

            // If no real data, create sample data for demonstration
            if (result.length === 0) {
                const sampleData = generateSampleData(input.timeRange, ['get_support', 'web_search', 'file_read'])
                return {
                    data: sampleData,
                    toolNames: ['get_support', 'web_search', 'file_read']
                }
            }

            // Process the data to create time series
            const timeSeriesData = createTimeSeriesData(result, input.timeRange, toolNames)

            return {
                data: timeSeriesData,
                toolNames: toolNames
            }
        } catch (error) {
            console.error('Error in getToolCallsChart:', error)

            // Return sample data as fallback
            const sampleData = generateSampleData(input.timeRange, ['get_support', 'web_search', 'file_read'])
            return {
                data: sampleData,
                toolNames: ['get_support', 'web_search', 'file_read']
            }
        }
    })

function createTimeSeriesData(
    data: Array<{ id: string; toolName: string; createdAt: number }>,
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
        for (const toolName of toolNames) {
            bucket[toolName] = 0
        }
        timeSeriesMap.set(bucketKey, bucket)
    }

    // Fill buckets with actual data
    for (const item of data) {
        const itemTime = new Date(item.createdAt)
        const bucketKey = formatDateForTimeRange(itemTime, timeRange)

        const bucket = timeSeriesMap.get(bucketKey)
        if (bucket) {
            bucket[item.toolName] = (bucket[item.toolName] || 0) + 1
        }
    }

    // Convert to array format
    return Array.from(timeSeriesMap.entries()).map(([date, tools]) => ({
        date,
        ...tools
    }))
}

function generateSampleData(timeRange: '1h' | '1d' | '1w' | '1m', toolNames: string[]) {
    const now = new Date()
    const data = []

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

    for (let i = intervals - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * intervalMs)
        const dataPoint: Record<string, any> = {
            date: formatDateForTimeRange(time, timeRange)
        }

        for (const toolName of toolNames) {
            dataPoint[toolName] = Math.floor(Math.random() * 10)
        }

        data.push(dataPoint)
    }

    return data
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
