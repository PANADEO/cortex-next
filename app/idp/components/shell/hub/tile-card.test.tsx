// @vitest-environment jsdom
import { PRESETS, presetUsesApplicationColor } from "@/lib/presets/registry"
import type { Tile } from "@/lib/tiles"
import "@testing-library/jest-dom/vitest"
import { cleanup, render } from "@testing-library/react"
import { Wand2 } from "lucide-react"
import { afterEach, describe, expect, it } from "vitest"
import { TileCard } from "./tile-card"

/** Klasa z 11-kolorowej palety admina (`applications.color` →
 *  `features/system-config/colors.ts`) — dokładnie ta, którą hub dostaje z
 *  bazy dla kafelka o kolorze „emerald". */
const ADMIN_PALETTE_CLASS = "bg-emerald-200"

/** Druga połowa tej samej decyzji: `isChiclet` czytany jest w tile-card.tsx
 *  DWA RAZY pod rząd — raz na tło kwadratu ikony, raz na kolor glifu. Asercja
 *  wyłącznie na tle przepuszczała odwrócenie samej gałęzi glifu (sprawdzone
 *  mutacją: test zostawał zielony), czyli `text-emerald-700` na `bg-chart-1`
 *  — a `presetUsesApplicationColor` twierdziłby dalej, że to spójne. */
const ADMIN_PALETTE_FG_CLASS = "text-emerald-700"

const TILE: Tile = {
  id: "document-parser",
  label: "Parser Dokumentów",
  description: "Wyciąga dane z dokumentów.",
  href: "/document-parser",
  icon: Wand2,
  iconBg: `${ADMIN_PALETTE_CLASS} dark:bg-emerald-900/40`,
  iconFg: "text-emerald-700 dark:text-emerald-300",
  categoryFunctional: "content-generation",
  categoryDepartment: [],
  archetype: "dashboard",
}

afterEach(cleanup)

describe("kafelek huba a paleta admina", () => {
  /**
   * `presetUsesApplicationColor` z rejestru presetów jest ZDANIEM O TYM PLIKU,
   * wypowiedzianym gdzie indziej — a takie zdanie rozjeżdża się w ciszy.
   * Panel Aplikacji ostrzega na jego podstawie, że wybrany kolor nic nie
   * zmienia, więc rozjazd znaczy albo ostrzeżenie tam, gdzie paleta działa,
   * albo z powrotem kłamiącą kontrolkę.
   *
   * Test konfrontuje predykat z tym, co kafelek REALNIE wyrenderował pod każdym
   * presetem z rejestru: albo klasa z palety admina, albo akcent `--chart-*`.
   * Nigdy oba, nigdy żadne.
   */
  it("predykat presetu zgadza się z tym, czym kafelek maluje kwadrat ikony", () => {
    for (const preset of Object.values(PRESETS)) {
      const { container } = render(
        <TileCard
          tile={TILE}
          isFavorite={false}
          onToggleFavorite={() => {}}
          variant={preset.variants.tile}
          index={0}
          categoryTag="Generowanie treści"
        />,
      )

      const usesPalette = container.querySelector(`.${ADMIN_PALETTE_CLASS}`) !== null
      const usesAccent = container.querySelector(".bg-chart-1, .bg-chart-2, .bg-chart-3") !== null
      const usesPaletteFg = container.querySelector(`.${ADMIN_PALETTE_FG_CLASS}`) !== null
      const usesAccentFg =
        container.querySelector(
          ".text-chart-1-foreground, .text-chart-2-foreground, .text-chart-3-foreground",
        ) !== null

      const readsPalette = presetUsesApplicationColor(preset)

      expect({ preset: preset.id, usesPalette, usesAccent, usesPaletteFg, usesAccentFg }).toEqual({
        preset: preset.id,
        usesPalette: readsPalette,
        usesAccent: !readsPalette,
        usesPaletteFg: readsPalette,
        usesAccentFg: !readsPalette,
      })

      cleanup()
    }
  })

  // Zapisany kolor NIE ginie pod Dominem — kolumna zostaje w bazie i maluje ten
  // sam kafelek, gdy tylko wygląd czytający paletę wróci. To jest treść zdania,
  // które panel obiecuje adminowi, więc niech ją potwierdzi render, a nie
  // wyłącznie tekst w formularzu.
  it("ten sam kafelek pod wyglądem czytającym paletę wraca do koloru z bazy", () => {
    const { container } = render(
      <TileCard
        tile={TILE}
        isFavorite={false}
        onToggleFavorite={() => {}}
        variant={PRESETS.neutral.variants.tile}
        index={0}
        categoryTag="Generowanie treści"
      />,
    )

    expect(container.querySelector(`.${ADMIN_PALETTE_CLASS}`)).not.toBeNull()
  })
})
