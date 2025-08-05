'use client'

import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useIsMobile } from '@/hooks/use-mobile'
import { client } from '@/lib/orpc/orpc.client'

export const description = 'An interactive area chart'

export function ChartAreaInteractive() {
    const isMobile = useIsMobile()
    const [timeRange, setTimeRange] = useState<'1h' | '1d' | '1w' | '1m'>('1d')
    const [chartData, setChartData] = useState<any[]>([])
    const [toolNames, setToolNames] = useState<string[]>([])
    const [connectionTypes, setConnectionTypes] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)

                const result = await client.toolCalls.getChart({
                    timeRange: timeRange
                })
                console.log('result', result)

                setChartData(result.data)
                setToolNames(result.toolNames)
                setConnectionTypes(result.connectionTypes || [])
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [timeRange])

    // Generate chart config dynamically using theme colors
    const chartConfig: ChartConfig = useMemo(() => {
        const config: ChartConfig = {
            visitors: {
                label: 'Activity'
            }
        }

        const chartColors = [
            'var(--color-chart-1)',
            'var(--color-chart-2)',
            'var(--color-chart-3)',
            'var(--color-chart-4)',
            'var(--color-chart-5)'
        ]

        // Add tool names
        for (const [index, toolName] of toolNames.entries()) {
            config[toolName] = {
                label: `${toolName}`,
                color: chartColors[index % chartColors.length]
            }
        }

        // Add connection types
        for (const [index, connectionType] of connectionTypes.entries()) {
            config[connectionType] = {
                label: connectionType === 'mcp_connections' ? 'users' : connectionType,
                color: chartColors[(toolNames.length + index) % chartColors.length]
            }
        }

        return config
    }, [toolNames, connectionTypes])

    // Get all chart keys for rendering
    const allChartKeys = [...toolNames, ...connectionTypes]

    if (loading) {
        return (
            <Card className="@container/card">
                <CardHeader>
                    <CardTitle>MCP Activity</CardTitle>
                    <CardDescription>Loading...</CardDescription>
                </CardHeader>
                <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    <div className="h-[250px] flex items-center justify-center">
                        <div className="text-muted-foreground">Loading chart data...</div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error) {
        return (
            <Card className="@container/card">
                <CardHeader>
                    <CardTitle>MCP Activity</CardTitle>
                    <CardDescription>Error loading data</CardDescription>
                </CardHeader>
                <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    <div className="h-[250px] flex items-center justify-center">
                        <div className="text-red-500">Error: {error}</div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    // Time range controls component to ensure they're always available
    const TimeRangeControls = () => (
        <CardAction>
            <ToggleGroup
                type="single"
                value={timeRange}
                onValueChange={(value) => value && setTimeRange(value as typeof timeRange)}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
            >
                <ToggleGroupItem value="1h">Past hour</ToggleGroupItem>
                <ToggleGroupItem value="1d">Past day</ToggleGroupItem>
                <ToggleGroupItem value="1w">Past week</ToggleGroupItem>
                <ToggleGroupItem value="1m">Past month</ToggleGroupItem>
            </ToggleGroup>
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as typeof timeRange)}>
                <SelectTrigger
                    className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                    size="sm"
                    aria-label="Select a value"
                >
                    <SelectValue placeholder="Past day" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                    <SelectItem value="1h" className="rounded-lg">
                        Past hour
                    </SelectItem>
                    <SelectItem value="1d" className="rounded-lg">
                        Past day
                    </SelectItem>
                    <SelectItem value="1w" className="rounded-lg">
                        Past week
                    </SelectItem>
                    <SelectItem value="1m" className="rounded-lg">
                        Past month
                    </SelectItem>
                </SelectContent>
            </Select>
        </CardAction>
    )

    if (allChartKeys.length === 0) {
        return (
            <Card className="@container/card">
                <CardHeader>
                    <CardTitle>MCP Activity</CardTitle>
                    <CardDescription>
                        <span className="hidden @[540px]/card:block">No MCP activity data available</span>
                        <span className="@[540px]/card:hidden">No data available</span>
                    </CardDescription>
                    <TimeRangeControls />
                </CardHeader>
                <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                    <div className="h-[250px] flex items-center justify-center">
                        <div className="text-muted-foreground">No tool calls or connections recorded yet</div>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="@container/card">
            <CardHeader>
                <CardTitle>MCP Activity</CardTitle>
                <CardDescription>
                    <span className="hidden @[540px]/card:block">Tool calls and connections over time</span>
                    <span className="@[540px]/card:hidden">Activity over time</span>
                </CardDescription>
                <TimeRangeControls />
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                    <AreaChart data={chartData}>
                        <defs>
                            {allChartKeys.map((key, index) => {
                                const chartColors = [
                                    'var(--color-chart-1)',
                                    'var(--color-chart-2)',
                                    'var(--color-chart-3)',
                                    'var(--color-chart-4)',
                                    'var(--color-chart-5)'
                                ]
                                const color = chartColors[index % chartColors.length]
                                return (
                                    <linearGradient key={key} id={`fill${key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={color} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                                    </linearGradient>
                                )
                            })}
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value) => {
                                const date = new Date(value)
                                if (timeRange === '1h') {
                                    return date.toLocaleTimeString(undefined, {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    })
                                }
                                if (timeRange === '1d') {
                                    return date.toLocaleTimeString(undefined, {
                                        hour: 'numeric',
                                        hour12: true
                                    })
                                }
                                return date.toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric'
                                })
                            }}
                        />
                        <ChartTooltip
                            cursor={false}
                            defaultIndex={isMobile ? -1 : 10}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) => {
                                        const date = new Date(value)
                                        if (timeRange === '1h') {
                                            return date.toLocaleString(undefined, {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })
                                        }
                                        if (timeRange === '1d') {
                                            return date.toLocaleString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: 'numeric',
                                                hour12: true
                                            })
                                        }
                                        return date.toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric'
                                        })
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        {allChartKeys.map((key, index) => {
                            const chartColors = [
                                'var(--color-chart-1)',
                                'var(--color-chart-2)',
                                'var(--color-chart-3)',
                                'var(--color-chart-4)',
                                'var(--color-chart-5)'
                            ]
                            const color = chartColors[index % chartColors.length]
                            return (
                                <Area
                                    key={key}
                                    dataKey={key}
                                    type="natural"
                                    fill={`url(#fill${key})`}
                                    stroke={color}
                                    stackId="a"
                                />
                            )
                        })}
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}
