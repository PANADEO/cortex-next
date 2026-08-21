"use client"

import { useAiNotificationCounts } from "@/components/ai-notifications-panel"
import { useAiNotificationsReadStore } from "@/lib/stores/ai-notifications-read-store"
import { TabsTrigger } from "@cortex/ui"
import { useTranslation } from "react-i18next"

interface AiNotificationsTabTriggerProps {
  packageId: string
}

export function AiNotificationsTabTrigger({ packageId }: AiNotificationsTabTriggerProps) {
  const { t } = useTranslation("idp")
  const { warning, isLoaded } = useAiNotificationCounts(packageId)
  const lastSeen = useAiNotificationsReadStore((s) => s.lastSeenWarningCounts[packageId] ?? 0)
  const unread = isLoaded ? Math.max(0, warning - lastSeen) : 0
  const hasUnread = unread > 0

  return (
    <TabsTrigger value="ai-notifications" className="relative">
      {t("aiNotifications.tab")}
      {hasUnread ? (
        <span
          aria-label={t("aiNotifications.unreadWarnings", { count: unread })}
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400"
        />
      ) : null}
    </TabsTrigger>
  )
}
