"use client"

import { BOARD_COLUMNS, type BoardStage } from "@/lib/board/pipeline"
import type { PipelineBoardState } from "@/lib/board/use-pipeline-board"
import { DataCard } from "@cortex/ui"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  CheckCircle2,
  FileStack,
  FileWarning,
  Loader2,
  PlayCircle,
  UserCheck,
} from "lucide-react"
import { useTranslation } from "react-i18next"

type Tone = "default" | "info" | "success" | "warning" | "destructive"

const STAGE_ICON: Record<BoardStage, LucideIcon> = {
  intake: FileStack,
  classified: FileWarning,
  processing: Loader2,
  ready: PlayCircle,
  verifying: UserCheck,
  done: CheckCircle2,
}

const STAGE_TONE: Record<BoardStage, Tone> = {
  intake: "warning",
  classified: "info",
  processing: "info",
  ready: "success",
  verifying: "warning",
  done: "success",
}

interface BoardStatsProps {
  board: PipelineBoardState
}

export function BoardStats({ board }: BoardStatsProps) {
  const { t } = useTranslation("idp")
  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
      {BOARD_COLUMNS.map((meta) => (
        <DataCard
          key={meta.id}
          label={t(`board.columns.${meta.id}.label`)}
          value={board.counts[meta.id]}
          icon={STAGE_ICON[meta.id]}
          isLoading={board.isLoading}
          tone={STAGE_TONE[meta.id]}
        />
      ))}
      <DataCard
        label={t("board.stats.errors")}
        value={board.errorCount}
        icon={AlertTriangle}
        isLoading={board.isLoading}
        tone="destructive"
      />
    </section>
  )
}
