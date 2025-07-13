import { Card, CardFooter, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CardSkeleton() {
    return (
        <Card className="@container/card">
            <CardHeader>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-6 w-20" />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
            </CardFooter>
        </Card>
    )
}
