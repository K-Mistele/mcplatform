'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { IconTrendingUp } from '@tabler/icons-react'
import { use } from 'react'

interface ActiveUsersCardProps {
    activeUsersPromise: Promise<{ count: number }>
}

export function ActiveUsersCard({ activeUsersPromise }: ActiveUsersCardProps) {
    const data = use(activeUsersPromise)

    return (
        <Card className="@container/card h-full flex flex-col">
            <CardHeader>
                <CardDescription>Active Users</CardDescription>
                <CardTitle className="text-4xl font-semibold tabular-nums @[250px]/card:text-5xl">
                    {data.count?.toLocaleString('en-US') ?? 0}
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
                    Strong user retention <IconTrendingUp className="size-4" />
                </div>
                <div className="text-muted-foreground">Engagement exceed targets</div>
            </CardFooter>
        </Card>
    )
}
