'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateMcpServerConfiguration } from '@/lib/orpc/actions'
import { mcpServerAuthTypeSchema, supportRequestMethodSchema } from '@/lib/schemas.isometric'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { EditIcon, SaveIcon, ShieldIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const updateConfigurationSchema = z.object({
    authType: mcpServerAuthTypeSchema,
    supportTicketType: supportRequestMethodSchema
})

type UpdateConfigurationInput = z.infer<typeof updateConfigurationSchema>

interface EditServerConfigurationProps {
    serverId: string
    currentAuthType: string
    currentSupportTicketType: string
}

function getAuthTypeLabel(authType: string): string {
    switch (authType) {
        case 'oauth':
            return 'OAuth'
        case 'collect_email':
            return 'Collect Email'
        default:
            return 'None'
    }
}

function getSupportTypeLabel(supportType: string): string {
    switch (supportType) {
        case 'slack':
            return 'Slack'
        case 'linear':
            return 'Linear'
        default:
            return 'Dashboard'
    }
}

export function EditServerConfiguration({
    serverId,
    currentAuthType,
    currentSupportTicketType
}: EditServerConfigurationProps) {
    const [isEditing, setIsEditing] = useState(false)

    const form = useForm<UpdateConfigurationInput>({
        resolver: zodResolver(updateConfigurationSchema),
        defaultValues: {
            authType: currentAuthType as any,
            supportTicketType: currentSupportTicketType as any
        }
    })

    const { execute, status } = useServerAction(updateMcpServerConfiguration, {
        interceptors: [
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update configuration')
                }
            }),
            onSuccess(async () => {
                toast.success('Configuration updated successfully')
                setIsEditing(false)
            })
        ]
    })

    const handleSubmit = (data: UpdateConfigurationInput) => {
        execute({
            serverId,
            authType: data.authType,
            supportTicketType: data.supportTicketType
        })
    }

    const handleCancel = () => {
        form.reset({
            authType: currentAuthType as any,
            supportTicketType: currentSupportTicketType as any
        })
        setIsEditing(false)
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldIcon className="h-5 w-5" />
                            Configuration
                        </CardTitle>
                        <CardDescription>Authentication and support settings</CardDescription>
                    </div>
                    {!isEditing && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditing(true)}
                            className="cursor-pointer"
                        >
                            <EditIcon className="h-4 w-4" />
                            Edit
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="authType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Authentication Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select authentication type" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                <SelectItem value="oauth">OAuth</SelectItem>
                                                <SelectItem value="collect_email">Collect Email</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            Choose how users will authenticate with the server.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="supportTicketType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Support Ticket Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select support method" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="dashboard">Dashboard</SelectItem>
                                                <SelectItem value="slack">Slack</SelectItem>
                                                <SelectItem value="linear">Linear</SelectItem>
                                                <SelectItem value="none">None</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            How support tickets will be handled for this server.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex gap-2">
                                <Button type="submit" disabled={status === 'pending'} className="cursor-pointer">
                                    <SaveIcon className="h-4 w-4" />
                                    {status === 'pending' ? 'Saving...' : 'Save'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancel}
                                    disabled={status === 'pending'}
                                    className="cursor-pointer"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </Form>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <div className="text-sm font-medium text-muted-foreground">Authentication Type</div>
                            <div className="mt-1">
                                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                                    {getAuthTypeLabel(currentAuthType)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <div className="text-sm font-medium text-muted-foreground">Support Ticket Type</div>
                            <div className="mt-1">
                                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                                    {getSupportTypeLabel(currentSupportTicketType)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
