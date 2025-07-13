'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyIcon, ExternalLinkIcon, MousePointerClickIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface CursorInstallLinkProps {
    serverName: string
    serverUrl: string
}

export function CursorInstallLink({ serverName, serverUrl }: CursorInstallLinkProps) {
    const [linkCopied, setLinkCopied] = useState(false)
    const [configCopied, setConfigCopied] = useState(false)

    const sanitizedServerName = serverName.replace(/[^a-zA-Z0-9]/g, '_')
    // Generate the MCP server configuration
    const config = {
        [sanitizedServerName]: {
            url: serverUrl
        }
    }

    // Base64 encode the configuration
    const base64Config = Buffer.from(JSON.stringify(config)).toString('base64')

    // Generate the Cursor install link
    const installLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(serverName)}&config=${base64Config}`

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(installLink)
            setLinkCopied(true)
            toast.success('Install link copied to clipboard')
            setTimeout(() => setLinkCopied(false), 2000)
        } catch (err) {
            toast.error('Failed to copy link')
        }
    }

    const handleCopyConfig = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
            setConfigCopied(true)
            toast.success('Configuration copied to clipboard')
            setTimeout(() => setConfigCopied(false), 2000)
        } catch (err) {
            toast.error('Failed to copy configuration')
        }
    }

    const handleInstallClick = () => {
        window.location.href = installLink
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MousePointerClickIcon className="h-5 w-5" />
                    Cursor Installation
                </CardTitle>
                <CardDescription>One-click installation for Cursor IDE (requires Cursor v1.0 or later)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* One-click install button */}
                <div className="space-y-2">
                    <div className="text-sm font-medium">One-Click Install</div>
                    <Button onClick={handleInstallClick} className="w-full" size="lg">
                        <ExternalLinkIcon className="h-4 w-4 mr-2" />
                        Install in Cursor
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        This will open Cursor and automatically configure the MCP server
                    </p>
                </div>

                {/* Install link */}
                <div className="space-y-2">
                    <div className="text-sm font-medium">Install Link</div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs break-all max-w-[200px] truncate">
                            {installLink}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
                            <CopyIcon className="h-4 w-4" />
                            {linkCopied ? 'Copied!' : 'Copy'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Share this link to allow others to install the server in Cursor
                    </p>
                </div>

                {/* Manual configuration */}
                <div className="space-y-2">
                    <div className="text-sm font-medium">Manual Configuration</div>
                    <div className="bg-muted p-3 rounded-md">
                        <pre className="text-xs text-muted-foreground">{JSON.stringify(config, null, 2)}</pre>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCopyConfig} className="w-full">
                        <CopyIcon className="h-4 w-4 mr-2" />
                        {configCopied ? 'Copied!' : 'Copy Configuration'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Add this configuration to your ~/.cursor/mcp.json file manually
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
