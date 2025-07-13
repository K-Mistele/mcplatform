'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { setMcpInformationMessage } from '@/lib/orpc/actions'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { EditIcon, SaveIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

const editInformationMessageSchema = z.object({
    informationMessage: z.string()
})

type EditInformationMessageInput = z.infer<typeof editInformationMessageSchema>

interface EditInformationMessageProps {
    serverId: string
    currentMessage: string | null
}

export function EditInformationMessage({ serverId, currentMessage }: EditInformationMessageProps) {
    const [isEditing, setIsEditing] = useState(false)

    const form = useForm<EditInformationMessageInput>({
        resolver: zodResolver(editInformationMessageSchema),
        defaultValues: {
            informationMessage: currentMessage || ''
        }
    })

    const { execute, status } = useServerAction(setMcpInformationMessage, {
        interceptors: [
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                } else {
                    toast.error('Failed to update information message')
                }
            }),
            onSuccess(async () => {
                toast.success('Information message updated successfully')
                setIsEditing(false)
            })
        ]
    })

    const handleSubmit = (data: EditInformationMessageInput) => {
        execute({
            serverId,
            informationMessage: data.informationMessage
        })
    }

    const handleCancel = () => {
        form.reset({ informationMessage: currentMessage || '' })
        setIsEditing(false)
    }

    return (
        <Card className="">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Information Message</CardTitle>
                        <CardDescription>
                            This server will display this message to users when they access it.
                        </CardDescription>
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
                                name="informationMessage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Information Message</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Enter an information message for users..."
                                                className="min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            This message will be displayed to users when they access your MCP server.
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
                    <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-sm">{currentMessage || 'No information message set'}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
