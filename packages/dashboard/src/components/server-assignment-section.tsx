'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MultiSelect } from '@/components/ui/multi-select'
import {
    assignWalkthroughsToServerAction,
    updateWalkthroughAssignmentAction
} from '@/lib/orpc/actions/walkthrough-assignment'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { ServerIcon, ToggleLeft, ToggleRight } from 'lucide-react'
import { use, useEffect, useState } from 'react'
import { toast } from 'sonner'

interface ServerOption {
    id: string
    name: string
    slug: string
}

interface AssignedServer extends ServerOption {
    isEnabled: string // 'true' | 'false'
}

interface ServerAssignmentSectionProps {
    walkthroughId: string
    availableServersPromise: Promise<ServerOption[]>
    assignedServersPromise: Promise<AssignedServer[]>
}

export function ServerAssignmentSection({
    walkthroughId,
    availableServersPromise,
    assignedServersPromise
}: ServerAssignmentSectionProps) {
    const availableServers = use(availableServersPromise)
    const initialAssignedServers = use(assignedServersPromise)

    const [assignedServers, setAssignedServers] = useState<AssignedServer[]>(initialAssignedServers)
    const [selectedServerIds, setSelectedServerIds] = useState<string[]>(initialAssignedServers.map((s) => s.id))

    const { execute: assignWalkthrough } = useServerAction(assignWalkthroughsToServerAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Server assignments updated')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update server assignments')
                }
            })
        ]
    })

    const { execute: updateAssignment } = useServerAction(updateWalkthroughAssignmentAction, {
        interceptors: [
            onSuccess(() => {
                toast.success('Server assignment updated')
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update server assignment')
                }
            })
        ]
    })

    useEffect(() => {
        // Update assignments when selection changes
        const updatePromises = selectedServerIds
            .map((serverId) => {
                const serverExists = assignedServers.some((s) => s.id === serverId)
                if (!serverExists) {
                    // Assign this walkthrough to the newly selected server
                    return assignWalkthrough({
                        serverId,
                        walkthroughIds: [{ walkthroughId, displayOrder: 0 }]
                    })
                }
                return null
            })
            .filter(Boolean)

        // Remove assignments for deselected servers
        const removedServers = assignedServers.filter((s) => !selectedServerIds.includes(s.id))
        const removePromises = removedServers.map((server) =>
            assignWalkthrough({
                serverId: server.id,
                walkthroughIds: []
            })
        )

        // Update local state
        const newAssignedServers = selectedServerIds
            .map((id) => {
                const existing = assignedServers.find((s) => s.id === id)
                if (existing) return existing

                const available = availableServers.find((s) => s.id === id)
                if (!available) return null

                return {
                    ...available,
                    isEnabled: 'true' as const
                }
            })
            .filter((s): s is AssignedServer => s !== null)

        setAssignedServers(newAssignedServers)

        // Execute all promises
        Promise.all([...updatePromises, ...removePromises])
    }, [selectedServerIds])

    const handleToggle = async (serverId: string) => {
        const server = assignedServers.find((s) => s.id === serverId)
        if (!server) return

        const newIsEnabled = server.isEnabled === 'true' ? 'false' : 'true'

        setAssignedServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, isEnabled: newIsEnabled } : s)))

        await updateAssignment({
            serverId,
            walkthroughId,
            isEnabled: newIsEnabled
        })
    }

    const multiSelectOptions = availableServers.map((s) => ({
        label: s.name,
        value: s.id,
        icon: ServerIcon
    }))

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ServerIcon className="h-5 w-5" />
                    Server Assignments
                </CardTitle>
                <CardDescription>Choose which servers should offer this walkthrough</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label className="text-sm font-medium mb-2 block">Select Servers</label>
                    <MultiSelect
                        options={multiSelectOptions}
                        onValueChange={setSelectedServerIds}
                        defaultValue={selectedServerIds}
                        placeholder="Choose servers to deploy to..."
                        className="w-full"
                    />
                </div>

                {assignedServers.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Toggle to enable/disable on specific servers</p>
                        <div className="space-y-2">
                            {assignedServers.map((server) => (
                                <div
                                    key={server.id}
                                    className="flex items-center justify-between p-3 bg-card border rounded-lg"
                                >
                                    <div>
                                        <h4 className="font-medium">{server.name}</h4>
                                        <Badge variant="outline" className="text-xs mt-1">
                                            {server.slug}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggle(server.id)}
                                        className="h-8 w-8 p-0"
                                    >
                                        {server.isEnabled === 'true' ? (
                                            <ToggleRight className="h-4 w-4 text-green-600" />
                                        ) : (
                                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
