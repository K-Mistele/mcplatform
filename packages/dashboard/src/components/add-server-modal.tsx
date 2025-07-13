'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useRef, useState } from 'react'
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
import { createMcpServerAction, validateSubdomainAction } from '@/lib/orpc/actions'
import { createMcpServerSchema } from '@/lib/schemas.isometric'
import { cn } from '@/lib/utils'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export type CreateMcpServerInput = z.infer<typeof createMcpServerSchema>

export function AddServerModal() {
    const [open, setOpen] = useState(false)
    const [slugValidationError, setSlugValidationError] = useState<string | null>(null)
    const [isValidatingSlug, setIsValidatingSlug] = useState(false)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)
    const router = useRouter()

    const form = useForm<CreateMcpServerInput>({
        resolver: zodResolver(createMcpServerSchema),
        defaultValues: {
            name: '',
            slug: '',
            authType: 'none',
            informationMessage: '',
            supportTicketType: 'dashboard'
        }
    })

    const { execute, status } = useServerAction(createMcpServerAction, {
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
                resetValidationState()
                // Redirect to the details page for the newly created server
                if (result && typeof result === 'object' && 'id' in result) {
                    router.push(`/dashboard/mcp-servers/${result.id}`)
                }
            })
        ]
    })

    const { execute: validateSlug } = useServerAction(validateSubdomainAction, {
        interceptors: [
            onError((error) => {
                if (isDefinedError(error)) {
                    setSlugValidationError(error.message)
                } else {
                    setSlugValidationError('Failed to validate slug')
                }
                setIsValidatingSlug(false)
            }),
            onSuccess(() => {
                setSlugValidationError(null)
                setIsValidatingSlug(false)
            })
        ]
    })

    // Helper function to reset validation state
    const resetValidationState = useCallback(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }
        setSlugValidationError(null)
        setIsValidatingSlug(false)
    }, [])

    // Debounced validation function with 2-second delay
    const debouncedValidateSlug = useCallback(
        (slug: string) => {
            // Clear existing timeout
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }

            // Clear previous error state when user starts typing
            if (slugValidationError) {
                setSlugValidationError(null)
            }

            // Reset validating state
            setIsValidatingSlug(false)

            // Set timeout for validation
            debounceRef.current = setTimeout(() => {
                if (slug.length >= 6) {
                    setIsValidatingSlug(true)
                    validateSlug({ subdomain: slug })
                } else if (slug.length > 0) {
                    setSlugValidationError('Server slugs must be at least 6 characters long.')
                    setIsValidatingSlug(false)
                } else {
                    setSlugValidationError(null)
                    setIsValidatingSlug(false)
                }
            }, 2000) // 2 second debounce
        },
        [validateSlug, slugValidationError]
    )

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [])

    // Reset validation state when modal closes
    useEffect(() => {
        if (!open) {
            resetValidationState()
        }
    }, [open, resetValidationState])

    const currentSlug = form.watch('slug')
    const isButtonDisabled = status === 'pending' || !!slugValidationError || isValidatingSlug

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
                            name="slug"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Server Slug</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="my-server-slug"
                                            {...field}
                                            className={cn(
                                                slugValidationError && 'border-red-500 focus-visible:ring-red-500'
                                            )}
                                            onChange={(e) => {
                                                // Convert to lowercase and replace spaces with hyphens
                                                const value = e.target.value
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9-]/g, '-')
                                                    .replace(/-+/g, '-')
                                                field.onChange(value)

                                                // Trigger debounced validation
                                                debouncedValidateSlug(value)
                                            }}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        URL-friendly identifier for your server. Will be used in{' '}
                                        {field.value ? `${field.value}.mcp.naptha.gg` : 'slug.mcp.naptha.gg'}
                                        {isValidatingSlug && (
                                            <span className="ml-2 text-sm text-muted-foreground">Validating...</span>
                                        )}
                                    </FormDescription>
                                    <FormMessage />
                                    {slugValidationError && (
                                        <p className="text-sm text-red-500 mt-1">{slugValidationError}</p>
                                    )}
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
                            <Button type="submit" disabled={isButtonDisabled} className="cursor-pointer">
                                {status === 'pending' ? 'Creating...' : 'Create Server'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
