// Kryterium odbioru composera to KONTRAKT NIEZMIENNIKÓW LAYOUTU, nigdy
// pixel-diff względem Pillow. Powód jest zmierzony, nie teoretyczny: zawijanie
// robi Pango, nie greedy-wrap z PoC, więc wysokość bloku tekstu różni się
// o ~8% (Pillow 165 px vs Pango 152 px na tym samym tekście i foncie).
// Asertowanie bajtów zamrażałoby tę różnicę jako "błąd", którym nie jest.
//
// Co więc jest sprawdzane: to, co obiecuje produkt — polskie znaki się
// renderują, pole obrazu nigdy nie schodzi poniżej min_image_area_ratio,
// tekst nie wychodzi poza content_width, pasek dolny i logo są na swoich
// miejscach, a brakujący plik fontu WYWALA render zamiast go po cichu podmienić.

import { copyFileSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import sharp from "sharp"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { parseHexColor } from "./color"
import { COMPOSER_CONSTANTS, MissingFontFileError, compose, type ComposeFonts } from "./composer"
import { resolveFontLibraryEntry } from "./font-library"
import { sampleGradientImage } from "./gradient"
import { LINK_FORMAT, PORTRAIT_FORMAT, SQUARE_FORMAT } from "./presets"
import type { FrameTemplate } from "./types"

/**
 * Opisy fontu, które compose() FAKTYCZNIE podał silnikowi tekstu. To jedyny
 * deterministyczny sposób sprawdzenia tej warstwy: skutek złego opisu widać
 * wyłącznie w rozwiązanej rodzinie, a na macOS `fontfile` jest ignorowany
 * w całości (backend CoreText), więc porównanie pikseli nie dowiodłoby tu
 * niczego. Sam sharp zostaje prawdziwy — mock tylko podsłuchuje wejście.
 */
const { fontDescriptions } = vi.hoisted(() => ({ fontDescriptions: [] as string[] }))

vi.mock("sharp", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown> & {
    default: (input?: unknown, options?: unknown) => unknown
  }
  const original = actual.default
  const wrapped = (input?: unknown, options?: unknown) => {
    const text = (input as { text?: { font?: unknown } } | undefined)?.text
    if (typeof text?.font === "string") fontDescriptions.push(text.font)
    return original(input, options)
  }
  return { ...actual, default: Object.assign(wrapped, original) }
})

const { PADDING, BOTTOM_BAR_HEIGHT } = COMPOSER_CONSTANTS

const VIOLET: FrameTemplate = {
  id: "crido-violet",
  name: "Crido — fioletowa (domyślna)",
  colorBg: "#5B3DA8",
  colorText: "#FFFFFF",
  colorAccent: "#FF8C42",
  fontSource: "library",
  fontLibraryId: "noto-sans",
  logoPosition: "bottom-right",
  cornerRadius: 28,
  minImageAreaRatio: 0.45,
  websiteText: "crido.pl",
  layout: "image-top",
  textAlign: "left",
  isActive: true,
  createdBy: "system",
}

const POLISH_TITLE = "Zmiany w cenach transferowych — zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ"
const SUBTITLE = "Co musisz wiedzieć zanim przepisy wejdą w życie"

let fonts: ComposeFonts
let background: Buffer

beforeAll(async () => {
  const entry = resolveFontLibraryEntry("noto-sans")
  fonts = { family: entry.family, regularPath: entry.regularPath, boldPath: entry.boldPath }
  background = await sampleGradientImage({ width: 1200, height: 1200, seed: "test" })
})

/** Ile nieprzezroczystych pikseli danego koloru jest w prostokącie — służy do
 *  sprawdzania, że coś FAKTYCZNIE zostało narysowane tam, gdzie obiecujemy. */
async function regionStats(image: Buffer, region: sharp.Region) {
  const { data, info } = await sharp(image)
    .extract(region)
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, channels: info.channels, pixels: info.width * info.height }
}

function isNear(actual: number, expected: number, tolerance = 12): boolean {
  return Math.abs(actual - expected) <= tolerance
}

describe("compose() — kontrakt layoutu", () => {
  it("zwraca PNG dokładnie w wymiarach wybranego formatu", async () => {
    for (const format of [SQUARE_FORMAT, PORTRAIT_FORMAT, LINK_FORMAT]) {
      const output = await compose({
        background,
        title: POLISH_TITLE,
        subtitle: SUBTITLE,
        format,
        template: VIOLET,
        fonts,
      })
      const meta = await sharp(output).metadata()
      expect(meta.format).toBe("png")
      expect(meta.width).toBe(format.width)
      expect(meta.height).toBe(format.height)
    }
  })

  it("REQ-03: pole obrazu nigdy nie schodzi poniżej min_image_area_ratio", async () => {
    // Skrajnie długi tekst (limit 140/200 znaków) — właśnie tu pętla
    // zmniejszania fontu może chcieć oddać obrazowi za mało miejsca.
    const output = await compose({
      background,
      title: "A".repeat(140).replace(/(.{7})/g, "$1 "),
      subtitle: "B".repeat(200).replace(/(.{7})/g, "$1 "),
      format: SQUARE_FORMAT,
      template: VIOLET,
      fonts,
    })

    const minHeight = Math.trunc(SQUARE_FORMAT.height * VIOLET.minImageAreaRatio)
    // Pole obrazu zaczyna się na PADDING i ma szerokość content_width; próbka
    // z jego środka nie może być kolorem tła szablonu (czyli obraz tam JEST).
    const probe = await regionStats(output, {
      left: PADDING + 20,
      top: PADDING + Math.trunc(minHeight / 2),
      width: 40,
      height: 40,
    })
    const bg = parseHexColor(VIOLET.colorBg)
    let backgroundPixels = 0
    for (let i = 0; i < probe.data.length; i += probe.channels) {
      if (
        isNear(probe.data[i]!, bg.r, 6) &&
        isNear(probe.data[i + 1]!, bg.g, 6) &&
        isNear(probe.data[i + 2]!, bg.b, 6)
      ) {
        backgroundPixels += 1
      }
    }
    expect(backgroundPixels / probe.pixels).toBeLessThan(0.1)
  })

  it("REQ-02: polskie znaki renderują się (nie są pustymi glifami)", async () => {
    const onlyPolish = await compose({
      background,
      title: "ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ",
      subtitle: "",
      format: SQUARE_FORMAT,
      template: { ...VIOLET, layout: "image-bottom" },
      fonts,
    })

    // Układ image-bottom: tekst zaczyna się na PADDING. Biały tekst na
    // fioletowym tle — liczymy jasne piksele w pasie tytułu.
    const probe = await regionStats(onlyPolish, {
      left: PADDING,
      top: PADDING,
      width: SQUARE_FORMAT.width - 2 * PADDING,
      height: 60,
    })
    let brightPixels = 0
    for (let i = 0; i < probe.data.length; i += probe.channels) {
      if (probe.data[i]! > 200 && probe.data[i + 1]! > 200 && probe.data[i + 2]! > 200) {
        brightPixels += 1
      }
    }
    expect(brightPixels).toBeGreaterThan(500)
  })

  it("tekst nie wychodzi poza content_width nawet dla nierozdzielnego słowa", async () => {
    // Pillow (i PoC) pozwala takiemu słowu wyjechać poza kafelek; port łamie je
    // wewnątrz wyrazu (wrap "word-char"). Marginesy muszą zostać czyste.
    const output = await compose({
      background,
      title: "Niepodzielnysuperdlugiwyrazktoregoniedasiezlamacwzadensposobwogole",
      subtitle: "",
      format: SQUARE_FORMAT,
      template: { ...VIOLET, layout: "image-bottom" },
      fonts,
    })

    const bg = parseHexColor(VIOLET.colorBg)
    // Lewy margines (0..PADDING) w pasie tekstu ma być czystym tłem szablonu.
    for (const left of [0, SQUARE_FORMAT.width - PADDING]) {
      const probe = await regionStats(output, { left, top: PADDING, width: PADDING, height: 120 })
      let nonBackground = 0
      for (let i = 0; i < probe.data.length; i += probe.channels) {
        if (
          !isNear(probe.data[i]!, bg.r, 8) ||
          !isNear(probe.data[i + 1]!, bg.g, 8) ||
          !isNear(probe.data[i + 2]!, bg.b, 8)
        ) {
          nonBackground += 1
        }
      }
      expect(nonBackground).toBe(0)
    }
  })

  it("pasek dolny jest przyciemnionym tłem szablonu i zajmuje dokładnie swoją wysokość", async () => {
    const output = await compose({
      background,
      title: POLISH_TITLE,
      subtitle: SUBTITLE,
      format: SQUARE_FORMAT,
      template: VIOLET,
      fonts,
    })

    // Środek paska, z dala od logo i tekstu strony.
    const probe = await regionStats(output, {
      left: Math.trunc(SQUARE_FORMAT.width / 2) - 20,
      top: SQUARE_FORMAT.height - BOTTOM_BAR_HEIGHT + 20,
      width: 40,
      height: 20,
    })
    const bg = parseHexColor(VIOLET.colorBg)
    const expected = {
      r: Math.trunc(bg.r * 0.65),
      g: Math.trunc(bg.g * 0.65),
      b: Math.trunc(bg.b * 0.65),
    }
    expect(isNear(probe.data[0]!, expected.r, 3)).toBe(true)
    expect(isNear(probe.data[1]!, expected.g, 3)).toBe(true)
    expect(isNear(probe.data[2]!, expected.b, 3)).toBe(true)
  })

  it("monogram trafia na stronę wskazaną przez logo_position", async () => {
    const accent = parseHexColor(VIOLET.colorAccent)
    const countAccent = async (image: Buffer, left: number) => {
      const probe = await regionStats(image, {
        left,
        top: SQUARE_FORMAT.height - BOTTOM_BAR_HEIGHT,
        width: PADDING + 40,
        height: BOTTOM_BAR_HEIGHT,
      })
      let hits = 0
      for (let i = 0; i < probe.data.length; i += probe.channels) {
        if (
          isNear(probe.data[i]!, accent.r, 20) &&
          isNear(probe.data[i + 1]!, accent.g, 20) &&
          isNear(probe.data[i + 2]!, accent.b, 20)
        ) {
          hits += 1
        }
      }
      return hits
    }

    const right = await compose({
      background,
      title: "Tytuł",
      subtitle: "",
      format: SQUARE_FORMAT,
      template: { ...VIOLET, logoPosition: "bottom-right" },
      fonts,
    })
    const left = await compose({
      background,
      title: "Tytuł",
      subtitle: "",
      format: SQUARE_FORMAT,
      template: { ...VIOLET, logoPosition: "bottom-left" },
      fonts,
    })

    expect(await countAccent(right, SQUARE_FORMAT.width - PADDING - 40)).toBeGreaterThan(500)
    expect(await countAccent(right, 0)).toBe(0)
    expect(await countAccent(left, 0)).toBeGreaterThan(500)
    expect(await countAccent(left, SQUARE_FORMAT.width - PADDING - 40)).toBe(0)
  })

  it("tekst strony nie nachodzi na logo przy logo_position=bottom-left", async () => {
    // Regresja na realny błąd PoC: w Pythonie tekst strony i monogram lądują
    // oba na x=_PADDING, więc przy logo z lewej nachodzą na siebie. Sprawdzamy
    // pas pod monogramem: obok kółka akcentu nie może być jasnego tekstu.
    const output = await compose({
      background,
      title: "Tytuł",
      subtitle: "",
      format: SQUARE_FORMAT,
      template: { ...VIOLET, logoPosition: "bottom-left", websiteText: "crido.pl" },
      fonts,
    })

    const accent = parseHexColor(VIOLET.colorAccent)
    const probe = await regionStats(output, {
      left: PADDING,
      top: SQUARE_FORMAT.height - BOTTOM_BAR_HEIGHT,
      width: 40,
      height: BOTTOM_BAR_HEIGHT,
    })

    // W obszarze monogramu dozwolone są tylko: kolor akcentu, kolor paska
    // i glif monogramu. Tekst strony (jasny, szeroki) tam nie należy —
    // gdyby nachodził, udział pikseli akcentu gwałtownie by spadł.
    let accentPixels = 0
    for (let i = 0; i < probe.data.length; i += probe.channels) {
      if (
        isNear(probe.data[i]!, accent.r, 20) &&
        isNear(probe.data[i + 1]!, accent.g, 20) &&
        isNear(probe.data[i + 2]!, accent.b, 20)
      ) {
        accentPixels += 1
      }
    }
    expect(accentPixels / probe.pixels).toBeGreaterThan(0.4)
  })

  it("oba układy dają inny obraz, ale ten sam rozmiar", async () => {
    const common = { background, title: POLISH_TITLE, subtitle: SUBTITLE, format: SQUARE_FORMAT, fonts }
    const top = await compose({ ...common, template: { ...VIOLET, layout: "image-top" } })
    const bottom = await compose({ ...common, template: { ...VIOLET, layout: "image-bottom" } })

    expect(top.equals(bottom)).toBe(false)
    const [a, b] = [await sharp(top).metadata(), await sharp(bottom).metadata()]
    expect(a.width).toBe(b.width)
    expect(a.height).toBe(b.height)
  })

  it("jest deterministyczny — to samo wejście daje bajt w bajt to samo wyjście", async () => {
    const input = {
      background,
      title: POLISH_TITLE,
      subtitle: SUBTITLE,
      format: SQUARE_FORMAT,
      template: VIOLET,
      fonts,
    }
    const first = await compose(input)
    const second = await compose(input)
    expect(first.equals(second)).toBe(true)
  })
})

describe("compose() — LUKA 2: brakujący plik fontu", () => {
  it("RZUCA zamiast renderować cicho fontem zastępczym", async () => {
    // To jest najgroźniejszy tryb awarii tego produktu: sharp z nieistniejącym
    // `fontfile` renderuje BEZ BŁĘDU czcionką systemową — kafelek wychodzi
    // "prawie dobry". Zweryfikowane osobno na żywo; tutaj pilnujemy, że nasza
    // bramka to zatrzymuje.
    const directory = mkdtempSync(path.join(tmpdir(), "ilustromat-font-test-"))
    const regularPath = path.join(directory, "regular.ttf")
    const boldPath = path.join(directory, "bold.ttf")
    const entry = resolveFontLibraryEntry("noto-sans")
    copyFileSync(entry.regularPath, regularPath)
    copyFileSync(entry.boldPath, boldPath)

    const withCopiedFonts: ComposeFonts = { family: entry.family, regularPath, boldPath }
    const input = {
      background,
      title: POLISH_TITLE,
      subtitle: SUBTITLE,
      format: SQUARE_FORMAT,
      template: { ...VIOLET, fontSource: "custom" as const, fontLibraryId: null },
      fonts: withCopiedFonts,
    }

    // Kontrola pozytywna: z plikami na miejscu render przechodzi.
    await expect(compose(input)).resolves.toBeInstanceOf(Buffer)

    // Usuwamy plik fontu spod nóg — render MUSI paść.
    rmSync(boldPath)
    await expect(compose(input)).rejects.toThrow(MissingFontFileError)

    rmSync(directory, { recursive: true, force: true })
  })

  it("komunikat błędu wskazuje konkretny brakujący plik", async () => {
    await expect(
      compose({
        background,
        title: "Tytuł",
        subtitle: "",
        format: SQUARE_FORMAT,
        template: VIOLET,
        fonts: { family: "Noto Sans", regularPath: "/nie/ma/regular.ttf", boldPath: "/nie/ma/bold.ttf" },
      }),
    ).rejects.toThrow("/nie/ma/regular.ttf")
  })
})

describe("compose() — LUKA 3: nazwa rodziny w opisie Pango", () => {
  /** Rodziny, których ostatnie słowo Pango rozpoznaje jako styl/wagę. Bez
   *  zakończenia listy rodzin przecinkiem opis "Times New Roman 44" znaczy dla
   *  Pango rodzinę "Times New" ze stylem Roman, a "Arial Black 44" rodzinę
   *  "Arial" z wagą Black — i kafelek wychodzi cudzym krojem, po cichu.
   *  Zmierzone w Alpine na tych samych plikach: 801 px zamiast 730 px (TNR),
   *  842 px zamiast 946 px (Arial Black). Georgia jest kontrolą. */
  const FAMILIES = ["Times New Roman", "Arial Black", "Gotham Book", "Georgia"] as const

  it.each(FAMILIES)("nie pozwala Pango obciąć rodziny %s", async (family) => {
    fontDescriptions.length = 0

    await compose({
      background,
      title: POLISH_TITLE,
      subtitle: SUBTITLE,
      format: SQUARE_FORMAT,
      template: { ...VIOLET, fontSource: "custom", fontLibraryId: null },
      fonts: { ...fonts, family },
    })

    expect(fontDescriptions.length).toBeGreaterThan(0)
    for (const description of fontDescriptions) {
      expect(description).toMatch(new RegExp(`^${family}, (Bold )?\\d+$`))
    }
  })
})
