"use client"

import type { AgentActivityStep } from "@/features/cortex-cowork/types"
import { create } from "zustand"

interface CoworkStreamState {
  /** Steps observed so far in the in-flight turn (empty when idle). */
  steps: AgentActivityStep[]
  /** Assistant text accumulated from live deltas during the turn. */
  liveText: string
  isStreaming: boolean
  begin: () => void
  pushStep: (step: AgentActivityStep) => void
  end: () => void
}

// Live activity of the current cowork turn. Deliberately not persisted - it
// mirrors an in-flight server process; the finished trail is persisted on the
// assistant message itself (message.activity).
export const useCoworkStreamStore = create<CoworkStreamState>((set) => ({
  steps: [],
  liveText: "",
  isStreaming: false,
  begin: () => set({ steps: [], liveText: "", isStreaming: true }),
  pushStep: (step) =>
    set((state) =>
      step.kind === "assistant"
        ? { liveText: state.liveText + (step.text ?? "") }
        : { steps: [...state.steps, step] },
    ),
  end: () => set({ steps: [], liveText: "", isStreaming: false }),
}))
