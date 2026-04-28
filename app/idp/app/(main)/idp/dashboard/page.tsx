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

      <div className="flex min-h-0 flex-1 flex-col gap-6 px-8 py-6">
        <div>
          <h2 className="text-sm font-semibold">Pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Dirty and clean packages across every stage.
          </p>
        </div>

        <BoardFilters board={board} />

        <BoardColumns board={board} />
      </div>
    </>
  )
}
