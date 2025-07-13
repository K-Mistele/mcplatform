'use client'

import { AddServerModal } from '@/components/add-server-modal'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { IconPlus } from '@tabler/icons-react'

export function QuickCreateSection() {
    return (
        <div className="@container/card h-full">
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardDescription>Quick Actions</CardDescription>
                    <CardTitle className="text-4xl font-semibold tabular-nums @[250px]/card:text-5xl">1</CardTitle>
                    <CardAction>
                        <Badge variant="outline">
                            <IconPlus className="size-4" />
                            Available
                        </Badge>
                    </CardAction>
                </CardHeader>
                <CardContent className="flex-1">
                    <div className="flex items-center gap-4">
                        <AddServerModal />
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        Create new resources <IconPlus className="size-4" />
                    </div>
                    <div className="text-muted-foreground">Quickly create new resources for your organization</div>
                </CardFooter>
            </Card>
        </div>
    )
}
