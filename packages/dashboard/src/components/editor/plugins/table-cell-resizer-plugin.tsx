'use client'

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { useLexicalEditable } from '@lexical/react/useLexicalEditable'
import type { TableCellNode, TableDOMCell, TableMapType } from '@lexical/table'
import {
    $computeTableMapSkipCellCheck,
    $getTableNodeFromLexicalNodeOrThrow,
    $getTableRowIndexFromTableCellNode,
    $isTableCellNode,
    $isTableRowNode,
    TableNode,
    getDOMCellFromTarget
} from '@lexical/table'
import { calculateZoomLevel } from '@lexical/utils'
import type { LexicalEditor } from 'lexical'
import { $getNearestNodeFromDOMNode } from 'lexical'
/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import type * as React from 'react'
import { type JSX, type MouseEventHandler, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type MousePosition = {
    x: number
    y: number
}

type MouseDraggingDirection = 'right' | 'bottom'

const MIN_ROW_HEIGHT = 33
const MIN_COLUMN_WIDTH = 92

function TableCellResizer({ editor }: { editor: LexicalEditor }): JSX.Element {
    const targetRef = useRef<HTMLElement | null>(null)
    const resizerRef = useRef<HTMLDivElement | null>(null)
    const tableRectRef = useRef<ClientRect | null>(null)

    const mouseStartPosRef = useRef<MousePosition | null>(null)
    const [mouseCurrentPos, updateMouseCurrentPos] = useState<MousePosition | null>(null)

    const [activeCell, updateActiveCell] = useState<TableDOMCell | null>(null)
    const [isMouseDown, updateIsMouseDown] = useState<boolean>(false)
    const [draggingDirection, updateDraggingDirection] = useState<MouseDraggingDirection | null>(null)

    const resetState = useCallback(() => {
        updateActiveCell(null)
        targetRef.current = null
        updateDraggingDirection(null)
        mouseStartPosRef.current = null
        tableRectRef.current = null
    }, [])

    const isMouseDownOnEvent = (event: MouseEvent) => {
        return (event.buttons & 1) === 1
    }

    useEffect(() => {
        return editor.registerNodeTransform(TableNode, (tableNode) => {
            if (tableNode.getColWidths()) {
                return tableNode
            }

            const numColumns = tableNode.getColumnCount()
            const columnWidth = MIN_COLUMN_WIDTH

            tableNode.setColWidths(Array(numColumns).fill(columnWidth))
            return tableNode
        })
    }, [editor])

    useEffect(() => {
        const onMouseMove = (event: MouseEvent) => {
            setTimeout(() => {
                const target = event.target

                if (draggingDirection) {
                    updateMouseCurrentPos({
                        x: event.clientX,
                        y: event.clientY
                    })
                    return
                }
                updateIsMouseDown(isMouseDownOnEvent(event))
                if (resizerRef.current?.contains(target as Node)) {
                    return
                }

                if (targetRef.current !== target) {
                    targetRef.current = target as HTMLElement
                    const cell = getDOMCellFromTarget(target as HTMLElement)

                    if (cell && activeCell !== cell) {
                        editor.update(() => {
                            const tableCellNode = $getNearestNodeFromDOMNode(cell.elem)
                            if (!tableCellNode) {
                                throw new Error('TableCellResizer: Table cell node not found.')
                            }

                            const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
                            const tableElement = editor.getElementByKey(tableNode.getKey())

                            if (!tableElement) {
                                throw new Error('TableCellResizer: Table element not found.')
                            }

                            targetRef.current = target as HTMLElement
                            tableRectRef.current = tableElement.getBoundingClientRect()
                            updateActiveCell(cell)
                        })
                    } else if (cell == null) {
                        resetState()
                    }
                }
            }, 0)
        }

        const onMouseDown = (event: MouseEvent) => {
            setTimeout(() => {
                updateIsMouseDown(true)
            }, 0)
        }

        const onMouseUp = (event: MouseEvent) => {
            setTimeout(() => {
                updateIsMouseDown(false)
            }, 0)
        }

        const removeRootListener = editor.registerRootListener((rootElement, prevRootElement) => {
            prevRootElement?.removeEventListener('mousemove', onMouseMove)
            prevRootElement?.removeEventListener('mousedown', onMouseDown)
            prevRootElement?.removeEventListener('mouseup', onMouseUp)
            rootElement?.addEventListener('mousemove', onMouseMove)
            rootElement?.addEventListener('mousedown', onMouseDown)
            rootElement?.addEventListener('mouseup', onMouseUp)
        })

        return () => {
            removeRootListener()
        }
    }, [activeCell, draggingDirection, editor, resetState])

    const isHeightChanging = (direction: MouseDraggingDirection) => {
        if (direction === 'bottom') {
            return true
        }
        return false
    }

    const updateRowHeight = useCallback(
        (heightChange: number) => {
            if (!activeCell) {
                throw new Error('TableCellResizer: Expected active cell.')
            }

            editor.update(
                () => {
                    const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem)
                    if (!$isTableCellNode(tableCellNode)) {
                        throw new Error('TableCellResizer: Table cell node not found.')
                    }

                    const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)

                    const tableRowIndex =
                        $getTableRowIndexFromTableCellNode(tableCellNode) + tableCellNode.getRowSpan() - 1

                    const tableRows = tableNode.getChildren()

                    if (tableRowIndex >= tableRows.length || tableRowIndex < 0) {
                        throw new Error('Expected table cell to be inside of table row.')
                    }

                    const tableRow = tableRows[tableRowIndex]

                    if (!$isTableRowNode(tableRow)) {
                        throw new Error('Expected table row')
                    }

                    let height = tableRow.getHeight()
                    if (height === undefined) {
                        const rowCells = tableRow.getChildren<TableCellNode>()
                        height = Math.min(
                            ...rowCells.map((cell) => getCellNodeHeight(cell, editor) ?? Number.POSITIVE_INFINITY)
                        )
                    }

                    const newHeight = Math.max(height + heightChange, MIN_ROW_HEIGHT)
                    tableRow.setHeight(newHeight)
                },
                { tag: 'skip-scroll-into-view' }
            )
        },
        [activeCell, editor]
    )

    const getCellNodeHeight = (cell: TableCellNode, activeEditor: LexicalEditor): number | undefined => {
        const domCellNode = activeEditor.getElementByKey(cell.getKey())
        return domCellNode?.clientHeight
    }

    const getCellColumnIndex = (tableCellNode: TableCellNode, tableMap: TableMapType) => {
        for (let row = 0; row < tableMap.length; row++) {
            for (let column = 0; column < tableMap[row].length; column++) {
                if (tableMap[row][column].cell === tableCellNode) {
                    return column
                }
            }
        }
    }

    const updateColumnWidth = useCallback(
        (widthChange: number) => {
            if (!activeCell) {
                throw new Error('TableCellResizer: Expected active cell.')
            }
            editor.update(
                () => {
                    const tableCellNode = $getNearestNodeFromDOMNode(activeCell.elem)
                    if (!$isTableCellNode(tableCellNode)) {
                        throw new Error('TableCellResizer: Table cell node not found.')
                    }

                    const tableNode = $getTableNodeFromLexicalNodeOrThrow(tableCellNode)
                    const [tableMap] = $computeTableMapSkipCellCheck(tableNode, null, null)
                    const columnIndex = getCellColumnIndex(tableCellNode, tableMap)
                    if (columnIndex === undefined) {
                        throw new Error('TableCellResizer: Table column not found.')
                    }

                    const colWidths = tableNode.getColWidths()
                    if (!colWidths) {
                        return
                    }
                    const width = colWidths[columnIndex]
                    if (width === undefined) {
                        return
                    }
                    const newColWidths = [...colWidths]
                    const newWidth = Math.max(width + widthChange, MIN_COLUMN_WIDTH)
                    newColWidths[columnIndex] = newWidth
                    tableNode.setColWidths(newColWidths)
                },
                { tag: 'skip-scroll-into-view' }
            )
        },
        [activeCell, editor]
    )

    const mouseUpHandler = useCallback(
        (direction: MouseDraggingDirection) => {
            const handler = (event: MouseEvent) => {
                event.preventDefault()
                event.stopPropagation()

                if (!activeCell) {
                    throw new Error('TableCellResizer: Expected active cell.')
                }

                if (mouseStartPosRef.current) {
                    const { x, y } = mouseStartPosRef.current

                    if (activeCell === null) {
                        return
                    }
                    const zoom = calculateZoomLevel(event.target as Element)

                    if (isHeightChanging(direction)) {
                        const heightChange = (event.clientY - y) / zoom
                        updateRowHeight(heightChange)
                    } else {
                        const widthChange = (event.clientX - x) / zoom
                        updateColumnWidth(widthChange)
                    }

                    resetState()
                    document.removeEventListener('mouseup', handler)
                }
            }
            return handler
        },
        [activeCell, resetState, updateColumnWidth, updateRowHeight]
    )

    const toggleResize = useCallback(
        (direction: MouseDraggingDirection): MouseEventHandler<HTMLDivElement> =>
            (event) => {
                event.preventDefault()
                event.stopPropagation()

                if (!activeCell) {
                    throw new Error('TableCellResizer: Expected active cell.')
                }

                mouseStartPosRef.current = {
                    x: event.clientX,
                    y: event.clientY
                }
                updateMouseCurrentPos(mouseStartPosRef.current)
                updateDraggingDirection(direction)

                document.addEventListener('mouseup', mouseUpHandler(direction))
            },
        [activeCell, mouseUpHandler]
    )

    const getResizers = useCallback(() => {
        if (activeCell) {
            const { height, width, top, left } = activeCell.elem.getBoundingClientRect()
            const zoom = calculateZoomLevel(activeCell.elem)
            const zoneWidth = 10 // Pixel width of the zone where you can drag the edge
            const styles = {
                bottom: {
                    backgroundColor: 'none',
                    cursor: 'row-resize',
                    height: `${zoneWidth}px`,
                    left: `${window.pageXOffset + left}px`,
                    top: `${window.pageYOffset + top + height - zoneWidth / 2}px`,
                    width: `${width}px`
                },
                right: {
                    backgroundColor: 'none',
                    cursor: 'col-resize',
                    height: `${height}px`,
                    left: `${window.pageXOffset + left + width - zoneWidth / 2}px`,
                    top: `${window.pageYOffset + top}px`,
                    width: `${zoneWidth}px`
                }
            }

            const tableRect = tableRectRef.current

            if (draggingDirection && mouseCurrentPos && tableRect) {
                if (isHeightChanging(draggingDirection)) {
                    styles[draggingDirection].left = `${window.pageXOffset + tableRect.left}px`
                    styles[draggingDirection].top = `${window.pageYOffset + mouseCurrentPos.y / zoom}px`
                    styles[draggingDirection].height = '3px'
                    styles[draggingDirection].width = `${tableRect.width}px`
                } else {
                    styles[draggingDirection].top = `${window.pageYOffset + tableRect.top}px`
                    styles[draggingDirection].left = `${window.pageXOffset + mouseCurrentPos.x / zoom}px`
                    styles[draggingDirection].width = '3px'
                    styles[draggingDirection].height = `${tableRect.height}px`
                }

                styles[draggingDirection].backgroundColor = '#adf'
            }

            return styles
        }

        return {
            bottom: null,
            left: null,
            right: null,
            top: null
        }
    }, [activeCell, draggingDirection, mouseCurrentPos])

    const resizerStyles = getResizers()

    return (
        <div ref={resizerRef}>
            {activeCell != null && !isMouseDown && (
                <>
                    <div
                        className="TableCellResizer__ui absolute"
                        style={resizerStyles.right || undefined}
                        onMouseDown={toggleResize('right')}
                    />
                    <div
                        className="TableCellResizer__ui absolute"
                        style={resizerStyles.bottom || undefined}
                        onMouseDown={toggleResize('bottom')}
                    />
                </>
            )}
        </div>
    )
}

export function TableCellResizerPlugin(): null | React.ReactElement {
    const [editor] = useLexicalComposerContext()
    const isEditable = useLexicalEditable()
    const [bodyRef, setBodyRef] = useState<HTMLElement | null>(null)

    useEffect(() => {
        setBodyRef(document.body)
    }, [])

    return useMemo(
        () => (isEditable && bodyRef ? createPortal(<TableCellResizer editor={editor} />, bodyRef) : null),
        [editor, isEditable, bodyRef]
    )
}
