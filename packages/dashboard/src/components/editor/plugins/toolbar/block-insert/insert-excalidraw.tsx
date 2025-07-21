"use client"

import { FrameIcon } from "lucide-react"

import { useToolbarContext } from "@/components/editor/context/toolbar-context"
import { INSERT_EXCALIDRAW_COMMAND } from "@/components/editor/plugins/excalidraw-plugin"
import { SelectItem } from "@/components/ui/select"

export function InsertExcalidraw() {
  const { activeEditor } = useToolbarContext()
  return (
    <SelectItem
      value="excalidraw"
      onPointerUp={() =>
        activeEditor.dispatchCommand(INSERT_EXCALIDRAW_COMMAND, undefined)
      }
      className=""
    >
      <div className="flex items-center gap-1">
        <FrameIcon className="size-4" />
        <span>Excalidraw</span>
      </div>
    </SelectItem>
  )
}
