// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SHELL_VERSION", "v0.2.10")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  // Store presetu jest PERSYSTOWANY (`cortex.skin` w localStorage), więc
  // `vi.resetModules()` go nie czyści — wręcz pogarsza sprawę, bo świeżo
  // zaimportowany store rehydruje zapisaną wartość. Sprzątanie MUSI stać
  // tutaj, a nie w ciele testu: test przerwany asercją pomijał tamto
  // przypisanie i zatruwał każdy kolejny w pliku.
  localStorage.removeItem("cortex.skin")
})

function classSet(el: Element | null | undefined): string[] {
  return (el?.className ?? "").split(/\s+/).filter(Boolean).sort()
}

describe("ShellFooter", () => {
  it("renders copyright and the shell version stripped of leading 'v'", async () => {
    const { ShellFooter } = await import("./shell-footer")

    render(createElement(ShellFooter))

    expect(screen.getByText(/Cortex360 ©/).textContent ?? "").toMatch(/Cortex360 © \d{4}/)
    expect(screen.getByText(/Wersja:/).textContent ?? "").toBe("Wersja: 0.2.10")
  })

  it("renders live diagnostics after mount (time, resolution, language, online)", async () => {
    const { ShellFooter } = await import("./shell-footer")

    render(createElement(ShellFooter))

    expect((screen.getByText(/Czas:/).textContent ?? "").trim()).toMatch(/Czas: \d{2}:\d{2}/)
    expect((screen.getByText(/Rozdzielczość:/).textContent ?? "").trim()).toMatch(
      /Rozdzielczość: \d+x\d+/,
    )
    expect(screen.getByText("Polski")).not.toBeNull()
    expect((screen.getByText(/Online:/).textContent ?? "").trim()).toMatch(/Online: (Tak|Nie)/)
  })
})

describe("ShellFooter — wariant powłoki", () => {
  /**
   * Stopka renderuje się w DWÓCH miejscach: pod hubem i na ekranie startowym
   * (`landing-hero.tsx`). Ten drugi ogląda też NIEZALOGOWANY, więc wygląd
   * bierze się tam z presetu INSTANCJI — wybór użytkownika mieszka w
   * `localStorage` i przy pierwszej wizycie go nie ma. Zachowanie zamierzone:
   * wygląd bramy wejściowej należy do właściciela instancji.
   */
  it("bez wyboru użytkownika renderuje wariant plain, znak w znak jak przed zmianą", async () => {
    const { usePresetStore } = await import("@/lib/presets/preset-store")
    usePresetStore.setState({ preset: null })

    const { ShellFooter } = await import("./shell-footer")
    const { container } = render(createElement(ShellFooter))

    // RÓWNOŚĆ zbiorów, nie zawieranie — tytuł mówi „znak w znak" i ma to
    // znaczyć. Pierwsza wersja używała `toContain` i przepuszczała klasę
    // dołożoną przypadkiem (sprawdzone mutacją: `shadow-lg ring-2` w bazie
    // przechodziło na zielono).
    expect(classSet(container.querySelector("footer"))).toEqual(
      ["border-t", "border-border", "bg-card/60", "backdrop-blur"].sort(),
    )

    expect(classSet(container.querySelector("footer > div"))).toEqual(
      [
        "mx-auto", "flex", "max-w-7xl", "flex-wrap", "items-center",
        "justify-between", "gap-x-6", "gap-y-1", "px-6", "py-3",
        "text-[11px]", "text-muted-foreground",
      ].sort(),
    )
  })

  it("pod wyglądem ruled linia jest grubsza, a tło i tekst biorą rolę paska bocznego", async () => {
    const { usePresetStore } = await import("@/lib/presets/preset-store")
    usePresetStore.setState({ preset: "domino" })

    const { ShellFooter } = await import("./shell-footer")
    const { container } = render(createElement(ShellFooter))

    const footer = container.querySelector("footer")
    expect(footer?.className).toContain("border-t-2")
    expect(footer?.className).toContain("bg-sidebar/60")

    // Typografia przeniesiona z oryginału (`.ch-shellfoot`): mono, wersaliki,
    // tracking 0.08em. Komentarz w kodzie twierdził wcześniej, że oryginał
    // tego nie miał — nieprawda, wychwycone przy przeglądzie.
    const inner = container.querySelector("footer > div")
    expect(inner?.className).toContain("font-mono")
    expect(inner?.className).toContain("uppercase")
    expect(inner?.className).toContain("tracking-[0.08em]")
    expect(inner?.className).toContain("text-sidebar-foreground")
  })
})
