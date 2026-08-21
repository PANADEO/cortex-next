"use client"

import { BoardColumns } from "@/components/board/board-columns"
import { BoardFilters } from "@/components/board/board-filters"
import { usePipelineBoard } from "@/lib/board/use-pipeline-board"
import { PageHeader } from "@cortex/ui"
import { useTranslation } from "react-i18next"

export default function DashboardPage() {
  const { t } = useTranslation("idp")
  const board = usePipelineBoard()

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={t("board.dashboardTitle")}
        actions={<BoardFilters board={board} searchMode="trigger" />}
      />

      <div className="flex min-h-0 flex-1 flex-col px-8 py-6">
        <BoardColumns board={board} />
      </div>
    </div>
  )
}
