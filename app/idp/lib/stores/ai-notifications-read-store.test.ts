// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"
import { useAiNotificationsReadStore } from "./ai-notifications-read-store"

beforeEach(() => {
  useAiNotificationsReadStore.setState({ lastSeenWarningCounts: {} })
  window.localStorage.clear()
})

describe("useAiNotificationsReadStore", () => {
  describe("getUnreadWarnings", () => {
    it("returns 0 when nothing has been seen and current count is 0", () => {
      const result = useAiNotificationsReadStore
        .getState()
        .getUnreadWarnings("pkg-1", 0)
      expect(result).toBe(0)
    })

    it("returns the full count as unread when nothing has been seen and current is positive", () => {
      const result = useAiNotificationsReadStore
        .getState()
        .getUnreadWarnings("pkg-1", 3)
      expect(result).toBe(3)
    })

    it("returns 0 immediately after markRead with the same count", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 3)
      const result = useAiNotificationsReadStore
        .getState()
        .getUnreadWarnings("pkg-1", 3)
      expect(result).toBe(0)
    })

    it("returns the difference when count grows after markRead (reprocess increases warnings)", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 3)
      const result = useAiNotificationsReadStore
        .getState()
        .getUnreadWarnings("pkg-1", 5)
      expect(result).toBe(2)
    })

    it("returns 0 when count decreases after markRead (reprocess reduces warnings)", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 5)
      const result = useAiNotificationsReadStore
        .getState()
        .getUnreadWarnings("pkg-1", 3)
      expect(result).toBe(0)
    })

    it("isolates state per package", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 3)
      const a = useAiNotificationsReadStore
        .getState()
        .getUnreadWarnings("pkg-1", 3)
      const b = useAiNotificationsReadStore
        .getState()
        .getUnreadWarnings("pkg-2", 3)
      expect(a).toBe(0)
      expect(b).toBe(3)
    })
  })

  describe("markRead", () => {
    it("records the count for the given package", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 4)
      expect(
        useAiNotificationsReadStore.getState().lastSeenWarningCounts["pkg-1"],
      ).toBe(4)
    })

    it("does not mutate the lastSeenWarningCounts reference when called with an unchanged count", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 4)
      const beforeRef =
        useAiNotificationsReadStore.getState().lastSeenWarningCounts
      useAiNotificationsReadStore.getState().markRead("pkg-1", 4)
      const afterRef =
        useAiNotificationsReadStore.getState().lastSeenWarningCounts
      expect(afterRef).toBe(beforeRef)
    })

    it("creates a new lastSeenWarningCounts reference when the count changes", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 4)
      const beforeRef =
        useAiNotificationsReadStore.getState().lastSeenWarningCounts
      useAiNotificationsReadStore.getState().markRead("pkg-1", 6)
      const afterRef =
        useAiNotificationsReadStore.getState().lastSeenWarningCounts
      expect(afterRef).not.toBe(beforeRef)
      expect(afterRef["pkg-1"]).toBe(6)
    })

    it("preserves entries for other packages when marking one as read", () => {
      useAiNotificationsReadStore.getState().markRead("pkg-1", 2)
      useAiNotificationsReadStore.getState().markRead("pkg-2", 5)
      const counts =
        useAiNotificationsReadStore.getState().lastSeenWarningCounts
      expect(counts["pkg-1"]).toBe(2)
      expect(counts["pkg-2"]).toBe(5)
    })
  })
})
