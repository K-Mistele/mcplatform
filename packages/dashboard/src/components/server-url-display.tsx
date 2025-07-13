'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CopyIcon } from 'lucide-react'
import { toast } from 'sonner'

export function ServerUrlDisplay({ url }: { url: string }) {
    return (
        <div>
            <div className="text-sm font-medium text-muted-foreground">Server URL</div>
            <div className="mt-1 flex flex-row gap-2 items-center">
                <Badge variant="secondary" className="font-mono text-sm">
                    {url}
                </Badge>
                <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => {
                        navigator.clipboard.writeText(url)
                        toast.success('URL copied to clipboard')
                    }}
                >
                    <CopyIcon className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
