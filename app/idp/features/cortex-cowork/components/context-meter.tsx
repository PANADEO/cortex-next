"use client"

import { cn } from "@cortex/utils"
import type { CoworkSessionUsage } from "../types"

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(n)
}

/**
 * Context-window occupancy for the current session: the last turn's input
 * tokens against the model's window. Turns amber past 75%, red past 90% - a
 * cue to start a fresh session before the model starts dropping history.
 */
export function ContextMeter({ usage }: { usage: CoworkSessionUsage }) {
  if (!usage.contextWindow) return null
  const pct = Math.min(100, Math.round((usage.lastContextTokens / usage.contextWindow) * 100))
  const tone =
    pct >= 90 ? "bg-destructive" : pct >= 75 ? "bg-amber-500" : "bg-cortex"

  return (
    <div className="flex items-center gap-2" title="Zajętość okna kontekstu (ostatnia tura)">
      <span className="text-xs text-muted-foreground">Kontekst</span>
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatTokens(usage.lastContextTokens)} / {formatTokens(usage.contextWindow)} ({pct}%)
      </span>
    </div>
  )
}
