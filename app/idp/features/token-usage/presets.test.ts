import { describe, expect, it } from "vitest"
import { PRESETS, defaultRange } from "./presets"

// Środa, 15 lipca 2026. Godzina celowo niezerowa — presety mają operować na
// dacie, nie na chwili.
const TODAY = new Date(2026, 6, 15, 13, 45)

function preset(id: string) {
  const found = PRESETS.find((entry) => entry.id === id)
  if (!found) throw new Error(`brak presetu ${id}`)
  return found
}

describe("presety zakresu dat", () => {
  it("bieżący miesiąc idzie od pierwszego dnia do dziś", () => {
    expect(preset("current-month").build(TODAY)).toEqual({
      start: "2026-07-01",
      end: "2026-07-15",
    })
  })

  // Zakres jest obustronnie domknięty po stronie proxy, więc "ostatnie 7 dni"
  // to dziś minus 6, nie minus 7.
  it("ostatnie 7 dni obejmuje dziś i sześć dni wstecz", () => {
    expect(preset("last-7-days").build(TODAY)).toEqual({
      start: "2026-07-09",
      end: "2026-07-15",
    })
  })

  it("ostatnie 30 dni obejmuje dziś i dwadzieścia dziewięć dni wstecz", () => {
    expect(preset("last-30-days").build(TODAY)).toEqual({
      start: "2026-06-16",
      end: "2026-07-15",
    })
  })

  it("preset poprawnie przechodzi przez granicę miesiąca", () => {
    expect(preset("current-month").build(new Date(2026, 0, 1, 0, 30))).toEqual({
      start: "2026-01-01",
      end: "2026-01-01",
    })
  })

  it("domyślny zakres to bieżący miesiąc, parytet z oryginałem", () => {
    expect(defaultRange(TODAY)).toEqual(preset("current-month").build(TODAY))
  })
})
