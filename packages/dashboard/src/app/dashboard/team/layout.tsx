import { TeamTabs } from '@/components/team-tabs'
import type { ReactNode } from 'react'

export default function TeamLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-bold">Team</h1>
                    <p className="text-muted-foreground">
                        Manage your organization members and invitations
                    </p>
                </div>
            </div>
            <TeamTabs />
            {children}
        </div>
    )
}