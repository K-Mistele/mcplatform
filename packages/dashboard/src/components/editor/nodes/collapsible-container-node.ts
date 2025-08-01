import {
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type EditorConfig,
  ElementNode,
  isHTMLElement,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode,
  type Spread,
} from "lexical"

import { IS_CHROME } from "@/components/editor/shared/environment"
import { invariant } from "@/components/editor/shared/invariant"
import { setDomHiddenUntilFound } from "@/components/editor/utils/collapsible"

type SerializedCollapsibleContainerNode = Spread<
  {
    open: boolean
  },
  SerializedElementNode
>

export function $convertDetailsElement(
  domNode: HTMLDetailsElement
): DOMConversionOutput | null {
  const isOpen = domNode.open !== undefined ? domNode.open : true
  const node = $createCollapsibleContainerNode(isOpen)
  return {
    node,
  }
}

export class CollapsibleContainerNode extends ElementNode {
  __open: boolean

  constructor(open: boolean, key?: NodeKey) {
    super(key)
    this.__open = open
  }

  static getType(): string {
    return "collapsible-container"
  }

  static clone(node: CollapsibleContainerNode): CollapsibleContainerNode {
    return new CollapsibleContainerNode(node.__open, node.__key)
  }

  createDOM(config: EditorConfig, editor: LexicalEditor): HTMLElement {
    // details is not well supported in Chrome #5582
    let dom: HTMLElement
    if (IS_CHROME) {
      dom = document.createElement("div")
      dom.setAttribute("open", "")
    } else {
      const detailsDom = document.createElement("details")
      detailsDom.open = this.__open
      detailsDom.addEventListener("toggle", () => {
        const open = editor.getEditorState().read(() => this.getOpen())
        if (open !== detailsDom.open) {
          editor.update(() => this.toggleOpen())
        }
      })
      dom = detailsDom
    }
    dom.classList.add("Collapsible__container")

    return dom
  }

  updateDOM(
    prevNode: CollapsibleContainerNode,
    dom: HTMLDetailsElement
  ): boolean {
    const currentOpen = this.__open
    if (prevNode.__open !== currentOpen) {
      // details is not well supported in Chrome #5582
      if (IS_CHROME) {
        const contentDom = dom.children[1]
        invariant(
          isHTMLElement(contentDom),
          "Expected contentDom to be an HTMLElement"
        )
        if (currentOpen) {
          dom.setAttribute("open", "")
          contentDom.hidden = false
        } else {
          dom.removeAttribute("open")
          setDomHiddenUntilFound(contentDom)
        }
      } else {
        dom.open = this.__open
      }
    }

    return false
  }

  static importDOM(): DOMConversionMap<HTMLDetailsElement> | null {
    return {
      details: (domNode: HTMLDetailsElement) => {
        return {
          conversion: $convertDetailsElement,
          priority: 1,
        }
      },
    }
  }

  static importJSON(
    serializedNode: SerializedCollapsibleContainerNode
  ): CollapsibleContainerNode {
    const node = $createCollapsibleContainerNode(serializedNode.open)
    return node
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("details")
    element.classList.add("Collapsible__container")
    element.setAttribute("open", this.__open.toString())
    return { element }
  }

  exportJSON(): SerializedCollapsibleContainerNode {
    return {
      ...super.exportJSON(),
      open: this.__open,
      type: "collapsible-container",
      version: 1,
    }
  }

  setOpen(open: boolean): void {
    const writable = this.getWritable()
    writable.__open = open
  }

  getOpen(): boolean {
    return this.getLatest().__open
  }

  toggleOpen(): void {
    this.setOpen(!this.getOpen())
  }
}

export function $createCollapsibleContainerNode(
  isOpen: boolean
): CollapsibleContainerNode {
  return new CollapsibleContainerNode(isOpen)
}

export function $isCollapsibleContainerNode(
  node: LexicalNode | null | undefined
): node is CollapsibleContainerNode {
  return node instanceof CollapsibleContainerNode
}
