"use client"

import { useAiNotificationCounts } from "@/components/ai-notifications-panel"
import { AlertTriangle, Info } from "lucide-react"
import { useTranslation } from "react-i18next"

interface AiNotificationsChipProps {
  packageId: string
  onJumpToTab: () => void
}

export function AiNotificationsChip({ packageId, onJumpToTab }: AiNotificationsChipProps) {
  const { t } = useTranslation("idp")
  const { warning, info, isLoaded } = useAiNotificationCounts(packageId)
  if (!isLoaded || warning + info === 0) return null

  const ariaParts: string[] = []
  if (warning > 0) ariaParts.push(t("aiNotifications.warningCount", { count: warning }))
  if (info > 0) ariaParts.push(t("aiNotifications.noteCount", { count: info }))
  // Etykieta powstaje przed JSX-em: separator „, ” jest interpunkcją, nie
  // napisem, ale strażnik czyta CAŁE wyrażenie w atrybucie `aria-label`.
  const ariaLabel = t("aiNotifications.jumpTo", { summary: ariaParts.join(", ") })

  return (
    <button
      type="button"
      onClick={onJumpToTab}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {warning > 0 ? (
        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {t("aiNotifications.warningCount", { count: warning })}
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
          {t("aiNotifications.noteCount", { count: info })}
        </span>
      ) : null}
    </button>
  )
}
