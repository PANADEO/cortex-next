"use client"

import { cn } from "@cortex/utils"
import { useTranslation } from "react-i18next"
import type { CoworkSessionUsage } from "../types"

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

/**
 * Context-window occupancy chip for the composer: the last turn's input
 * tokens against the model's window. Turns amber past 75%, red past 90% - a
 * cue to start a fresh session before the model starts dropping history.
 */
export function ContextMeter({ usage }: { usage: CoworkSessionUsage }) {
  const { t } = useTranslation("cortex-cowork")
  if (!usage.contextWindow) return null
  const pct = Math.min(100, Math.round((usage.lastContextTokens / usage.contextWindow) * 100))
  const tone = pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"

  return (
    <span
      className="flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground"
      title={t("composer.contextMeterTitle")}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone)} />
      {formatTokens(usage.lastContextTokens)} / {formatTokens(usage.contextWindow)} ({pct}%)
    </span>
  )
}
