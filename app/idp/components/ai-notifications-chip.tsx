"use client"

import { useAiNotificationCounts } from "@/components/ai-notifications-panel"
import { AlertTriangle, Info } from "lucide-react"

interface AiNotificationsChipProps {
  packageId: string
  onJumpToTab: () => void
}

export function AiNotificationsChip({ packageId, onJumpToTab }: AiNotificationsChipProps) {
  const { warning, info, isLoaded } = useAiNotificationCounts(packageId)
  if (!isLoaded || warning + info === 0) return null

  const ariaParts: string[] = []
  if (warning > 0) ariaParts.push(`${warning} warning${warning === 1 ? "" : "s"}`)
  if (info > 0) ariaParts.push(`${info} note${info === 1 ? "" : "s"}`)

  return (
    <button
      type="button"
      onClick={onJumpToTab}
      aria-label={`Jump to AI Notifications: ${ariaParts.join(", ")}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {warning > 0 ? (
        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {warning} warning{warning === 1 ? "" : "s"}
        </span>
      ) : null}
      {warning > 0 && info > 0 ? (
        <span aria-hidden className="text-muted-foreground">
          ·
        </span>
      ) : null}
      {info > 0 ? (
        <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300">
          <Info className="h-3 w-3" aria-hidden />
          {info} note{info === 1 ? "" : "s"}
        </span>
      ) : null}
    </button>
  )
}
