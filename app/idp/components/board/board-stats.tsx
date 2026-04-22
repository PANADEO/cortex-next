"use client"

import { DataCard } from "@cortex/ui"
import { AlertTriangle, CheckCircle2, FileStack, FileWarning, Loader2, PlayCircle, UserCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { BOARD_COLUMNS, type BoardStage } from "@/lib/board/pipeline"
import type { PipelineBoardState } from "@/lib/board/use-pipeline-board"

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
  return (
    <section className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {BOARD_COLUMNS.map((meta) => (
        <DataCard
          key={meta.id}
          label={meta.label}
          value={board.counts[meta.id]}
          icon={STAGE_ICON[meta.id]}
          isLoading={board.isLoading}
          tone={STAGE_TONE[meta.id]}
        />
      ))}
      <DataCard
        label="Errors"
        value={board.errorCount}
        icon={AlertTriangle}
        isLoading={board.isLoading}
        tone="destructive"
      />
    </section>
  )
}
