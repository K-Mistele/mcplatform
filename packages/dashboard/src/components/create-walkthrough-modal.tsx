'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { createWalkthroughAction } from '@/lib/orpc/actions'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

const createWalkthroughSchema = z.object({
    title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
    description: z.string().max(500, 'Description must be 500 characters or less').optional(),
    type: z.enum(['course', 'installer', 'troubleshooting', 'integration', 'quickstart']),
    isPublished: z.boolean().default(false)
})

type CreateWalkthroughInput = z.infer<typeof createWalkthroughSchema>

const walkthroughTypes = [
    {
        value: 'course',
        label: 'Course',
        icon: '📚',
        description: 'Educational content with multiple lessons and exercises'
    },
    {
        value: 'installer',
        label: 'Installer',
        icon: '⚙️',
        description: 'Step-by-step installation and setup guides'
    },
    {
        value: 'troubleshooting',
        label: 'Troubleshooting',
        icon: '🔧',
        description: 'Problem-solving guides for common issues'
    },
    {
        value: 'integration',
        label: 'Integration',
        icon: '🔗',
        description: 'Connect and integrate with external systems'
    },
    {
        value: 'quickstart',
        label: 'Quickstart',
        icon: '⚡',
        description: 'Get started quickly with basic functionality'
    }
] as const

interface CreateWalkthroughModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function CreateWalkthroughModal({ open, onOpenChange }: CreateWalkthroughModalProps) {
    const router = useRouter()
    const [selectedType, setSelectedType] = useState<string>('')

    const form = useForm<CreateWalkthroughInput>({
        resolver: zodResolver(createWalkthroughSchema),
        defaultValues: {
            title: '',
            description: '',
            type: 'course',
            isPublished: false
        }
    })

    const { execute, status } = useServerAction(createWalkthroughAction, {
        interceptors: [
            onSuccess((result) => {
                toast.success('Walkthrough created successfully')
                form.reset()
                onOpenChange(false)
                router.push(`/dashboard/walkthroughs/${result.id}/edit`)
            }),
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to create walkthrough')
                }
            })
        ]
    })

    const onSubmit = (data: CreateWalkthroughInput) => {
        execute(data)
    }

    const selectedTypeConfig = walkthroughTypes.find(t => t.value === form.watch('type'))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Create New Walkthrough</DialogTitle>
                    <DialogDescription>
                        Create an interactive walkthrough to guide your users through your product or service.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Title</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Enter a descriptive title for your walkthrough"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        A clear, descriptive title that explains what users will learn.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Provide additional context about this walkthrough"
                                            rows={3}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Optional description to provide more context about the walkthrough content.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Walkthrough Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a walkthrough type" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {walkthroughTypes.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{type.icon}</span>
                                                        <span>{type.label}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedTypeConfig && (
                                        <FormDescription>
                                            {selectedTypeConfig.description}
                                        </FormDescription>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="isPublished"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">Publish Immediately</FormLabel>
                                        <FormDescription>
                                            Make this walkthrough available to users right away. You can change this later.
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={status === 'executing'}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={status === 'executing'}
                            >
                                {status === 'executing' ? 'Creating...' : 'Create Walkthrough'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}