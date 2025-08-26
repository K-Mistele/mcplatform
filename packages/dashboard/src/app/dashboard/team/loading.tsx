export default function TeamLoading() {
    return (
        <div className="px-4 lg:px-6">
            <div className="animate-pulse">
                <div className="h-8 bg-muted rounded mb-4 w-48"></div>
                <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-4 bg-muted rounded w-5/6"></div>
                    <div className="h-4 bg-muted rounded w-4/6"></div>
                </div>
            </div>
        </div>
    )
}