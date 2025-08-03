'use client'

import { RedirectType, redirect } from 'next/navigation'

export default function MyComponent() {
    return redirect('/dashboard', RedirectType.replace)
}
