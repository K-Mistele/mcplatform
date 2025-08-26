import { redirect } from 'next/navigation'

export default async function TeamPage() {
    redirect('/dashboard/team/members')
}