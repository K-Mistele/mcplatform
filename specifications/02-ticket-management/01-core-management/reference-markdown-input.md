---
date: 2025-07-22T15:03:35-05:00
researcher: Kyle Mistele
git_commit: 7c31f4d2919859faae85690b10736e1ca77046ee
branch: master
repository: mcplatform
topic: "Reference Markdown Input for shadcn Editor"
tags: [reference, markdown, shadcn, editor, ui-component]
status: complete
last_updated: 2025-07-22
last_updated_by: Kyle Mistele
type: reference
---

# Reference Markdown Input for shadcn Editor

Here is an example of the shadcn Editor with markdown support: 

```tsx
"use client"

import { useState } from "react"
import { CodeHighlightNode, CodeNode } from "@lexical/code"
import { AutoLinkNode, LinkNode } from "@lexical/link"
import { ListItemNode, ListNode } from "@lexical/list"
import {
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
} from "@lexical/markdown"
import { OverflowNode } from "@lexical/overflow"
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin"
import {
  InitialConfigType,
  LexicalComposer,
} from "@lexical/react/LexicalComposer"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode"
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { TablePlugin } from "@lexical/react/LexicalTablePlugin"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table"
import { ParagraphNode, TextNode } from "lexical"

import { ContentEditable } from "@/registry/new-york-v4/editor/editor-ui/content-editable"
import { TweetNode } from "@/registry/new-york-v4/editor/nodes/embeds/tweet-node"
import { EmojiNode } from "@/registry/new-york-v4/editor/nodes/emoji-node"
import { EquationNode } from "@/registry/new-york-v4/editor/nodes/equation-node"
import { ImageNode } from "@/registry/new-york-v4/editor/nodes/image-node"
import { TwitterPlugin } from "@/registry/new-york-v4/editor/plugins/embeds/twitter-plugin"
import { EmojisPlugin } from "@/registry/new-york-v4/editor/plugins/emojis-plugin"
import { EquationsPlugin } from "@/registry/new-york-v4/editor/plugins/equations-plugin"
import { ImagesPlugin } from "@/registry/new-york-v4/editor/plugins/images-plugin"
import { TableActionMenuPlugin } from "@/registry/new-york-v4/editor/plugins/table-action-menu-plugin"
import { TableCellResizerPlugin } from "@/registry/new-york-v4/editor/plugins/table-cell-resizer-plugin"
import { TableHoverActionsPlugin } from "@/registry/new-york-v4/editor/plugins/table-hover-actions-plugin"
import { editorTheme } from "@/registry/new-york-v4/editor/themes/editor-theme"
import { EMOJI } from "@/registry/new-york-v4/editor/transformers/markdown-emoji-transformer"
import { EQUATION } from "@/registry/new-york-v4/editor/transformers/markdown-equation-transformer"
import { HR } from "@/registry/new-york-v4/editor/transformers/markdown-hr-transformer"
import { IMAGE } from "@/registry/new-york-v4/editor/transformers/markdown-image-transformer"
import { TABLE } from "@/registry/new-york-v4/editor/transformers/markdown-table-transformer"
import { TWEET } from "@/registry/new-york-v4/editor/transformers/markdown-tweet-transformer"
import { TooltipProvider } from "@/components/ui/tooltip"

const editorConfig: InitialConfigType = {
  namespace: "Editor",
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
    TableNode,
    TableCellNode,
    TableRowNode,
    CodeNode,
    CodeHighlightNode,
    HorizontalRuleNode,
    ImageNode,
    EmojiNode,
    EquationNode,
    AutoLinkNode,
    TweetNode,
  ],
  onError: (error: Error) => {
    console.error(error)
  },
}

export function RichTextEditorDemo() {
  return (
    <div className="bg-background w-full overflow-hidden rounded-lg border">
      <LexicalComposer
        initialConfig={{
          ...editorConfig,
        }}
      >
        <TooltipProvider>
          <Plugins />
        </TooltipProvider>
      </LexicalComposer>
    </div>
  )
}

const placeholder = "Start typing..."

export function Plugins() {
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null)

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem)
    }
  }

  return (
    <div className="relative">
      {/* toolbar plugins */}

      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <div className="">
              <div className="" ref={onRef}>
                <ContentEditable
                  placeholder={placeholder}
                  className="ContentEditable__root relative block h-72 min-h-72 min-h-full overflow-auto px-8 py-4 focus:outline-none"
                />
              </div>
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <TablePlugin />
        <TableCellResizerPlugin />
        <TableHoverActionsPlugin anchorElem={floatingAnchorElem} />
        <TableActionMenuPlugin
          anchorElem={floatingAnchorElem}
          cellMerge={true}
        />

        <HorizontalRulePlugin />
        <ImagesPlugin />
        <EmojisPlugin />
        <EquationsPlugin />
        <TwitterPlugin />
        <CheckListPlugin />
        <ListPlugin />

        <MarkdownShortcutPlugin
          transformers={[
            TABLE,
            HR,
            IMAGE,
            EMOJI,
            EQUATION,
            TWEET,
            CHECK_LIST,
            ...ELEMENT_TRANSFORMERS,
            ...MULTILINE_ELEMENT_TRANSFORMERS,
            ...TEXT_FORMAT_TRANSFORMERS,
            ...TEXT_MATCH_TRANSFORMERS,
          ]}
        />
        {/* rest of the plugins */}
      </div>
    </div>
  )
}

```