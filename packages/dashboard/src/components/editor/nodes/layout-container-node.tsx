import { addClassNamesToElement } from "@lexical/utils"
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedElementNode,
  Spread,
} from "lexical"
import { ElementNode } from "lexical"

export type SerializedLayoutContainerNode = Spread<
  {
    templateColumns: string
  },
  SerializedElementNode
>

function $convertLayoutContainerElement(
  domNode: HTMLElement
): DOMConversionOutput | null {
  const styleAttributes = window.getComputedStyle(domNode)
  const templateColumns = styleAttributes.getPropertyValue(
    "grid-template-columns"
  )
  if (templateColumns) {
    const node = $createLayoutContainerNode(templateColumns)
    return { node }
  }
  return null
}

export class LayoutContainerNode extends ElementNode {
  __templateColumns: string

  constructor(templateColumns: string, key?: NodeKey) {
    super(key)
    this.__templateColumns = templateColumns
  }

  static getType(): string {
    return "layout-container"
  }

  static clone(node: LayoutContainerNode): LayoutContainerNode {
    return new LayoutContainerNode(node.__templateColumns, node.__key)
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = document.createElement("div")
    dom.style.gridTemplateColumns = this.__templateColumns
    if (typeof config.theme.layoutContainer === "string") {
      addClassNamesToElement(dom, config.theme.layoutContainer)
    }
    return dom
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("div")
    element.style.gridTemplateColumns = this.__templateColumns
    element.setAttribute("data-lexical-layout-container", "true")
    return { element }
  }

  updateDOM(prevNode: LayoutContainerNode, dom: HTMLElement): boolean {
    if (prevNode.__templateColumns !== this.__templateColumns) {
      dom.style.gridTemplateColumns = this.__templateColumns
    }
    return false
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute("data-lexical-layout-container")) {
          return null
        }
        return {
          conversion: $convertLayoutContainerElement,
          priority: 2,
        }
      },
    }
  }

  static importJSON(json: SerializedLayoutContainerNode): LayoutContainerNode {
    return $createLayoutContainerNode(json.templateColumns)
  }

  isShadowRoot(): boolean {
    return true
  }

  canBeEmpty(): boolean {
    return false
  }

  exportJSON(): SerializedLayoutContainerNode {
    return {
      ...super.exportJSON(),
      templateColumns: this.__templateColumns,
      type: "layout-container",
      version: 1,
    }
  }

  getTemplateColumns(): string {
    return this.getLatest().__templateColumns
  }

  setTemplateColumns(templateColumns: string) {
    this.getWritable().__templateColumns = templateColumns
  }
}

export function $createLayoutContainerNode(
  templateColumns: string
): LayoutContainerNode {
  return new LayoutContainerNode(templateColumns)
}

export function $isLayoutContainerNode(
  node: LexicalNode | null | undefined
): node is LayoutContainerNode {
  return node instanceof LayoutContainerNode
}
