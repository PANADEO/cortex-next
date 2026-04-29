"use client"

import { cn } from "@cortex/utils"
import { usePipelineBoard } from "@/lib/board/use-pipeline-board"
import { BoardColumns } from "./board-columns"
import { BoardFilters } from "./board-filters"

interface PipelineBoardProps {
  compact?: boolean
  hideSearch?: boolean
  className?: string
}

export function PipelineBoard({ compact = false, hideSearch = false, className }: PipelineBoardProps) {
  const board = usePipelineBoard()
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <BoardFilters board={board} hideSearch={hideSearch} />
      <BoardColumns board={board} compact={compact} />
    </div>
  )
}
