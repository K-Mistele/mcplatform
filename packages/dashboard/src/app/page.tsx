'use client'

import { redirectExample } from '@/lib/actions'
import { isDefinedError, onError, onSuccess } from '@orpc/client'
import { useServerAction } from '@orpc/react/hooks'
import { useState } from 'react'
import { toast } from 'sonner'

export default function MyComponent() {
    const [name, setName] = useState('')
    const { execute, data, error, status } = useServerAction(redirectExample, {
        interceptors: [
            onError((error) => {
                if (isDefinedError(error)) {
                    toast.error(error.message)
                    console.log(error)
                } else {
                    console.error(`unknown error:   `, error)
                }
            }),
            onSuccess((data) => {
                toast.success('Success')
            })
        ]
    })

    const action = async (form: FormData) => {
        const name = form.get('name') as string
        const result = await execute({ name })
        console.log(result)
    }

    return (
        <form action={action}>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <button type="submit" disabled={status === 'pending'}>
                Submit
            </button>
        </form>
    )
}
