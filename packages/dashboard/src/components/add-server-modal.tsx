'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createMcpServer } from '@/lib/orpc/actions'
import { createMcpServerSchema } from '@/lib/schemas.isometric'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export type CreateMcpServerInput = z.infer<typeof createMcpServerSchema>

export function AddServerModal() {
    const [open, setOpen] = useState(false)
    const router = useRouter()

    const form = useForm<CreateMcpServerInput>({
        resolver: zodResolver(createMcpServerSchema),
        defaultValues: {
            name: '',
            authType: 'none',
            informationMessage: '',
            supportTicketType: 'dashboard'
        }
    })

    const { execute, status } = useServerAction(createMcpServer, {
        interceptors: [
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to create MCP server')
                }
            }),
            onSuccess(async (result) => {
                toast.success('MCP server created successfully')
                setOpen(false)
                form.reset()
                // Redirect to the details page for the newly created server
                // The result should have an id property
                if (result && typeof result === 'object' && 'id' in result) {
                    router.push(`/dashboard/mcp-servers/${result.id}`)
                }
            })
        ]
    })

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="cursor-pointer">
                    <IconPlus />
                    <span className="lg:inline">Add Server</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Add MCP Server</DialogTitle>
                    <DialogDescription>
                        Create a new Model Context Protocol server for your organization.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => execute(data))} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Server Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Enter server name" {...field} />
                                    </FormControl>
                                    <FormDescription>A unique name to identify your MCP server.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        How support tickets will be handled for this server.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={status === 'pending'} className="cursor-pointer">
                                {status === 'pending' ? 'Creating...' : 'Create Server'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
