// @vitest-environment jsdom
//
// Noga instancji (E5): preset z `system-config` dociera do pierwszego renderu
// PROPSEM Z SERWERA, nie zapytaniem. Testy poniżej pilnują dwóch rzeczy, które
// łatwo zepsuć osobno: pierwszeństwa źródeł w `usePreset()` oraz zgodności
// tego, co serwer wstawia do `<html>`, z tym, co potem rozstrzyga React.

import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getInstanceAppearance = vi.hoisted(() =>
  vi.fn<() => Promise<{ preset: string | null }>>(async () => ({ preset: null })),
)
vi.mock("@cortex/service", () => ({ getInstanceAppearance }))

const { InstancePresetProvider } = await import("./instance-preset")
const { usePreset, usePresetStore } = await import("./preset-store")
const { readInstancePreset } = await import("./instance-preset.server")

function withInstance(value: string | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <InstancePresetProvider value={value}>{children}</InstancePresetProvider>
  }
}

beforeEach(() => {
  localStorage.clear()
  usePresetStore.setState({ preset: null })
  getInstanceAppearance.mockReset()
  getInstanceAppearance.mockResolvedValue({ preset: null })
})

describe("preset instancji w usePreset()", () => {
  it("wygrywa, gdy użytkownik nic nie wybrał", () => {
    const { result } = renderHook(() => usePreset(), { wrapper: withInstance("domino") })
    expect(result.current.id).toBe("domino")
    expect(result.current.hubLayout).toBe("masthead")
  })

  it("przegrywa z wyborem użytkownika", () => {
    usePresetStore.setState({ preset: "customs" })
    const { result } = renderHook(() => usePreset(), { wrapper: withInstance("domino") })
    expect(result.current.id).toBe("customs")
  })

  // To jest cała treść pozycji „Domyślny instancji" w przełączniku z E4:
  // `setPreset(null)` musi ODDAĆ rozstrzygnięcie instancji, a nie zapisać
  // wartość domyślną. Bez tego przełącznik jest drzwiami w jedną stronę.
  it("wraca do gry, gdy użytkownik czyści swój wybór", () => {
    usePresetStore.setState({ preset: "neutral" })
    const { result, rerender } = renderHook(() => usePreset(), {
      wrapper: withInstance("domino"),
    })
    expect(result.current.id).toBe("neutral")

    act(() => usePresetStore.getState().setPreset(null))
    rerender()
    expect(result.current.id).toBe("domino")
  })

  it("nieznana wartość z bazy nie wywraca renderu, tylko spada na domyślną", () => {
    const { result } = renderHook(() => usePreset(), { wrapper: withInstance("kanagawa") })
    expect(result.current.id).toBe("neutral")
  })

  // Bez dostawcy (testy jednostkowe komponentów, Ladle) zachowanie ma być
  // dokładnie takie jak przed E5 — inaczej ten etap zmieniałby wynik montowania
  // czegokolwiek poza pełną aplikacją.
  it("bez dostawcy zachowuje się jak przed E5", () => {
    const { result } = renderHook(() => usePreset())
    expect(result.current.id).toBe("neutral")
  })
})

describe("readInstancePreset — to, co serwer wstawia do <html>", () => {
  it("dla znanego presetu podaje identyfikator i klasę skinu", async () => {
    getInstanceAppearance.mockResolvedValue({ preset: "domino" })
    await expect(readInstancePreset()).resolves.toEqual({ id: "domino", skinClass: "skin-domino" })
  })

  // Preset bazowy nie ma i nie ma mieć klasy. `skinClass: ""` przeciekłoby do
  // `className` jako pusty token i rozjechało napis z tym sprzed E5.
  it("dla presetu bez skinu nie podaje klasy", async () => {
    getInstanceAppearance.mockResolvedValue({ preset: "neutral" })
    await expect(readInstancePreset()).resolves.toEqual({ id: "neutral", skinClass: null })
  })

  it("brak ustawienia nie daje ani klasy, ani atrybutu", async () => {
    await expect(readInstancePreset()).resolves.toEqual({ id: null, skinClass: null })
  })

  // Musi zgadzać się z `resolvePresetId()`, który nieznaną wartość ignoruje.
  // Rozjazd znaczyłby klasę skinu w HTML-u bez pokrycia w tym, co renderuje
  // React — czyli papierowe kolory pod klasycznym layoutem.
  it("nieznany identyfikator traktuje jak brak ustawienia", async () => {
    getInstanceAppearance.mockResolvedValue({ preset: "kanagawa" })
    await expect(readInstancePreset()).resolves.toEqual({ id: null, skinClass: null })
  })

  // Ten odczyt stoi na ścieżce renderu KAŻDEJ strony. Wyjątek zamieniłby
  // niedostępną bazę w 500 na całej aplikacji, także tam, gdzie bazy nie widać.
  it("awarię bazy zamienia na brak ustawienia, nie na wyjątek", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    getInstanceAppearance.mockRejectedValue(new Error("connection refused"))
    await expect(readInstancePreset()).resolves.toEqual({ id: null, skinClass: null })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

afterEach(() => {
  localStorage.clear()
})
