"use client"

import { useAiNotificationCounts } from "@/components/ai-notifications-panel"
import { useAiNotificationsReadStore } from "@/lib/stores/ai-notifications-read-store"
import { TabsTrigger } from "@cortex/ui"

interface AiNotificationsTabTriggerProps {
  packageId: string
}

export function AiNotificationsTabTrigger({ packageId }: AiNotificationsTabTriggerProps) {
  const { warning, isLoaded } = useAiNotificationCounts(packageId)
  const lastSeen = useAiNotificationsReadStore((s) => s.lastSeenWarningCounts[packageId] ?? 0)
  const unread = isLoaded ? Math.max(0, warning - lastSeen) : 0
  const hasUnread = unread > 0

  return (
    <TabsTrigger value="ai-notifications" className="relative">
      AI Notifications
      {hasUnread ? (
        <span
          aria-label={`${unread} unread AI warning${unread === 1 ? "" : "s"}`}
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400"
        />
      ) : null}
    </TabsTrigger>
  )
}
