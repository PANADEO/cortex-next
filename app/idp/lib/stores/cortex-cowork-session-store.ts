"use client"

import { create } from "zustand"

interface CoworkSessionState {
  /** Live sandbox session id per project - separate tiles keep separate chats. */
  sessionIds: Record<string, string>
  setSessionId: (projectId: string, sessionId: string | null) => void
}

// Deliberately not persisted (localStorage) - a sandbox session is tied to a
// live server-side workspace, not something to silently rehydrate on reload.
export const useCoworkSessionStore = create<CoworkSessionState>((set) => ({
  sessionIds: {},
  setSessionId: (projectId, sessionId) =>
    set((state) => {
      const next = { ...state.sessionIds }
      if (sessionId === null) delete next[projectId]
      else next[projectId] = sessionId
      return { sessionIds: next }
    }),
}))
