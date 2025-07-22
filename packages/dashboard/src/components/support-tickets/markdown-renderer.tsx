'use client'

import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import {
    CHECK_LIST,
    ELEMENT_TRANSFORMERS,
    MULTILINE_ELEMENT_TRANSFORMERS,
    TEXT_FORMAT_TRANSFORMERS,
    TEXT_MATCH_TRANSFORMERS
} from '@lexical/markdown'
import { OverflowNode } from '@lexical/overflow'
import { InitialConfigType, LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ParagraphNode, TextNode } from 'lexical'
import { $convertFromMarkdownString } from '@lexical/markdown'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
    content: string
    className?: string
}

const editorTheme = {
    paragraph: 'text-sm leading-6 mb-2',
    heading: {
        h1: 'text-xl font-bold mb-3 mt-4 first:mt-0',
        h2: 'text-lg font-bold mb-2 mt-3 first:mt-0',
        h3: 'text-base font-semibold mb-2 mt-3 first:mt-0'
    },
    list: {
        listitem: 'ml-4 mb-1',
        ol: 'list-decimal ml-4 mb-3',
        ul: 'list-disc ml-4 mb-3'
    },
    text: {
        bold: 'font-semibold',
        italic: 'italic',
        code: 'bg-muted px-1 py-0.5 rounded text-sm font-mono'
    },
    code: 'bg-muted p-3 rounded-md block font-mono text-sm mb-3 overflow-x-auto',
    quote: 'border-l-4 border-muted-foreground/30 pl-4 my-3 text-muted-foreground italic'
}

const editorConfig: InitialConfigType = {
    namespace: 'MarkdownRenderer',
    theme: editorTheme,
    nodes: [
        HeadingNode,
        ParagraphNode,
        TextNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        LinkNode,
        OverflowNode,
        CodeNode,
        CodeHighlightNode,
        HorizontalRuleNode,
        AutoLinkNode
    ],
    editable: false,
    onError: (error: Error) => {
        console.error('Lexical markdown renderer error:', error)
    }
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    if (!content || typeof content !== 'string') {
        return <div className={className}>{String(content || '')}</div>
    }

    return (
        <div className={cn('prose prose-sm max-w-none', className)}>
            <LexicalComposer
                initialConfig={{
                    ...editorConfig,
                    editorState: () => $convertFromMarkdownString(content, [
                        CHECK_LIST,
                        ...ELEMENT_TRANSFORMERS,
                        ...MULTILINE_ELEMENT_TRANSFORMERS,
                        ...TEXT_FORMAT_TRANSFORMERS,
                        ...TEXT_MATCH_TRANSFORMERS
                    ])
                }}
            >
                <RichTextPlugin
                    contentEditable={
                        <ContentEditable
                            className="focus:outline-none"
                            style={{ userSelect: 'text', cursor: 'text' }}
                        />
                    }
                    ErrorBoundary={LexicalErrorBoundary}
                    placeholder={null}
                />
            </LexicalComposer>
        </div>
    )
}