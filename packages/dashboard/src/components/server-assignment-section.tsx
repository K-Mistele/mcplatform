'use client'

import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { ServerIcon, ToggleLeft, ToggleRight } from 'lucide-react'
import { use, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
    assignWalkthroughsToServerAction,
    updateWalkthroughAssignmentAction
} from '../lib/orpc/actions/walkthrough-assignment'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { MultiSelect } from './ui/multi-select'

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
            isEnabled: newIsEnabled === 'true'
        })
    }

    const multiSelectOptions = availableServers.map((s) => ({
        label: s.name,
        value: s.id,
        icon: ServerIcon
    }))

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ServerIcon className="h-5 w-5 text-primary" />
                    Server Assignments
                </CardTitle>
                <CardDescription>Choose which servers should offer this walkthrough</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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

                {assignedServers.length > 0 ? (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">Toggle to enable/disable on specific servers</p>
                        <div className="space-y-2">
                            {assignedServers.map((server) => (
                                <div
                                    key={server.id}
                                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-muted hover:bg-muted/50 transition-colors"
                                >
                                    <div className="space-y-1">
                                        <h4 className="font-medium">{server.name}</h4>
                                        <Badge variant="secondary" className="text-xs">
                                            {server.slug}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleToggle(server.id)}
                                        className="h-9 px-3"
                                    >
                                        {server.isEnabled === 'true' ? (
                                            <>
                                                <ToggleRight className="h-4 w-4 mr-1.5 text-green-600" />
                                                <span className="text-xs text-green-600 font-medium">Enabled</span>
                                            </>
                                        ) : (
                                            <>
                                                <ToggleLeft className="h-4 w-4 mr-1.5 text-muted-foreground" />
                                                <span className="text-xs text-muted-foreground">Disabled</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6 text-muted-foreground">
                        <ServerIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No servers selected yet</p>
                        <p className="text-xs mt-1">Use the dropdown above to assign this walkthrough to servers</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
