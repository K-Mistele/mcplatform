'use client'

import { AddServerModal } from '@/components/add-server-modal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ServerIcon } from 'lucide-react'

export function QuickCreateSection() {
    return (
        <div className="px-4 lg:px-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ServerIcon className="h-5 w-5" />
                        Quick Actions
                    </CardTitle>
                    <CardDescription>Quickly create new resources for your organization</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <AddServerModal />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
