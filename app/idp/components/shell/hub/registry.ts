import type { ComponentType } from "react"
import { ClassicHub } from "./layouts/classic"
import { MastheadHub } from "./layouts/masthead"
import type { HubLayoutProps } from "./types"

/**
 * Warstwa 3 — layouty huba pod kluczem. To rejestr, a nie `if`, jest miejscem,
 * w którym preset spotyka komponent: dopisanie layoutu ma być jedną linijką
 * tutaj plus katalogiem pod `layouts/`, bez dotykania `authed-home.tsx`
 * (D3, warstwa 3).
 *
 * Ta linijka jest jednocześnie wejściem do bramki: `__tests__/layout-contract`
 * parametryzuje się PO TYM obiekcie, więc nowy wpis albo przechodzi cały
 * zestaw kontraktowy, albo nie wchodzi do rejestru (§4 projektu presetów).
 *
 * Oba wpisy zostają na stałe — to jest konsekwencja D2 przyjęta świadomie,
 * nie stan przejściowy: `classic` dla instancji bez presetu Domino,
 * `masthead` dla niego. Który z nich się renderuje, rozstrzyga `hubLayout`
 * aktywnego presetu (`lib/presets/registry.ts`) — a że przełącznika presetów
 * jeszcze nie ma, `masthead` jest osiągalny wyłącznie przez podmianę
 * `DEFAULT_PRESET`. Powód, dla którego nie ma, stoi przy tamtej stałej.
 *
 * `satisfies` zamiast adnotacji typu: zachowuje wąski typ kluczy, więc
 * `HubLayoutId` to realna unia identyfikatorów, a nie `string`.
 */
export const HUB_LAYOUTS = {
  classic: ClassicHub,
  masthead: MastheadHub,
} satisfies Record<string, ComponentType<HubLayoutProps>>

export type HubLayoutId = keyof typeof HUB_LAYOUTS
