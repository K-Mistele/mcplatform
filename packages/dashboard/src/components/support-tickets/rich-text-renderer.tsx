interface RichTextRendererProps {
    content: string
    className?: string
}

export function RichTextRenderer({ content, className = '' }: RichTextRendererProps) {
    return (
        <div className={`w-full prose prose-sm max-w-none ${className}`}>
            <div className="whitespace-pre-wrap">{content}</div>
        </div>
    )
}