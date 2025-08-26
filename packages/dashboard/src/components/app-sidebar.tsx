'use client'

import {
    IconDashboard,
    IconDatabase,
    IconFileWord,
    IconHelp,
    IconHelpCircle,
    IconReport,
    IconSearch,
    IconServer2,
    IconSettings,
    IconUsers,
    IconUsersGroup
} from '@tabler/icons-react'
import { BookOpenIcon } from 'lucide-react'
import type * as React from 'react'
import { authClient } from '../lib/auth/auth.client'
import { NavMain } from './nav-main'
import { NavSecondary } from './nav-secondary'
import { NavUser } from './nav-user'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from './ui/sidebar'

export const data = {
    navMain: [
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: IconDashboard,
            description: "Overview of your organization's activity and insights"
        },
        {
            title: 'MCP Servers',
            url: '/dashboard/mcp-servers',
            icon: IconServer2,
            description: 'Create and manage MCP servers for your different products, applications and solutions.'
        },
        {
            title: 'Walkthroughs',
            url: '/dashboard/walkthroughs',
            icon: BookOpenIcon,
            description: 'Create and manage interactive walkthroughs for your users'
        },
        {
            title: 'Users',
            url: '/dashboard/users',
            icon: IconUsers,
            description: 'View users and their connected MCP servers'
        },
        {
            title: 'Support Tickets',
            url: '/dashboard/support-tickets',
            icon: IconHelpCircle,
            description: 'View and manage support tickets submitted through your MCP servers'
        },
        {
            title: 'Team',
            url: '/dashboard/team',
            icon: IconUsersGroup,
            description: 'Manage your organization members and invitations'
        }
    ],

    navSecondary: [
        {
            title: 'Settings',
            url: '#',
            icon: IconSettings
        },
        {
            title: 'Get Help',
            url: '#',
            icon: IconHelp
        },
        {
            title: 'Search',
            url: '#',
            icon: IconSearch
        }
    ],
    documents: [
        {
            name: 'Data Library',
            url: '#',
            icon: IconDatabase
        },
        {
            name: 'Reports',
            url: '#',
            icon: IconReport
        },
        {
            name: 'Word Assistant',
            url: '#',
            icon: IconFileWord
        }
    ]
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { data: organization, error, isPending } = authClient.useActiveOrganization()
    const { data: session, error: userError, isPending: userIsPending } = authClient.useSession()

    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-1.5">
                            <a href="/organization/select">
                                {organization?.logo && (
                                    <img src={organization?.logo} className="size-8 rounded-full" alt="" />
                                )}
                                <span className="text-base font-semibold">{organization?.name}</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <NavMain items={data.navMain} />
                {/* <NavDocuments items={data.documents} /> */}
                <NavSecondary items={data.navSecondary} className="mt-auto" />
            </SidebarContent>
            <SidebarFooter>
                <NavUser
                    user={{
                        name: session?.user?.name ?? '',
                        email: session?.user?.email ?? '',
                        avatar: session?.user?.image ?? null
                    }}
                />
            </SidebarFooter>
        </Sidebar>
    )
}
