import type { ComponentType } from "react"
import { ClassicHub } from "./layouts/classic"
import type { HubLayoutProps } from "./types"

/**
 * Warstwa 3 — layouty huba pod kluczem. Rejestr istnieje już przy jednym
 * wpisie, bo to on, a nie `if`, jest miejscem, w którym preset spotyka
 * komponent: dopisanie layoutu ma być jedną linijką tutaj plus katalogiem
 * pod `layouts/`, bez dotykania `authed-home.tsx` (D3, warstwa 3).
 *
 * `satisfies` zamiast adnotacji typu: zachowuje wąski typ kluczy, więc
 * `HubLayoutId` to realna unia identyfikatorów, a nie `string`.
 */
export const HUB_LAYOUTS = {
  classic: ClassicHub,
} satisfies Record<string, ComponentType<HubLayoutProps>>

export type HubLayoutId = keyof typeof HUB_LAYOUTS

/** Do czasu presetów (E3) wybór layoutu jest stały — ale już w jednym miejscu. */
export const DEFAULT_HUB_LAYOUT: HubLayoutId = "classic"
