export function UsersLoading() {
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <div className="px-4 lg:px-6">
                <div className="h-[400px] flex items-center justify-center">
                    <div className="text-muted-foreground">Loading users...</div>
                </div>
            </div>
        </div>
    )
}
