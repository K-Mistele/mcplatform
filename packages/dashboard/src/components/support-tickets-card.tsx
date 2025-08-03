'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { IconTrendingDown } from '@tabler/icons-react'
import { use } from 'react'

interface SupportTicketsCardProps {
    supportTicketsPromise: Promise<{ count: number }>
}

export function SupportTicketsCard({ supportTicketsPromise }: SupportTicketsCardProps) {
    const data = use(supportTicketsPromise)

    return (
        <Card className="@container/card h-full flex flex-col">
            <CardHeader>
                <CardDescription>Support Tickets</CardDescription>
                <CardTitle className="text-4xl font-semibold tabular-nums @[250px]/card:text-5xl">
                    {data.count?.toLocaleString('en-US') ?? 0}
                </CardTitle>
                <CardAction>
                    <Badge variant="outline">
                        <IconTrendingDown />
                        -20%
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
                <div className="line-clamp-1 flex gap-2 font-medium">
                    Down 20% this period <IconTrendingDown className="size-4" />
                </div>
                <div className="text-muted-foreground">Acquisition needs attention</div>
            </CardFooter>
        </Card>
    )
}
