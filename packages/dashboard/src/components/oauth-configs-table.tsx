'use client'

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { IconDotsVertical, IconEdit, IconTrash, IconExternalLink, IconServer } from '@tabler/icons-react'

interface OAuthConfig {
    id: string
    name: string
    metadataUrl: string
    authorizationUrl: string
    clientId: string
    createdAt: bigint
    usageCount: number
}

interface OAuthConfigsTableProps {
    configs: OAuthConfig[]
    onEdit: (config: OAuthConfig) => void
    onDelete: (config: OAuthConfig) => void
}

export function OAuthConfigsTable({ configs, onEdit, onDelete }: OAuthConfigsTableProps) {
    const formatDate = (timestamp: bigint) => {
        const date = new Date(Number(timestamp))
        const now = new Date()
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
        
        if (diffInSeconds < 60) return 'just now'
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
        return date.toLocaleDateString()
    }

    const getDomain = (url: string) => {
        try {
            const urlObj = new URL(url)
            return urlObj.hostname
        } catch {
            return url
        }
    }

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>OAuth Server</TableHead>
                        <TableHead>Client ID</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {configs.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={6} className="h-24 text-center">
                                No OAuth configurations found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        configs.map((config) => (
                            <TableRow key={config.id}>
                                <TableCell className="font-medium">
                                    {config.name}
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            {getDomain(config.metadataUrl)}
                                        </span>
                                        <a
                                            href={config.metadataUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <IconExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <code className="text-xs bg-muted px-2 py-1 rounded">
                                        {config.clientId}
                                    </code>
                                </TableCell>
                                <TableCell>
                                    {config.usageCount > 0 ? (
                                        <Badge variant="secondary" className="gap-1">
                                            <IconServer className="h-3 w-3" />
                                            {config.usageCount} server{config.usageCount > 1 ? 's' : ''}
                                        </Badge>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Unused</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {formatDate(config.createdAt)}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                            >
                                                <IconDotsVertical className="h-4 w-4" />
                                                <span className="sr-only">Open menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => onEdit(config)}>
                                                <IconEdit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                                onClick={() => onDelete(config)}
                                                className="text-destructive focus:text-destructive"
                                            >
                                                <IconTrash className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}