'use client'

import { authClient } from '@/lib/auth.client'
import {
    IconDashboard,
    IconDatabase,
    IconFileWord,
    IconHelp,
    IconReport,
    IconSearch,
    IconServer2,
    IconSettings
} from '@tabler/icons-react'
import type * as React from 'react'

import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem
} from '@/components/ui/sidebar'

const data = {
    navMain: [
        {
            title: 'Dashboard',
            url: '/dashboard',
            icon: IconDashboard
        },
        {
            title: 'MCP Servers',
            url: '/dashboard/mcp-servers',
            icon: IconServer2
        }
        // {
        //     title: 'Analytics',
        //     url: '#',
        //     icon: IconChartBar
        // },
        // {
        //     title: 'Projects',
        //     url: '#',
        //     icon: IconFolder
        // },
        // {
        //     title: 'Team',
        //     url: '#',
        //     icon: IconUsers
        // }
    ],
    // navClouds: [
    //     {
    //         title: 'Capture',
    //         icon: IconCamera,
    //         isActive: true,
    //         url: '#',
    //         items: [
    //             {
    //                 title: 'Active Proposals',
    //                 url: '#'
    //             },
    //             {
    //                 title: 'Archived',
    //                 url: '#'
    //             }
    //         ]
    //     },
    //     {
    //         title: 'Proposal',
    //         icon: IconFileDescription,
    //         url: '#',
    //         items: [
    //             {
    //                 title: 'Active Proposals',
    //                 url: '#'
    //             },
    //             {
    //                 title: 'Archived',
    //                 url: '#'
    //             }
    //         ]
    //     },
    //     {
    //         title: 'Prompts',
    //         icon: IconFileAi,
    //         url: '#',
    //         items: [
    //             {
    //                 title: 'Active Proposals',
    //                 url: '#'
    //             },
    //             {
    //                 title: 'Archived',
    //                 url: '#'
    //             }
    //         ]
    //     }
    // ],
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
                            <a href="/dashboard/organization/select">
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
