import { as, expect, test } from "./osoby"

/**
 * Obrys skupienia jest jedyną rzeczą, po której osoba pracująca z klawiatury wie,
 * gdzie jest. Nie ma dla niego zamiennika i nie widać go na zrzucie ekranu, bo zrzut
 * robi się myszą — dlatego mierzymy go liczbą.
 *
 * DLACZEGO POWSTAŁ. Biurko brało obrys z `--ring` powłoki, a to 2,58:1 wobec białego
 * tła — poniżej progu 3:1 dla elementów nietekstowych. Nic tego nie zgłaszało: obrys
 * BYŁ, tylko prawie niewidoczny. Jedna linia w mostku tokenów odwraca to z powrotem.
 */
const CONTRAST_FLOOR = 3

/** Względna luminancja wg WCAG — z tego liczy się stosunek kontrastu. */
function luminance([r, g, b]: number[]): number {
  const channel = (v: number) => {
    const x = (v ?? 0) / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!)
}

function contrast(a: number[], b: number[]): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter! + 0.05) / (darker! + 0.05)
}

const parse = (color: string): number[] => (color.match(/\d+/g) ?? []).slice(0, 3).map(Number)

test.describe("Obszar 24 · Widać, gdzie jest kursor klawiatury", () => {
  test("Obrys skupienia ma kontrast wymagany dla elementów nietekstowych", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    const colors = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      const probe = document.createElement("div")
      document.body.appendChild(probe)
      const read = (token: string) => {
        probe.style.color = `hsl(${style.getPropertyValue(token)})`
        return getComputedStyle(probe).color
      }
      const out = {
        focus: read("--desk-focus"),
        background: read("--desk-bg"),
        surface: read("--desk-surface"),
      }
      probe.remove()
      return out
    })
    // Dwa tła, bo obrys pada i na dokument, i na karty — a to bywają inne kolory.
    expect(contrast(parse(colors.focus), parse(colors.background))).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR,
    )
    expect(contrast(parse(colors.focus), parse(colors.surface))).toBeGreaterThanOrEqual(
      CONTRAST_FLOOR,
    )
  })

  test("Przejście Tabem naprawdę rysuje obrys, a nie tylko go deklaruje", async ({ page }) => {
    // Klasa `outline-none` Tailwinda ma tę samą swoistość co reguła skupienia w arkuszu
    // Biurka, więc o wyniku decyduje KOLEJNOŚĆ wczytania plików. To jest rzecz, o której
    // nie da się wnioskować z kodu — trzeba zapytać przeglądarki.
    await as(page, "anna")
    await page.goto("/files")
    await page.keyboard.press("Tab")
    await page.keyboard.press("Tab")
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return { width: style.outlineWidth, color: style.outlineColor, style: style.outlineStyle }
    })
    expect(outline.style).not.toBe("none")
    expect(Number.parseFloat(outline.width)).toBeGreaterThanOrEqual(2)
    expect(outline.color).not.toContain("rgba(0, 0, 0, 0)")
  })

  test("Pola i paski przewijania Biurka idą za jego motywem", async ({ page }) => {
    await as(page, "anna")
    await page.goto("/files")
    const scheme = await page.evaluate(
      () => getComputedStyle(document.querySelector(".desk")!).colorScheme,
    )
    expect(scheme).toBe("light")
  })
})
