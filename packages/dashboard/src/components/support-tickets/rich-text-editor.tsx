'use client'

import { cn } from '@/lib/utils'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import {
    $convertFromMarkdownString,
    $convertToMarkdownString,
    CHECK_LIST,
    ELEMENT_TRANSFORMERS,
    MULTILINE_ELEMENT_TRANSFORMERS,
    TEXT_FORMAT_TRANSFORMERS,
    TEXT_MATCH_TRANSFORMERS
} from '@lexical/markdown'
import { OverflowNode } from '@lexical/overflow'
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin'
import { type InitialConfigType, LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { type EditorState, ParagraphNode, TextNode } from 'lexical'
import { useState } from 'react'

interface RichTextEditorProps {
    placeholder?: string
    onChange?: (content: string) => void
    value?: string
    initialValue?: string
    readOnly?: boolean
    className?: string
    minHeight?: number
}

const editorTheme = {
    paragraph: 'text-sm leading-6',
    heading: {
        h1: 'text-2xl font-bold mb-3',
        h2: 'text-xl font-bold mb-2',
        h3: 'text-lg font-semibold mb-2'
    },
    list: {
        listitem: 'ml-4',
        ol: 'list-decimal ml-4',
        ul: 'list-disc ml-4'
    },
    text: {
        bold: 'font-semibold',
        italic: 'italic',
        code: 'bg-muted px-1 py-0.5 rounded text-sm font-mono'
    },
    code: 'bg-muted p-3 rounded-md block font-mono text-sm',
    quote: 'border-l-4 border-muted-foreground/30 pl-4 my-2 text-muted-foreground'
}

const editorConfig: InitialConfigType = {
    namespace: 'SupportTicketEditor',
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
    onError: (error: Error) => {
        console.error('Lexical error:', error)
    }
}

export function RichTextEditor({
    placeholder = 'Start typing...',
    onChange,
    value,
    initialValue = '',
    readOnly = false,
    className = '',
    minHeight = 120
}: RichTextEditorProps) {
    const [floatingAnchorElem, setFloatingAnchorElem] = useState<HTMLDivElement | null>(null)

    const onRef = (_floatingAnchorElem: HTMLDivElement) => {
        if (_floatingAnchorElem !== null) {
            setFloatingAnchorElem(_floatingAnchorElem)
        }
    }

    const handleEditorChange = (editorState: EditorState) => {
        if (onChange) {
            editorState.read(() => {
                const markdown = $convertToMarkdownString([
                    CHECK_LIST,
                    ...ELEMENT_TRANSFORMERS,
                    ...MULTILINE_ELEMENT_TRANSFORMERS,
                    ...TEXT_FORMAT_TRANSFORMERS,
                    ...TEXT_MATCH_TRANSFORMERS
                ])
                onChange(markdown)
            })
        }
    }

    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-md border border-input bg-background text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
                className
            )}
        >
            <LexicalComposer
                initialConfig={{
                    ...editorConfig,
                    editable: !readOnly,
                    editorState:
                        value || initialValue
                            ? () =>
                                  $convertFromMarkdownString(value || initialValue, [
                                      CHECK_LIST,
                                      ...ELEMENT_TRANSFORMERS,
                                      ...MULTILINE_ELEMENT_TRANSFORMERS,
                                      ...TEXT_FORMAT_TRANSFORMERS,
                                      ...TEXT_MATCH_TRANSFORMERS
                                  ])
                            : undefined
                }}
            >
                <div className="relative">
                    <RichTextPlugin
                        contentEditable={
                            <div ref={onRef}>
                                <ContentEditable
                                    className={cn(
                                        'px-3 py-2 text-sm focus:outline-none resize-none',
                                        readOnly && 'cursor-default'
                                    )}
                                    //placeholder={placeholder}
                                    style={{ minHeight: `${minHeight}px` }}
                                />
                            </div>
                        }
                        ErrorBoundary={LexicalErrorBoundary}
                        placeholder={
                            <div className="pointer-events-none absolute top-2 left-3 text-sm text-muted-foreground">
                                {placeholder}
                            </div>
                        }
                    />

                    {!readOnly && (
                        <>
                            <OnChangePlugin onChange={handleEditorChange} />
                            <HorizontalRulePlugin />
                            <CheckListPlugin />
                            <ListPlugin />
                            <MarkdownShortcutPlugin
                                transformers={[
                                    CHECK_LIST,
                                    ...ELEMENT_TRANSFORMERS,
                                    ...MULTILINE_ELEMENT_TRANSFORMERS,
                                    ...TEXT_FORMAT_TRANSFORMERS,
                                    ...TEXT_MATCH_TRANSFORMERS
                                ]}
                            />
                        </>
                    )}
                </div>
            </LexicalComposer>
        </div>
    )
}
