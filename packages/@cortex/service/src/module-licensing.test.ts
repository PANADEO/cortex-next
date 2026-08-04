import { afterEach, describe, expect, it, vi } from "vitest"
import { isModuleEnabled, moduleLicensingConfig } from "./module-licensing"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("moduleLicensingConfig", () => {
  it("brak zmiennej -> enabledModules: null (bez ograniczeń, dzisiejsze zachowanie)", () => {
    vi.stubEnv("ENABLED_MODULES", undefined as unknown as string)

    expect(moduleLicensingConfig()).toEqual({ enabledModules: null })
  })

  it("PUSTA zmienna też oznacza brak ograniczeń", () => {
    // docker-compose wstawia `VAR: ${VAR:-}`, więc nieustawiona zmienna
    // dociera tu jako "" — bez normalizacji wywróciłoby to walidację.
    vi.stubEnv("ENABLED_MODULES", "")

    expect(moduleLicensingConfig()).toEqual({ enabledModules: null })
  })

  it("parsuje comma-separated listę, przycina spacje i pomija puste elementy", () => {
    vi.stubEnv("ENABLED_MODULES", " content-guru ,visual-guru,,  geo-score-calculator")

    expect(moduleLicensingConfig()).toEqual({
      enabledModules: ["content-guru", "visual-guru", "geo-score-calculator"],
    })
  })

  it("sama lista przecinków liczy się jak brak wartości -> null, nie pusta tablica", () => {
    vi.stubEnv("ENABLED_MODULES", " , , ")

    expect(moduleLicensingConfig()).toEqual({ enabledModules: null })
  })
})

describe("isModuleEnabled", () => {
  it("bez ograniczeń (zmienna nieustawiona) -> każdy kod dozwolony", () => {
    vi.stubEnv("ENABLED_MODULES", undefined as unknown as string)

    expect(isModuleEnabled("content-guru")).toBe(true)
    expect(isModuleEnabled("cokolwiek-nieznanego")).toBe(true)
  })

  it("z ustawioną listą -> true wyłącznie dla kodów na liście", () => {
    vi.stubEnv("ENABLED_MODULES", "content-guru,visual-guru")

    expect(isModuleEnabled("content-guru")).toBe(true)
    expect(isModuleEnabled("visual-guru")).toBe(true)
  })

  it("z ustawioną listą -> fail-closed dla kodu spoza niej", () => {
    vi.stubEnv("ENABLED_MODULES", "content-guru")

    expect(isModuleEnabled("geo-score-calculator")).toBe(false)
  })
})
