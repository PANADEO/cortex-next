"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export type SkinId = "default" | "customs"

export const SKINS: ReadonlyArray<{
  id: SkinId
  label: string
  description: string
}> = [
  {
    id: "default",
    label: "Neutral",
    description: "Monochrome shadcn defaults.",
  },
  {
    id: "customs",
    label: "Customs",
    description: "Hi-vis orange + duty-green.",
  },
]

interface SkinState {
  skin: SkinId
  setSkin: (skin: SkinId) => void
}

export const useSkinStore = create<SkinState>()(
  persist(
    (set) => ({
      skin: "default",
      setSkin: (skin) => set({ skin }),
    }),
    { name: "cortex.skin" },
  ),
)
