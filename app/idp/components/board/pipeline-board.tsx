"use client"

import { usePipelineBoard } from "@/lib/board/use-pipeline-board"
import { cn } from "@cortex/utils"
import { BoardColumns } from "./board-columns"
import { BoardFilters } from "./board-filters"

interface PipelineBoardProps {
  compact?: boolean
  className?: string
}

export function PipelineBoard({ compact = false, className }: PipelineBoardProps) {
  const board = usePipelineBoard()
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <BoardFilters board={board} />
      <BoardColumns board={board} compact={compact} />
    </div>
  )
}
