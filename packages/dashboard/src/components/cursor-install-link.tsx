'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyIcon, MousePointerClickIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from './ui/input'

interface CursorInstallLinkProps {
    serverName: string
    serverUrl: string
}

export function CursorInstallLink({ serverName, serverUrl }: CursorInstallLinkProps) {
    const [linkCopied, setLinkCopied] = useState(false)
    const [configCopied, setConfigCopied] = useState(false)
    const [darkButtonCopied, setDarkButtonCopied] = useState(false)
    const [lightButtonCopied, setLightButtonCopied] = useState(false)

    // Generate the MCP server configuration
    const config = {
        name: serverName,
        url: serverUrl
    }

    // Sanitize server name for URL
    const sanitizedServerName = encodeURIComponent(serverName)

    // Base64 encode the configuration
    const base64Config = Buffer.from(JSON.stringify(config)).toString('base64')

    // Generate the Cursor install link
    const installLink = `cursor://anysphere.cursor-deeplink/mcp/install?name=${sanitizedServerName}&config=${base64Config}`

    // Generate the raw HTML for each button
    const darkButtonHtml = `<a href="cursor://anysphere.cursor-deeplink/mcp/install?name=${sanitizedServerName}&config=${base64Config}">
    <img
        src="https://cursor.com/deeplink/mcp-install-dark.svg"
        alt="Add ${serverName} MCP server to Cursor"
        height="32"
    />
</a>`

    const lightButtonHtml = `<a href="cursor://anysphere.cursor-deeplink/mcp/install?name=${sanitizedServerName}&config=${base64Config}">
    <img
        src="https://cursor.com/deeplink/mcp-install-light.svg"
        alt="Add ${serverName} MCP server to Cursor"
        height="32"
    />
</a>`

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

    const handleCopyDarkButton = async () => {
        try {
            await navigator.clipboard.writeText(darkButtonHtml)
            setDarkButtonCopied(true)
            toast.success('Dark button HTML copied to clipboard')
            setTimeout(() => setDarkButtonCopied(false), 2000)
        } catch (err) {
            toast.error('Failed to copy dark button HTML')
        }
    }

    const handleCopyLightButton = async () => {
        try {
            await navigator.clipboard.writeText(lightButtonHtml)
            setLightButtonCopied(true)
            toast.success('Light button HTML copied to clipboard')
            setTimeout(() => setLightButtonCopied(false), 2000)
        } catch (err) {
            toast.error('Failed to copy light button HTML')
        }
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
                    <div className="text-md font-bold">Installation Buttons</div>
                    <div className="flex flex-col items-start gap-2">
                        <div className="flex items-center gap-2">
                            <a
                                href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${sanitizedServerName}&config=${base64Config}`}
                            >
                                <img
                                    src="https://cursor.com/deeplink/mcp-install-dark.svg"
                                    alt="Add Kyle_s_MCP_Server MCP server to Cursor"
                                    height="32"
                                />
                            </a>
                            <Button variant="outline" size="sm" onClick={handleCopyDarkButton} className="shrink-0">
                                <CopyIcon className="h-4 w-4" />
                                {darkButtonCopied ? 'Copied!' : 'Copy HTML'}
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <a
                                href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${sanitizedServerName}&config=${base64Config}`}
                            >
                                <img
                                    src="https://cursor.com/deeplink/mcp-install-light.svg"
                                    alt="Add Kyle_s_MCP_Server MCP server to Cursor"
                                    height="32"
                                />
                            </a>
                            <Button variant="outline" size="sm" onClick={handleCopyLightButton} className="shrink-0">
                                <CopyIcon className="h-4 w-4" />
                                {lightButtonCopied ? 'Copied!' : 'Copy HTML'}
                            </Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        This will open Cursor and automatically configure the MCP server
                    </p>
                </div>

                {/* Install link */}
                <div className="space-y-2">
                    <div className="text-md font-bold">Install Link</div>
                    <div className="flex flex-row w-full items-center gap-2">
                        <Input className="font-mono text-xs break-all" value={installLink} readOnly />
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
                    <div className="text-md font-bold">Manual Configuration</div>
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
