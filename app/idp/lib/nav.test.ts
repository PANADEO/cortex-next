import type { TileMenuSection } from "@cortex/ui"
import { LayoutDashboard } from "lucide-react"
import { describe, expect, it } from "vitest"
import {
  filterNavSections,
  IDP_NAV,
  ILUSTROMAT_NAV,
  INTRASTAT_NAV,
  parseHiddenMenuItems,
  resolveActiveItemId,
} from "./nav"

function itemIds(sections: ReturnType<typeof filterNavSections>): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.id))
}

describe("filterNavSections", () => {
  it("hides Export, Rule editor, and empty Settings from a comma-separated backend list", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems("export,rules"))

    expect(itemIds(sections)).not.toContain("export")
    expect(itemIds(sections)).not.toContain("rules")
    expect(sections.some((section) => section.id === "settings")).toBe(false)
  })

  it("shows Export and Rule editor when the backend list is empty", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(undefined))

    expect(itemIds(sections)).toContain("export")
    expect(itemIds(sections)).toContain("rules")
    expect(itemIds(sections)).not.toContain("configuration")
    expect(sections.some((section) => section.id === "settings")).toBe(true)
  })

  it("shows Configuration only for admin navigation", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(undefined), {
      showAdminItems: true,
    })

    expect(itemIds(sections)).toContain("configuration")
  })

  it("accepts labels with spaces and mixed case", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(" Rule Editor "))

    expect(itemIds(sections)).not.toContain("rules")
    expect(sections.some((section) => section.id === "settings")).toBe(false)
  })

  it("accepts an array from backend config", () => {
    const sections = filterNavSections(IDP_NAV, parseHiddenMenuItems(["export", "Rule editor"]))

    expect(itemIds(sections)).not.toContain("export")
    expect(itemIds(sections)).not.toContain("rules")
    expect(sections.some((section) => section.id === "settings")).toBe(false)
  })
})

describe("INTRASTAT_NAV", () => {
  it("includes the v1 Intrastat pages", () => {
    expect(itemIds(INTRASTAT_NAV)).toEqual([
      "dashboard",
      "batches",
      "review",
      "resources",
      "settings",
    ])
  })
})

describe("ILUSTROMAT_NAV", () => {
  it("links Generation and Templates to their pages", () => {
    expect(itemIds(ILUSTROMAT_NAV)).toEqual(["generation", "templates"])

    const hrefs = ILUSTROMAT_NAV.flatMap((section) => section.items.map((item) => item.href))
    expect(hrefs).toEqual(["/ilustromat/generation", "/ilustromat/templates"])
  })
})

describe("resolveActiveItemId — podświetlenie pozycji menu", () => {
  const SECTIONS: TileMenuSection[] = [
    {
      id: "praca",
      label: "Praca",
      items: [
        { id: "generowanie", label: "Generowanie", icon: LayoutDashboard, href: "/content-guru" },
        { id: "historia", label: "Historia", icon: LayoutDashboard, href: "/content-guru/history" },
      ],
    },
  ]

  /**
   * DEFEKT, KTÓRY TO NAPRAWIA (zmierzony na wdrożonej instancji 10.08.2026):
   * na `/content-guru` ŻADNA pozycja menu nie była podświetlona. Poprzednie
   * dopasowanie szło po `id` wyliczonym ze ścieżki — korzeń kafelka bez
   * podstrony dawał stałe `"dashboard"`, więc pasował wyłącznie do menu, które
   * akurat tak nazwało swoją pierwszą pozycję. Trzy kafelki tego nie robiły
   * (`content-guru` → `generowanie`, `geo-score-calculator` → `kalkulator`,
   * `visual-guru` → `generator`) i traciły jedyny wizualny sygnał „gdzie
   * jestem"; `aria-current` też nie było, więc czytnik ekranu też go nie miał.
   *
   * Reguła jest teraz jedna i nie wymaga zgodności dwóch list: aktywna jest
   * pozycja o NAJDŁUŻSZYM `href`, który jest prefiksem bieżącej ścieżki.
   */
  it("korzeń kafelka podświetla własną pozycję, nie żadną", () => {
    expect(resolveActiveItemId("/content-guru", SECTIONS)).toBe("generowanie")
  })

  it("podstrona wygrywa z korzeniem — liczy się NAJDŁUŻSZY pasujący href", () => {
    expect(resolveActiveItemId("/content-guru/history", SECTIONS)).toBe("historia")
  })

  it("trasa zagnieżdżona głębiej niż menu podświetla najbliższego przodka", () => {
    expect(resolveActiveItemId("/content-guru/history/42", SECTIONS)).toBe("historia")
  })

  it("prefiks musi kończyć się na granicy segmentu", () => {
    // `/content-guru-inny` NIE jest podstroną `/content-guru`.
    expect(resolveActiveItemId("/content-guru-inny", SECTIONS)).toBeUndefined()
  })

  it("brak dopasowania to brak podświetlenia, nie zgadywanie", () => {
    expect(resolveActiveItemId("/zupelnie-inny-kafelek", SECTIONS)).toBeUndefined()
  })
})
