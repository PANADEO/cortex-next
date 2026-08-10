// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * DLACZEGO TEN PLIK POWSTAŁ. Tabela wariantów `ShellHeader` nie miała ŻADNEGO
 * pokrycia: przegląd odwrócił ciała `plain` i `ruled` i cały zestaw 2245
 * testów przeszedł na zielono. Neutral dałoby się przemalować bez jednego
 * czerwonego testu — czyli dokładnie ta klasa regresji, przed którą broni
 * `shell-variants.test.tsx` dla powłoki `(main)`.
 *
 * `authed-home.test.tsx` mockuje ten komponent w całości (`ShellHeader: () =>
 * null`), więc nie pokrywał go nawet pośrednio.
 */

vi.mock("@cortex/api", () => ({
  useShellUser: () => ({ name: "Test", email: "test@example.com" }),
  useSetUserPreferences: () => ({ mutate: vi.fn() }),
}))

function classSet(el: Element | null | undefined): string[] {
  return (el?.className ?? "").split(/\s+/).filter(Boolean).sort()
}

afterEach(cleanup)

async function renderHeader(preset: "domino" | null) {
  const { usePresetStore } = await import("@/lib/presets/preset-store")
  usePresetStore.setState({ preset })
  const { ShellHeader } = await import("./shell-header")
  return render(<ShellHeader />)
}

describe("ShellHeader — wariant powłoki", () => {
  // Komplet klas przepisany ze stanu SPRZED wprowadzenia wariantu. Równość, nie
  // zawieranie: klasa dołożona przypadkiem jest błędem tak samo jak zgubiona.
  it("bez wyboru użytkownika renderuje dokładnie ten sam komplet klas co przed zmianą", async () => {
    const { container } = await renderHeader(null)

    expect(classSet(container.querySelector("header"))).toEqual(
      ["sticky", "top-0", "z-30", "border-b", "border-border", "bg-card/80", "backdrop-blur"].sort(),
    )
  })

  it("pod wyglądem ruled linia jest grubsza, a tło bierze rolę papieru", async () => {
    const { container } = await renderHeader("domino")

    const header = container.querySelector("header")
    expect(header?.className).toContain("border-b-2")
    expect(header?.className).toContain("bg-background/80")
    expect(header?.className).not.toContain("bg-card/80")
  })
})
