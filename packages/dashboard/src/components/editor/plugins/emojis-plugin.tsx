'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import type { LexicalEditor } from 'lexical'
import { TextNode } from 'lexical'
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { type JSX, useEffect } from 'react'

import { $createEmojiNode, EmojiNode } from '@/components/editor/nodes/emoji-node'

const emojis: Map<string, [string, string]> = new Map([
    [':)', ['emoji happysmile', '🙂']],
    [':D', ['emoji veryhappysmile', '😀']],
    [':(', ['emoji unhappysmile', '🙁']],
    ['<3', ['emoji heart', '❤']]
])

function $findAndTransformEmoji(node: TextNode): null | TextNode {
    const text = node.getTextContent()

    for (let i = 0; i < text.length; i++) {
        const emojiData = emojis.get(text[i]) || emojis.get(text.slice(i, i + 2))

        if (emojiData !== undefined) {
            const [emojiStyle, emojiText] = emojiData
            let targetNode: any

            if (i === 0) {
                ;[targetNode] = node.splitText(i + 2)
            } else {
                ;[, targetNode] = node.splitText(i, i + 2)
            }

            const emojiNode = $createEmojiNode(emojiStyle, emojiText)
            targetNode.replace(emojiNode)
            return emojiNode
        }
    }

    return null
}

function $textNodeTransform(node: TextNode): void {
    let targetNode: TextNode | null = node

    while (targetNode !== null) {
        if (!targetNode.isSimpleText()) {
            return
        }

        targetNode = $findAndTransformEmoji(targetNode)
    }
}

function useEmojis(editor: LexicalEditor): void {
    useEffect(() => {
        if (!editor.hasNodes([EmojiNode])) {
            throw new Error('EmojisPlugin: EmojiNode not registered on editor')
        }

        return editor.registerNodeTransform(TextNode, $textNodeTransform)
    }, [editor])
}

export function EmojisPlugin(): JSX.Element | null {
    const [editor] = useLexicalComposerContext()
    useEmojis(editor)
    return null
}
