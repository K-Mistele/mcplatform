'use client'

import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { Globe2Icon, EyeOffIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { updateWalkthroughAction } from '../lib/orpc/actions/walkthroughs'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Switch } from './ui/switch'

interface WalkthroughData {
    id: string
    title: string
    status: 'draft' | 'published' | 'archived'
}

interface PublicationStatusCardProps {
    walkthrough: WalkthroughData
}

export function PublicationStatusCard({ walkthrough }: PublicationStatusCardProps) {
    const [isPublished, setIsPublished] = useState(walkthrough.status === 'published')
    
    const { execute: updateStatus, status } = useServerAction(updateWalkthroughAction, {
        interceptors: [
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update publication status')
                }
                // Revert the toggle on error
                setIsPublished(!isPublished)
            })
        ]
    })

    const handleToggle = async (checked: boolean) => {
        setIsPublished(checked)
        const [error, result] = await updateStatus({
            walkthroughId: walkthrough.id,
            isPublished: checked
        })
        
        if (!error && result) {
            // Show success message based on the action performed
            toast.success(checked ? 'Walkthrough published' : 'Walkthrough unpublished')
        }
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {isPublished ? (
                        <Globe2Icon className="h-5 w-5 text-green-600" />
                    ) : (
                        <EyeOffIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    Publication Status
                </CardTitle>
                <CardDescription>
                    Control whether this walkthrough is visible to end users
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between py-4 px-4 bg-muted/50 rounded-lg">
                    <div>
                        <p className="font-medium">
                            {isPublished ? 'Published' : 'Draft'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            {isPublished 
                                ? 'This walkthrough is visible to end users through MCP servers' 
                                : 'This walkthrough is only visible to your team'}
                        </p>
                    </div>
                    <Switch
                        checked={isPublished}
                        onCheckedChange={handleToggle}
                        disabled={status === 'pending'}
                        aria-label="Toggle publication status"
                        className="data-[state=checked]:bg-green-600"
                    />
                </div>
                
                <div className="p-4 bg-muted/30 rounded-lg border border-muted">
                    <p className="text-sm text-muted-foreground">
                        <span className="font-medium">Note:</span> Only published walkthroughs will be available to end users 
                        through your MCP servers. Draft walkthroughs remain private to your organization.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}