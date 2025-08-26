'use client'

import { cn } from '@/lib/utils'
import { IconUsers, IconMail } from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
    {
        name: 'Members',
        href: '/dashboard/team/members',
        icon: IconUsers,
        description: 'Active team members'
    },
    {
        name: 'Invitations',
        href: '/dashboard/team/invitations',
        icon: IconMail,
        description: 'Pending invitations'
    }
]

export function TeamTabs() {
    const pathname = usePathname()

    return (
        <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8 px-4 lg:px-6" aria-label="Tabs">
                {tabs.map((tab) => {
                    const isActive = pathname === tab.href
                    const Icon = tab.icon
                    
                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={cn(
                                'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors',
                                isActive
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
                            )}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <Icon
                                className={cn(
                                    'mr-2 h-5 w-5',
                                    isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground group-hover:text-foreground'
                                )}
                                aria-hidden="true"
                            />
                            {tab.name}
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}