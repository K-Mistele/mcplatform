'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CpuIcon, EditIcon, MessageCircleIcon, SettingsIcon, TicketIcon, UserCheckIcon } from 'lucide-react'
import { use, useEffect, useState } from 'react'
import { CommentActions } from './comment-actions'
import { CommentForm } from './comment-form'
import { MarkdownRenderer } from './markdown-renderer'

interface Activity {
    id: string
    createdAt: number
    activityType: 'comment' | 'status_change' | 'assignment' | 'field_update' | 'system'
    content: any
    contentType: 'text' | 'markdown' | 'json'
    metadata?: any
    userName: string | null
    userEmail: string | null
}

interface ActivityStreamProps {
    activitiesPromise: Promise<Activity[]>
    ticketId: string
    currentStatus: string
}

interface ActivityItemProps {
    activity: Activity
}

function formatDate(timestamp: number): string {
    const date = new Date(timestamp)

    // Always use absolute date formatting to avoid hydration mismatches
    // The relative time can be calculated client-side after hydration
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

function getActivityIcon(type: string) {
    switch (type) {
        case 'comment':
            return <MessageCircleIcon className="h-4 w-4" />
        case 'status_change':
            return <SettingsIcon className="h-4 w-4" />
        case 'assignment':
            return <UserCheckIcon className="h-4 w-4" />
        case 'field_update':
            return <EditIcon className="h-4 w-4" />
        case 'system':
            return <CpuIcon className="h-4 w-4" />
        default:
            return <TicketIcon className="h-4 w-4" />
    }
}

function getStatusColor(status: string) {
    switch (status) {
        case 'needs_email':
            return 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
        case 'pending':
            return 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
        case 'in_progress':
            return 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
        case 'resolved':
            return 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
        case 'closed':
            return 'bg-slate-600 text-white border-slate-700 hover:bg-slate-700'
        default:
            return 'bg-slate-600 text-white border-slate-700 hover:bg-slate-700'
    }
}

function ActivityItem({ activity }: ActivityItemProps) {
    const userInitials = activity.userName
        ? activity.userName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : activity.userEmail?.[0]?.toUpperCase() || 'U'

    const renderActivityContent = () => {
        switch (activity.activityType) {
            case 'comment': {
                // Ensure hasStatusChange is consistently evaluated
                const hasStatusChange = Boolean(
                    activity.metadata?.statusChange?.oldStatus && activity.metadata?.statusChange?.newStatus
                )
                return (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                                <span>{activity.userName || activity.userEmail}</span>
                                <span className="text-muted-foreground">
                                    {hasStatusChange ? 'commented and changed status' : 'commented'}
                                </span>
                                {getActivityIcon('comment')}
                            </div>
                            <CommentActions activityId={activity.id} content={activity.content} />
                        </div>
                        {hasStatusChange && (
                            <div className="flex items-center gap-2 text-sm ml-6 flex-wrap">
                                <span className="text-muted-foreground">Status changed from</span>
                                <Badge className={getStatusColor(activity.metadata.statusChange.oldStatus)}>
                                    {activity.metadata.statusChange.oldStatus?.replace('_', ' ')}
                                </Badge>
                                <span className="text-muted-foreground">to</span>
                                <Badge className={getStatusColor(activity.metadata.statusChange.newStatus)}>
                                    {activity.metadata.statusChange.newStatus?.replace('_', ' ')}
                                </Badge>
                            </div>
                        )}
                        <div className="ml-6">
                            <MarkdownRenderer content={activity.content} />
                        </div>
                    </div>
                )
            }

            case 'status_change': {
                // Ensure we have valid status data before rendering
                if (!activity.content?.oldStatus || !activity.content?.newStatus) {
                    return (
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <span>{activity.userName || activity.userEmail}</span>
                            <span className="text-muted-foreground">changed status</span>
                            {getActivityIcon('status_change')}
                        </div>
                    )
                }

                return (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
                            <span>{activity.userName || activity.userEmail}</span>
                            <span className="text-muted-foreground">changed status from</span>
                            <Badge className={getStatusColor(activity.content.oldStatus)}>
                                {activity.content.oldStatus?.replace('_', ' ')}
                            </Badge>
                            <span className="text-muted-foreground">to</span>
                            <Badge className={getStatusColor(activity.content.newStatus)}>
                                {activity.content.newStatus?.replace('_', ' ')}
                            </Badge>
                            {getActivityIcon('status_change')}
                        </div>
                        {activity.metadata?.comment && (
                            <div className="ml-6 text-sm text-muted-foreground">"{activity.metadata.comment}"</div>
                        )}
                    </div>
                )
            }

            case 'assignment':
                return (
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span>{activity.userName || activity.userEmail}</span>
                        {activity.content?.newAssigneeId ? (
                            <span className="text-muted-foreground">assigned this ticket</span>
                        ) : (
                            <span className="text-muted-foreground">unassigned this ticket</span>
                        )}
                        {getActivityIcon('assignment')}
                    </div>
                )

            case 'field_update': {
                if (!activity.content || typeof activity.content !== 'object') {
                    return (
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <span>{activity.userName || activity.userEmail}</span>
                            <span className="text-muted-foreground">updated fields</span>
                            {getActivityIcon('field_update')}
                        </div>
                    )
                }

                const changes = Object.keys(activity.content)
                return (
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <span>{activity.userName || activity.userEmail}</span>
                            <span className="text-muted-foreground">updated</span>
                            {getActivityIcon('field_update')}
                        </div>
                        <div className="ml-6 space-y-1">
                            {changes.map((field) => (
                                <div key={field} className="text-sm">
                                    <span className="font-medium">{field}:</span>
                                    <span className="text-muted-foreground ml-1">
                                        "{activity.content[field]?.old || 'N/A'}" → "
                                        {activity.content[field]?.new || 'N/A'}"
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            default:
                return (
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <span className="text-muted-foreground">System activity</span>
                        {getActivityIcon('system')}
                    </div>
                )
        }
    }

    return (
        <div className="border rounded-lg p-4 bg-card">
            <div className="flex gap-3">
                <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src="" alt={activity.userName || activity.userEmail || ''} />
                    <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                    {renderActivityContent()}
                    <div className="text-xs text-muted-foreground">
                        <TimeDisplay timestamp={activity.createdAt} />
                    </div>
                </div>
            </div>
        </div>
    )
}

// Custom hook for client-side relative time formatting
function useRelativeTime(timestamp: number) {
    const [relativeTime, setRelativeTime] = useState<string | null>(null)

    useEffect(() => {
        const updateRelativeTime = () => {
            const date = new Date(timestamp)
            const now = new Date()
            const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

            if (diffInSeconds < 60) {
                setRelativeTime('Just now')
            } else if (diffInSeconds < 3600) {
                const minutes = Math.floor(diffInSeconds / 60)
                setRelativeTime(`${minutes} minute${minutes > 1 ? 's' : ''} ago`)
            } else if (diffInSeconds < 86400) {
                const hours = Math.floor(diffInSeconds / 3600)
                setRelativeTime(`${hours} hour${hours > 1 ? 's' : ''} ago`)
            } else {
                setRelativeTime(null) // Use absolute time for older items
            }
        }

        updateRelativeTime()
        const interval = setInterval(updateRelativeTime, 60000) // Update every minute

        return () => clearInterval(interval)
    }, [timestamp])

    return relativeTime
}

// Component for displaying time that shows both relative and absolute
function TimeDisplay({ timestamp }: { timestamp: number }) {
    const relativeTime = useRelativeTime(timestamp)
    const absoluteTime = formatDate(timestamp)

    // Show relative time with absolute time in title for hover
    return <span title={absoluteTime}>{relativeTime || absoluteTime}</span>
}

export function ActivityStream({ activitiesPromise, ticketId, currentStatus }: ActivityStreamProps) {
    // Use the promise directly - errors will be caught by ErrorBoundary
    const activities = use(activitiesPromise)

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageCircleIcon className="h-5 w-5" />
                    Activity
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
                <CommentForm ticketId={ticketId} currentStatus={currentStatus} />

                <Separator className="my-6" />

                <div className="space-y-4">
                    {activities.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">No activity yet</div>
                    ) : (
                        activities.map((activity) => <ActivityItem key={activity.id} activity={activity} />)
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
