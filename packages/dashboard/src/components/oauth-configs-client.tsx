'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconPlus, IconSearch, IconKey } from '@tabler/icons-react'
import { use, useState } from 'react'
import { AddOAuthConfigDialog } from './add-oauth-config-dialog'
import { EditOAuthConfigDialog } from './edit-oauth-config-dialog'
import { DeleteOAuthConfigDialog } from './delete-oauth-config-dialog'
import { OAuthConfigsTable } from './oauth-configs-table'

interface OAuthConfig {
    id: string
    name: string
    metadataUrl: string
    authorizationUrl: string
    clientId: string
    createdAt: number | null
    usageCount: number
}

interface OAuthConfigsClientProps {
    configsPromise: Promise<OAuthConfig[]>
}

export function OAuthConfigsClient({ configsPromise }: OAuthConfigsClientProps) {
    const configs = use(configsPromise)
    
    const [searchValue, setSearchValue] = useState('')
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [selectedConfig, setSelectedConfig] = useState<OAuthConfig | null>(null)

    // Filter configs based on search
    const filteredConfigs = configs.filter(config => 
        config.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        config.clientId.toLowerCase().includes(searchValue.toLowerCase()) ||
        config.metadataUrl.toLowerCase().includes(searchValue.toLowerCase())
    )

    const handleEdit = (config: OAuthConfig) => {
        setSelectedConfig(config)
        setEditDialogOpen(true)
    }

    const handleDelete = (config: OAuthConfig) => {
        setSelectedConfig(config)
        setDeleteDialogOpen(true)
    }

    return (
        <>
            <div className="space-y-4">
                {/* Header Actions */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                        <div className="relative flex-1">
                            <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search configurations..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                    </div>
                    <Button onClick={() => setAddDialogOpen(true)}>
                        <IconPlus className="mr-2 h-4 w-4" />
                        Add Configuration
                    </Button>
                </div>

                {/* Empty State */}
                {configs.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg">
                        <IconKey className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No OAuth configurations</h3>
                        <p className="text-sm text-muted-foreground text-center mb-4">
                            Create your first OAuth configuration to enable custom authentication for your MCP servers.
                        </p>
                        <Button onClick={() => setAddDialogOpen(true)}>
                            <IconPlus className="mr-2 h-4 w-4" />
                            Add Your First Configuration
                        </Button>
                    </div>
                )}

                {/* Configurations Table */}
                {configs.length > 0 && (
                    <OAuthConfigsTable
                        configs={filteredConfigs}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                )}
            </div>

            {/* Dialogs */}
            <AddOAuthConfigDialog 
                open={addDialogOpen} 
                onOpenChange={setAddDialogOpen}
            />
            
            {selectedConfig && (
                <>
                    <EditOAuthConfigDialog
                        open={editDialogOpen}
                        onOpenChange={setEditDialogOpen}
                        config={selectedConfig}
                    />
                    
                    <DeleteOAuthConfigDialog
                        open={deleteDialogOpen}
                        onOpenChange={setDeleteDialogOpen}
                        config={selectedConfig}
                    />
                </>
            )}
        </>
    )
}