"use client"

import { BOARD_COLUMNS } from "@/lib/board/pipeline"
import type { PipelineBoardState } from "@/lib/board/use-pipeline-board"
import { cn } from "@cortex/utils"
import { KanbanColumn } from "./kanban-column"

interface BoardColumnsProps {
  board: PipelineBoardState
  compact?: boolean
  className?: string
}

export function BoardColumns({ board, compact = false, className }: BoardColumnsProps) {
  return (
    <div
      className={cn(
        "-mx-2 flex min-h-0 flex-1 gap-3 overflow-x-auto overflow-y-hidden px-2 pb-4",
        compact && "max-h-[520px]",
        className,
      )}
    >
      {BOARD_COLUMNS.map((meta) => (
        <KanbanColumn key={meta.id} meta={meta} cards={board.columns[meta.id]} />
      ))}
    </div>
  )
}
