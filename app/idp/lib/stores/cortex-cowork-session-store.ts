"use client"

import { create } from "zustand"

interface CoworkSessionState {
  sessionId: string | null
  setSessionId: (sessionId: string | null) => void
}

// Deliberately not persisted (localStorage) - a sandbox session is tied to a
// live server-side workspace, not something to silently rehydrate on reload.
export const useCoworkSessionStore = create<CoworkSessionState>((set) => ({
  sessionId: null,
  setSessionId: (sessionId) => set({ sessionId }),
}))
