"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface AiNotificationsReadState {
  lastSeenWarningCounts: Record<string, number>
  markRead: (packageId: string, currentWarningCount: number) => void
  getUnreadWarnings: (packageId: string, currentWarningCount: number) => number
}

export const useAiNotificationsReadStore = create<AiNotificationsReadState>()(
  persist(
    (set, get) => ({
      lastSeenWarningCounts: {},
      markRead: (packageId, currentWarningCount) => {
        const previous = get().lastSeenWarningCounts[packageId] ?? 0
        if (previous === currentWarningCount) return
        set((s) => ({
          lastSeenWarningCounts: {
            ...s.lastSeenWarningCounts,
            [packageId]: currentWarningCount,
          },
        }))
      },
      getUnreadWarnings: (packageId, currentWarningCount) => {
        const lastSeen = get().lastSeenWarningCounts[packageId] ?? 0
        return Math.max(0, currentWarningCount - lastSeen)
      },
    }),
    { name: "cortex.ai-notifications-read" },
  ),
)
