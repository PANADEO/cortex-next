import { describe, expect, it } from "vitest"
import {
  AVOID_LIMIT,
  buildAssistMessages,
  isSupportedAssist,
  normalizeAssistedText,
} from "./prompt-builder"

describe("isSupportedAssist", () => {
  it("dopuszcza tylko kombinacje, które mają instrukcję", () => {
    expect(isSupportedAssist("title", "polish")).toBe(true)
    expect(isSupportedAssist("subtitle", "propose")).toBe(true)
    expect(isSupportedAssist("idea", "propose")).toBe(true)
  })

  it("odrzuca kombinacje bez sensu — tytuł jest źródłem, nie da się go wymyślić z niczego", () => {
    expect(isSupportedAssist("title", "propose")).toBe(false)
    expect(isSupportedAssist("idea", "polish")).toBe(false)
    expect(isSupportedAssist("idea", "rephrase")).toBe(false)
  })
})

describe("buildAssistMessages", () => {
  it("polish dostaje tekst usera i limit znaków w systemie", () => {
    const [system, user] = buildAssistMessages({
      field: "title",
      mode: "polish",
      maxChars: 140,
      text: "  Zmiany w cenach transferowych  ",
    })

    expect(system!.content).toContain("maksymalnie 140 znaków")
    expect(system!.content).toContain("NIE zmieniaj sensu")
    expect(user!.content).toBe("Zmiany w cenach transferowych")
  })

  it("propose dla pomysłu bierze tytuł i podtytuł, nie tekst pola", () => {
    const [, user] = buildAssistMessages({
      field: "idea",
      mode: "propose",
      maxChars: 300,
      text: "stara treść pola",
      context: { title: "Kontrola podatkowa", subtitle: "Jak się przygotować" },
    })

    expect(user!.content).toContain("Tytuł: Kontrola podatkowa")
    expect(user!.content).toContain("Podtytuł/hasło: Jak się przygotować")
    expect(user!.content).not.toContain("stara treść pola")
  })

  it("propose dla podtytułu nie podaje podtytułu — właśnie go pisze", () => {
    const [, user] = buildAssistMessages({
      field: "subtitle",
      mode: "propose",
      maxChars: 200,
      context: { title: "Kontrola podatkowa", subtitle: "" },
    })

    expect(user!.content).toContain("Tytuł: Kontrola podatkowa")
    expect(user!.content).not.toContain("Podtytuł/hasło")
  })

  it("brak podtytułu w kontekście pomysłu daje jawne (brak), nie puste pole", () => {
    const [, user] = buildAssistMessages({
      field: "idea",
      mode: "propose",
      maxChars: 300,
      context: { title: "Kontrola podatkowa" },
    })

    expect(user!.content).toContain("Podtytuł/hasło: (brak)")
  })

  it("odrzucone wersje trafiają do promptu — bez nich kolejne kliknięcie zwraca to samo", () => {
    const [, user] = buildAssistMessages({
      field: "title",
      mode: "rephrase",
      maxChars: 140,
      text: "Ceny transferowe 2027",
      avoid: ["Rewolucja w cenach transferowych", "Co zmienia się w 2027"],
    })

    expect(user!.content).toContain("- Rewolucja w cenach transferowych")
    expect(user!.content).toContain("- Co zmienia się w 2027")
    expect(user!.content).toContain("nie parafrazuj ich")
  })

  it("z długiej listy odrzuconych zostają ostatnie AVOID_LIMIT pozycji", () => {
    const avoid = Array.from({ length: AVOID_LIMIT + 3 }, (_, index) => `wersja ${index}`)
    const [, user] = buildAssistMessages({
      field: "title",
      mode: "rephrase",
      maxChars: 140,
      text: "Ceny transferowe",
      avoid,
    })

    expect(user!.content).not.toContain("- wersja 0")
    expect(user!.content).toContain(`- wersja ${AVOID_LIMIT + 2}`)
    expect(user!.content.match(/^- /gm)).toHaveLength(AVOID_LIMIT)
  })

  it("puste wpisy w avoid nie tworzą pustych myślników", () => {
    const [, user] = buildAssistMessages({
      field: "title",
      mode: "rephrase",
      maxChars: 140,
      text: "Ceny transferowe",
      avoid: ["", "   ", "realna wersja"],
    })

    expect(user!.content.match(/^- /gm)).toHaveLength(1)
  })

  it("bez odrzuconych wersji nie dokleja sekcji o unikaniu", () => {
    const [, user] = buildAssistMessages({
      field: "title",
      mode: "polish",
      maxChars: 140,
      text: "Ceny transferowe",
    })

    expect(user!.content).not.toContain("nie parafrazuj ich")
  })
})

describe("normalizeAssistedText", () => {
  it("zdejmuje cudzysłowy, którymi model lubi opakować odpowiedź", () => {
    expect(normalizeAssistedText('  "Ceny transferowe 2027"  ', 140)).toBe("Ceny transferowe 2027")
    expect(normalizeAssistedText("'Ceny transferowe'", 140)).toBe("Ceny transferowe")
  })

  it("przycina do limitu pola — instrukcji w promptcie nie traktujemy jak gwarancji", () => {
    expect(normalizeAssistedText("abcdefghij", 4)).toBe("abcd")
  })
})
