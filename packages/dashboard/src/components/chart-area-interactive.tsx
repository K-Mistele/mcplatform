'use client'

import * as React from 'react'
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
    const [timeRange, setTimeRange] = React.useState<'1h' | '1d' | '1w' | '1m'>('1d')
    const [chartData, setChartData] = React.useState<any[]>([])
    const [toolNames, setToolNames] = React.useState<string[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)

    React.useEffect(() => {
        if (isMobile) {
            setTimeRange('1h')
        }
    }, [isMobile])

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)

                const result = await client.toolCalls.getChart({
                    timeRange: timeRange
                })

                setChartData(result.data)
                setToolNames(result.toolNames)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [timeRange])

    // Generate chart config dynamically using theme colors
    const chartConfig: ChartConfig = React.useMemo(() => {
        const config: ChartConfig = {
            visitors: {
                label: 'Tool Calls'
            }
        }

        const chartColors = [
            'var(--color-chart-1)',
            'var(--color-chart-2)',
            'var(--color-chart-3)',
            'var(--color-chart-4)',
            'var(--color-chart-5)'
        ]

        for (const [index, toolName] of toolNames.entries()) {
            config[toolName] = {
                label: toolName,
                color: chartColors[index % chartColors.length]
            }
        }

        return config
    }, [toolNames])

    if (loading) {
        return (
            <Card className="@container/card">
                <CardHeader>
                    <CardTitle>Tool Calls Activity</CardTitle>
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
                    <CardTitle>Tool Calls Activity</CardTitle>
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

    return (
        <Card className="@container/card">
            <CardHeader>
                <CardTitle>Tool Calls Activity</CardTitle>
                <CardDescription>
                    <span className="hidden @[540px]/card:block">MCP tool calls over time</span>
                    <span className="@[540px]/card:hidden">Tool calls over time</span>
                </CardDescription>
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
            </CardHeader>
            <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
                <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
                    <AreaChart data={chartData}>
                        <defs>
                            {toolNames.map((toolName, index) => {
                                const chartColors = [
                                    'var(--color-chart-1)',
                                    'var(--color-chart-2)',
                                    'var(--color-chart-3)',
                                    'var(--color-chart-4)',
                                    'var(--color-chart-5)'
                                ]
                                const color = chartColors[index % chartColors.length]
                                return (
                                    <linearGradient key={toolName} id={`fill${toolName}`} x1="0" y1="0" x2="0" y2="1">
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
                                    return date.toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    })
                                }
                                return date.toLocaleDateString('en-US', {
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
                                            return date.toLocaleString('en-US', {
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            })
                                        }
                                        return date.toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric'
                                        })
                                    }}
                                    indicator="dot"
                                />
                            }
                        />
                        {toolNames.map((toolName, index) => {
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
                                    key={toolName}
                                    dataKey={toolName}
                                    type="natural"
                                    fill={`url(#fill${toolName})`}
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
