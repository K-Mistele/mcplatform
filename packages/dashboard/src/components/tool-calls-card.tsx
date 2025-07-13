'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { IconTrendingUp } from '@tabler/icons-react'
import { use } from 'react'

interface ToolCallsCardProps {
    toolCallsPromise: Promise<{ count: number }>
}

export function ToolCallsCard({ toolCallsPromise }: ToolCallsCardProps) {
    const data = use(toolCallsPromise)

    return (
        <Card className="@container/card h-full flex flex-col">
            <CardHeader>
                <CardDescription>MCP Tool Calls</CardDescription>
                <CardTitle className="text-4xl font-semibold tabular-nums @[250px]/card:text-5xl">
                    {data.count.toLocaleString()}
                </CardTitle>
                <CardAction>
                    <Badge variant="outline">
                        <IconTrendingUp />
                        +12.5%
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                    Trending up this month <IconTrendingUp className="size-4" />
                </div>
                <div className="text-muted-foreground">Tool calls for the last 6 months</div>
            </CardFooter>
        </Card>
    )
}
