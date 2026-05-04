"use client"

import { PageHeader } from "@cortex/ui"
import { BoardColumns } from "@/components/board/board-columns"
import { BoardFilters } from "@/components/board/board-filters"
import { usePipelineBoard } from "@/lib/board/use-pipeline-board"

export default function DashboardPage() {
  const board = usePipelineBoard()

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live pipeline — filters drive the board."
      />

      <div className="flex flex-col gap-6 px-8 py-6">
        <BoardFilters board={board} />

        <BoardColumns board={board} />
      </div>
    </>
  )
}
