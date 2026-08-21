// Bramka renderu weryfikacyjnego — LUKA 2 (plik uszkodzony, ale ISTNIEJĄCY)
// i LUKA 3 (rozjazd nazwy rodziny) domknięte razem przy zapisie assetu.
//
// Podział testów jest celowy:
//   - logika werdyktu jedzie na WSTRZYKNIĘTYM rendererze, więc jest
//     deterministyczna niezależnie od tego, jakie fonty ma maszyna,
//   - próby ŻYWE (prawdziwy sharp) odtwarzają dowody recenzenta i sprawdzają,
//     że werdykt zgadza się z tym, co środowisko realnie potrafi.

import { readFileSync } from "node:fs"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { resolveFontLibraryEntry } from "./font-library"
import {
  FontVerificationError,
  assertFontOutlinesUsable,
  clearFontFileSupportMemo,
  predictProbeInkWidth,
  supportsFontFiles,
  verifyFontRendering,
  type FontProbe,
  type FontProbeRenderer,
} from "./font-verification"
import { pangoFontDescription } from "./pango"

const entry = resolveFontLibraryEntry(null)
let notoBytes: Buffer

beforeAll(() => {
  notoBytes = readFileSync(entry.regularPath)
})

afterEach(() => {
  clearFontFileSupportMemo()
})

function probe(width: number, digest: string, opaquePixels = 1000): FontProbe {
  return { width, height: 64, opaquePixels, digest }
}

/**
 * Renderer sterowany scenariuszem. `widthFor` udaje metryki, które silnik
 * tekstu zwróciłby dla danego ciągu — dzięki temu "plik został użyty" i
 * "podstawiono inny krój" różnią się w teście dokładnie tym, czym różnią się
 * na produkcji: szerokościami, a nie zmyśloną flagą.
 */
function scriptedRenderer(script: {
  appliedError?: Error
  appliedDigest: string
  controlDigest: string
  widthFor: (text: string) => number
  opaquePixels?: number
}): FontProbeRenderer {
  return async ({ text, fontPath }) => {
    if (fontPath === undefined) return probe(script.widthFor(text), script.controlDigest)
    if (script.appliedError) throw script.appliedError
    return probe(script.widthFor(text), script.appliedDigest, script.opaquePixels ?? 1000)
  }
}

/** Metryki takie, jakie daje realnie użyty wgrany plik. */
const widthFromFile = (text: string) => Math.round(predictProbeInkWidth(notoBytes, text))

const input = () => ({
  bytes: notoBytes,
  family: entry.family,
  fontPath: entry.regularPath,
  bold: false,
})

describe("verifyFontRendering() — werdykt na wstrzykniętym rendererze", () => {
  it("odrzuca, gdy render tym plikiem rzuca wyjątkiem (plik uszkodzony)", async () => {
    const renderer = scriptedRenderer({
      appliedError: new Error("unable to load font"),
      appliedDigest: "z-plikiem",
      controlDigest: "bez-pliku",
      widthFor: widthFromFile,
    })

    await expect(verifyFontRendering(input(), renderer)).rejects.toMatchObject({
      name: "FontVerificationError",
      code: "font-render-failed",
    })
  })

  it("odrzuca, gdy render tym plikiem wychodzi pusty", async () => {
    const renderer = scriptedRenderer({
      appliedDigest: "z-plikiem",
      controlDigest: "bez-pliku",
      widthFor: widthFromFile,
      opaquePixels: 0,
    })

    await expect(verifyFontRendering(input(), renderer)).rejects.toMatchObject({
      code: "font-render-failed",
    })
  })

  it("NIE przyjmuje pliku tylko dlatego, że render z nim różni się od renderu bez niego", async () => {
    // Kryterium z projektu ("różnica dowodzi, że plik został użyty") jest
    // zwodnicze: zmierzone w Alpine, render BEZ `fontfile` nie widzi fontów
    // aplikacyjnych w ogóle, więc różni się ZAWSZE — także gdy silnik złożył
    // tekst cudzym krojem. Ten test pilnuje, żeby skrót nie wrócił.
    const renderer = scriptedRenderer({
      appliedDigest: "z-plikiem",
      controlDigest: "bez-pliku",
      widthFor: (text) => Math.round(widthFromFile(text) * 1.2),
    })

    await expect(verifyFontRendering(input(), renderer)).rejects.toMatchObject({
      code: "font-not-applied",
    })
  })

  it("przepuszcza render nieodróżnialny od kontrolnego, gdy metryki są metrykami TEGO pliku", async () => {
    // Dwa zmierzone powody fałszywej równości: font o tej samej nazwie
    // zainstalowany w systemie oraz plik, który został w konfiguracji procesu
    // po wcześniejszym renderze (Alpine). Bez tej gałęzi ponowne wgranie
    // poprawnego fontu dostawałoby 400.
    const renderer = scriptedRenderer({
      appliedDigest: "identyczny",
      controlDigest: "identyczny",
      widthFor: widthFromFile,
    })

    await expect(verifyFontRendering(input(), renderer)).resolves.toBeUndefined()
  })

  it("znosi drobny rozjazd metryk (hinting innej platformy)", async () => {
    const renderer = scriptedRenderer({
      appliedDigest: "identyczny",
      controlDigest: "identyczny",
      widthFor: (text) => Math.round(widthFromFile(text) * 1.015),
    })

    await expect(verifyFontRendering(input(), renderer)).resolves.toBeUndefined()
  })

  it("ODRZUCA cichą podmianę kroju: render nieodróżnialny od kontrolnego i o cudzych metrykach", async () => {
    // Dowód recenzenta (B2): poprawny plik + rodzina, której silnik tekstu nie
    // rozwiązuje na ten plik => 200 i tekst złożony bezszeryfowym zastępnikiem.
    const renderer = scriptedRenderer({
      appliedDigest: "identyczny",
      controlDigest: "identyczny",
      widthFor: (text) => Math.round(widthFromFile(text) * 1.06),
    })

    await expect(verifyFontRendering(input(), renderer)).rejects.toMatchObject({
      code: "font-not-applied",
    })
  })

  it("odrzuca, gdy z pliku nie da się wyliczyć metryk odniesienia", async () => {
    const renderer = scriptedRenderer({
      appliedDigest: "identyczny",
      controlDigest: "identyczny",
      widthFor: () => 787,
    })

    await expect(
      verifyFontRendering({ ...input(), bytes: Buffer.alloc(400, 0x41) }, renderer),
    ).rejects.toMatchObject({ code: "font-render-failed" })
  })

  it("dla assetu pogrubionego pyta silnik o odmianę Bold", async () => {
    const custom = "/tmp/wlasny-font.ttf"
    const descriptions: string[] = []
    const renderer: FontProbeRenderer = async ({ text, description, fontPath }) => {
      if (fontPath === custom) descriptions.push(description)
      return probe(widthFromFile(text), fontPath === undefined ? "bez-pliku" : "z-plikiem")
    }

    await verifyFontRendering({ ...input(), fontPath: custom, bold: true }, renderer)
    expect(descriptions[0]).toBe(`${entry.family}, Bold 64`)
  })

  it.each(["Times New Roman", "Arial Black", "Gotham Book", "Georgia"])(
    "mierzy rodzinę %s tym samym opisem, którym pojedzie render — bez obcięcia przez Pango",
    async (family) => {
      // Bramka ma sens tylko wtedy, gdy pyta silnik DOKŁADNIE o to, o co potem
      // zapyta compose(). Rodziny kończące się słowem kluczowym Pango
      // (Roman, Black, Book) sprawdzały się do tej pory pod obciętą nazwą —
      // czyli bramka mierzyła coś innego, niż zobaczy klient.
      const custom = "/tmp/wlasny-font.ttf"
      const descriptions: string[] = []
      const renderer: FontProbeRenderer = async ({ text, description, fontPath }) => {
        if (fontPath === custom) descriptions.push(description)
        return probe(widthFromFile(text), fontPath === undefined ? "bez-pliku" : "z-plikiem")
      }

      await verifyFontRendering({ ...input(), family, fontPath: custom }, renderer)

      expect(descriptions.length).toBeGreaterThan(0)
      for (const description of descriptions) {
        expect(description).toBe(pangoFontDescription({ family, bold: false, size: 64 }))
        expect(description.split(",")[0]).toBe(family)
      }
    },
  )

  it("odrzuca plik uszkodzony strukturalnie ZANIM cokolwiek wyrenderuje", async () => {
    // Kontrola pliku musi być pierwsza i musi wystarczyć sama: w Alpine render
    // obciętego pliku potrafi wyjść poprawnie, bo zdrowa kopia została
    // w konfiguracji procesu z wcześniejszego wgrania. Renderer, który tu
    // wybuchnie, dowodzi, że werdykt zapadł bez niego.
    const calls: string[] = []
    const countingRenderer: FontProbeRenderer = async ({ text, fontPath }) => {
      calls.push(text)
      return probe(widthFromFile(text), fontPath === undefined ? "bez-pliku" : "z-plikiem")
    }

    await expect(
      verifyFontRendering(
        { ...input(), bytes: notoBytes.subarray(0, Math.floor(notoBytes.length * 0.99)) },
        countingRenderer,
      ),
    ).rejects.toThrow(/wykracza poza koniec pliku/)
    expect(calls).toEqual([])
  })

  it("przed pomiarem wczytuje fonty biblioteki, żeby wgrany plik nie był jedynym kandydatem", async () => {
    // Bez konkurencji krojów silnik tekstu rozwiązuje na wgrany plik nawet
    // zmyśloną nazwę rodziny — zmierzone w obrazie Alpine.
    const custom = "/tmp/wlasny-font.ttf"
    const primed: string[] = []
    const renderer: FontProbeRenderer = async ({ text, fontPath }) => {
      if (fontPath !== undefined && fontPath !== custom) primed.push(fontPath)
      return probe(widthFromFile(text), fontPath === undefined ? "bez-pliku" : "z-plikiem")
    }

    await verifyFontRendering({ ...input(), fontPath: custom }, renderer)
    expect(primed).toEqual([entry.regularPath, entry.boldPath])
  })
})

describe("assertFontOutlinesUsable() — kontrola pliku bez renderu", () => {
  /** Zeruje zawartość tablicy, zostawiając katalog tablic nietknięty: plik dalej
   *  parsuje się i deklaruje pokrycie znaków, ale nie ma z czego rysować. */
  function zeroFontTable(font: Buffer, tag: string): Buffer {
    const out = Buffer.from(font)
    const tableCount = out.readUInt16BE(4)
    for (let index = 0; index < tableCount; index += 1) {
      const record = 12 + index * 16
      if (out.toString("latin1", record, record + 4) === tag) {
        const offset = out.readUInt32BE(record + 8)
        out.fill(0, offset, offset + out.readUInt32BE(record + 12))
        return out
      }
    }
    throw new Error(`brak tablicy ${tag}`)
  }

  it("przepuszcza zdrowy plik", () => {
    expect(() => assertFontOutlinesUsable(notoBytes)).not.toThrow()
  })

  it("odrzuca plik obcięty o ostatni procent", () => {
    // Obcięcie, którego fontkit sam nie zauważa: nagłówek, name i cmap są całe,
    // więc inspectFont przepuszcza taki plik do bazy.
    const almostComplete = notoBytes.subarray(0, Math.floor(notoBytes.length * 0.99))
    expect(() => assertFontOutlinesUsable(almostComplete)).toThrow(FontVerificationError)
  })

  it("odrzuca plik z wyzerowanymi konturami glifów", () => {
    expect(() => assertFontOutlinesUsable(zeroFontTable(notoBytes, "glyf"))).toThrow(
      /nie ma konturu/,
    )
  })

  it("odrzuca śmieć", () => {
    expect(() => assertFontOutlinesUsable(Buffer.alloc(400, 0x41))).toThrow(FontVerificationError)
  })
})

describe("verifyFontRendering() — próby żywe na prawdziwym sharpie", () => {
  it("odrzuca poprawny plik zadeklarowany pod cudzą nazwą rodziny", async () => {
    // Dokładnie dowód B2 recenzenta, tylko wykonany przy ZAPISIE, a nie po nim:
    // plik jest w porządku, ale rodzina wskazuje na coś, czego nie ma.
    await expect(
      verifyFontRendering({
        bytes: notoBytes,
        family: "Nieistniejaca Rodzina XYZ",
        fontPath: entry.regularPath,
        bold: false,
      }),
    ).rejects.toMatchObject({ code: "font-not-applied" })
  })

  it("odrzuca plik obcięty w połowie", async () => {
    const truncated = notoBytes.subarray(0, Math.floor(notoBytes.length / 2))
    await expect(
      verifyFontRendering({
        bytes: truncated,
        family: entry.family,
        fontPath: entry.regularPath,
        bold: false,
      }),
    ).rejects.toBeInstanceOf(FontVerificationError)
  })

  it("werdykt dla poprawnego fontu zgadza się z tym, czy środowisko stosuje pliki fontów", async () => {
    // Zmierzone na macOS arm64: sharp 0.34.5 IGNORUJE `fontfile` w całości,
    // więc poprawny font jest tu odrzucany — i słusznie, bo w tym środowisku
    // szablon renderowałby się Helveticą. W obrazie Alpine z fontconfig ten sam
    // plik przechodzi. Test asertuje tę zależność, zamiast zamrażać jeden wynik.
    const applies = await supportsFontFiles()
    const verdict = await verifyFontRendering(input()).then(
      () => "przyjety" as const,
      (error: unknown) => (error as FontVerificationError).code,
    )

    if (applies) {
      expect(verdict).toBe("przyjety")
    } else {
      expect(verdict).toBe("font-not-applied")
    }
  })
})
