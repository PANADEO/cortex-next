// LUKA 2 i LUKA 3 projektu domknięte JEDNĄ bramką, wykonywaną PRZY ZAPISIE
// assetu fontu — nie przy każdym compose(). Koszt to trzy próbne rendery raz na
// wgranie pliku (~30 ms), zamiast podatku od każdego żądania.
//
// Czego istniejące bramki NIE łapią:
//   - assertFontFilesExist() sprawdza tylko existsSync(), więc plik uszkodzony,
//     ale ISTNIEJĄCY, renderuje się po cichu fontem zastępczym (LUKA 2 mówi
//     "brakujący LUB uszkodzony" — to była domknięta połowa),
//   - inspectFont() czyta nazwę rodziny fontkitem (name ID 1), a Pango rozwiązuje
//     rodzinę własną ścieżką. Rozjazd tych dwóch nazw = cicha podmiana kroju
//     przy poprawnym pliku (LUKA 3).
//
// Bramka ma DWIE części, bo dwie różne rzeczy da się udowodnić różnymi środkami:
//
// 1. STRUKTURA PLIKU (assertFontOutlinesUsable) — bez renderu, deterministycznie:
//    katalog tablic musi się mieścić w pliku, a podstawowe znaki muszą mieć
//    kontury. To jest właściwa odpowiedź na "uszkodzony, ale ISTNIEJĄCY plik",
//    bo sam render bywa zwodniczy: w Alpine obcięta Georgia wyrenderowała się
//    poprawnie, kiedy zdrowa kopia została w konfiguracji procesu z wcześniejszego
//    wgrania. Render tego nie odróżni, kontrola pliku owszem.
//
// 2. RENDER WERYFIKACYJNY — jedyne, co potrafi powiedzieć, czy silnik tekstu
//    faktycznie SIĘGA po ten plik pod zapisaną nazwą rodziny.
//
// Metoda części 2. Projekt proponował porównać render Z plikiem z renderem BEZ
// pliku i uznać identyczność za dowód, że plik został zignorowany. Zmierzyłem
// ten pomysł i NIE jest wiarygodny w żadną stronę:
//   - identyczność bez winy: font o tej samej nazwie bywa zainstalowany
//     w systemie, a raz wczytany plik zostaje w konfiguracji procesu,
//   - różnica bez zasługi: w obrazie Alpine render BEZ `fontfile` nie widzi
//     fontów aplikacyjnych w ogóle (wychodzi tofu 248x13), więc różni się
//     ZAWSZE — także wtedy, gdy silnik złożył tekst zupełnie innym krojem.
//
// Dlatego o werdykcie decyduje ATRYBUCJA METRYK, niezależna od stanu procesu:
// kilka ciągów próbnych renderujemy Z plikiem i porównujemy szerokości z tym,
// co wynika Z SAMEGO PLIKU (fontkit). Zmierzone: właściwy plik daje średni błąd
// 0,4–0,6%, cudzy krój pod tym samym opisem 5,3–5,9%. Ciągi wąskie
// ("iiiiiiiiii") i polskie wersaliki rozjeżdżają się najmocniej, stąd są
// w zestawie. Render kontrolny bez pliku zostaje, ale wyłącznie jako materiał
// do komunikatu błędu — nie jako podstawa decyzji.

import * as fontkit from "fontkit"
import { createHash } from "node:crypto"
import sharp from "sharp"
import { resolveFontLibraryEntry } from "./font-library"
import { pangoFontDescription } from "./pango"

/** Ciągi próbne dobrane pod ROZRÓŻNIALNOŚĆ krojów, nie pod urodę: pełne zdanie
 *  z diakrytykami, skrajnie szerokie i skrajnie wąskie znaki, cyfry i polskie
 *  wersaliki. Na dwóch ostatnich podmiana kroju rozjeżdża się najmocniej. */
const PROBE_TEXTS = [
  "Zażółć gęślą jaźń AWM 123",
  "MWMWMWMW",
  "iiiiiiiiii",
  "1234567890",
  "ĄĆĘŁŃÓŚŹŻ",
] as const
const PROBE_SIZE = 64
const PROBE_DPI = 72

/** Próg średniego błędu metryk. Zmierzone na tym samym zestawie: właściwy plik
 *  0,6% (macOS, Georgia), 0,4% (Alpine, Noto Sans); cudzy krój podstawiony pod
 *  ten sam opis — 5,9%. Trzy procent leży w środku tej przerwy, z zapasem na
 *  hinting i zaokrąglenia innej platformy. */
const MAX_MEAN_RELATIVE_DRIFT = 0.03

export type FontVerificationCode = "font-render-failed" | "font-not-applied"

export class FontVerificationError extends Error {
  readonly code: FontVerificationCode

  constructor(code: FontVerificationCode, message: string) {
    super(message)
    this.name = "FontVerificationError"
    this.code = code
  }
}

export interface FontProbe {
  width: number
  height: number
  opaquePixels: number
  /** Skrót surowych pikseli — dwa rendery równe co do bajta mają ten sam skrót. */
  digest: string
}

export type FontProbeRenderer = (options: {
  text: string
  description: string
  fontPath?: string
}) => Promise<FontProbe>

export const sharpFontProbeRenderer: FontProbeRenderer = async ({
  text,
  description,
  fontPath,
}) => {
  const { data, info } = await sharp({
    text: {
      text,
      font: description,
      ...(fontPath === undefined ? {} : { fontfile: fontPath }),
      rgba: true,
      dpi: PROBE_DPI,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })

  const raw = await sharp(data).raw().toBuffer()
  let opaquePixels = 0
  for (let index = 3; index < raw.length; index += 4) {
    if (raw[index]! > 0) opaquePixels += 1
  }

  return {
    width: info.width,
    height: info.height,
    opaquePixels,
    digest: createHash("sha256").update(raw).digest("hex"),
  }
}

/** Szerokość zasięgu tuszu danego tekstu wyliczona Z SAMEGO PLIKU — metryka
 *  odniesienia, niezależna od tego, co zrobił silnik tekstu. */
export function predictProbeInkWidth(bytes: Buffer, text: string = PROBE_TEXTS[0]): number {
  const font = fontkit.create(bytes)
  if (!("layout" in font) || typeof font.layout !== "function") {
    throw new Error("plik nie jest pojedynczym krojem")
  }

  const run = font.layout(text)
  const scale = PROBE_SIZE / font.unitsPerEm
  let pen = 0
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY

  for (const glyph of run.glyphs) {
    const box = glyph.bbox
    if (box && Number.isFinite(box.minX) && Number.isFinite(box.maxX)) {
      minX = Math.min(minX, pen + box.minX)
      maxX = Math.max(maxX, pen + box.maxX)
    }
    pen += glyph.advanceWidth
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    throw new Error("plik nie ma metryk glifów")
  }
  return (maxX - minX) * scale
}

/** TĄ SAMĄ funkcją co produkcyjny render (composer.ts) — inaczej bramka
 *  mierzyłaby inny opis, niż pojedzie w kafelku, i mogłaby przepuścić font,
 *  który w produkcji złoży się cudzym krojem. Patrz pango.ts. */
function probeDescription(family: string, bold: boolean): string {
  return pangoFontDescription({ family, bold, size: PROBE_SIZE })
}

/** Znaki, których kontury muszą być w pliku. Podstawowa łacina, bo polskie
 *  pokrycie sprawdza już inspectFont, a te znaki ma każdy używalny krój. */
const OUTLINE_SAMPLE = "AZagj019"

/**
 * Deterministyczna kontrola, czy plik W OGÓLE ma z czego narysować tekst —
 * bez renderowania, więc bez zależności od tego, jakie fonty zdążył wczytać
 * proces. To ona domyka "uszkodzony, ale ISTNIEJĄCY plik": sam render potrafi
 * wyjść poprawnie, jeśli w konfiguracji procesu został zdrowy plik z
 * wcześniejszego wgrania (zmierzone w Alpine na obciętej Georgii).
 */
export function assertFontOutlinesUsable(bytes: Buffer): void {
  const corrupt = (reason: string) =>
    new FontVerificationError(
      "font-render-failed",
      `Plik fontu jest uszkodzony: ${reason}. Wgraj kompletny plik .ttf lub .otf.`,
    )

  if (bytes.length < 12) throw corrupt("plik jest krótszy niż nagłówek fontu")
  const tableCount = bytes.readUInt16BE(4)
  if (tableCount === 0 || 12 + tableCount * 16 > bytes.length) {
    throw corrupt("uszkodzony katalog tablic")
  }

  // Tablica wykraczająca poza koniec pliku to obcięcie — łapie nawet ucięcie
  // ostatniego procenta, którego fontkit sam nie zauważa.
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16
    const tag = bytes.toString("latin1", record, record + 4).trim()
    const offset = bytes.readUInt32BE(record + 8)
    const length = bytes.readUInt32BE(record + 12)
    if (offset + length > bytes.length) {
      throw corrupt(`tablica ${tag} wykracza poza koniec pliku (plik jest obcięty)`)
    }
  }

  let font: ReturnType<typeof fontkit.create>
  try {
    font = fontkit.create(bytes)
  } catch (error) {
    throw corrupt(error instanceof Error ? error.message : String(error))
  }

  if (!("glyphForCodePoint" in font) || typeof font.glyphForCodePoint !== "function") {
    throw corrupt("plik nie udostępnia pojedynczego kroju")
  }

  let checked = 0
  for (const character of OUTLINE_SAMPLE) {
    const codePoint = character.codePointAt(0)!
    if (!font.hasGlyphForCodePoint(codePoint)) continue
    checked += 1
    if (font.glyphForCodePoint(codePoint).path.commands.length === 0) {
      throw corrupt(`znak "${character}" nie ma konturu`)
    }
  }
  if (checked === 0) throw corrupt("plik nie zawiera podstawowych znaków łacińskich")
}

export interface FontVerificationInput {
  /** Bajty wgranego pliku — źródło metryki odniesienia. */
  bytes: Buffer
  /** Nazwa rodziny, którą zapiszemy i którą pójdzie opis Pango. */
  family: string
  /** Zmaterializowana ścieżka tego samego pliku (sharp bierze wyłącznie ścieżkę). */
  fontPath: string
  /** Czy asset pojedzie w renderze jako odmiana pogrubiona. */
  bold: boolean
}

/**
 * Rzuca FontVerificationError, jeśli render tekstu tym plikiem nie da się
 * przypisać do wgranego pliku. Milczenie = plik faktycznie renderuje.
 */
export async function verifyFontRendering(
  input: FontVerificationInput,
  renderer: FontProbeRenderer = sharpFontProbeRenderer,
): Promise<void> {
  assertFontOutlinesUsable(input.bytes)

  await primeCompetingFamilies(renderer)
  const description = probeDescription(input.family, input.bold)

  let applied: FontProbe
  try {
    applied = await renderer({ text: PROBE_TEXTS[0], description, fontPath: input.fontPath })
  } catch (error) {
    throw new FontVerificationError(
      "font-render-failed",
      `Nie udało się wyrenderować tekstu wgranym fontem: ${
        error instanceof Error ? error.message : String(error)
      }. Plik jest uszkodzony — wgraj poprawny .ttf lub .otf.`,
    )
  }

  if (applied.opaquePixels === 0) {
    throw new FontVerificationError(
      "font-render-failed",
      "Render tekstu wgranym fontem wyszedł pusty — plik jest uszkodzony. " +
        "Wgraj poprawny .ttf lub .otf.",
    )
  }

  const drift = await measureMetricDrift(input, description, applied, renderer)
  if (drift.mean <= MAX_MEAN_RELATIVE_DRIFT) return

  const control = await renderer({ text: PROBE_TEXTS[0], description })
  const ignoredEntirely =
    control.digest === applied.digest
      ? " Render bez wskazania pliku wychodzi identycznie, czyli plik nie zmienia niczego."
      : ""

  throw new FontVerificationError(
    "font-not-applied",
    `Render nie użył wgranego pliku — tekst złożył się innym krojem ` +
      `(metryki rozjeżdżają się średnio o ${(drift.mean * 100).toFixed(1)}%, ` +
      `najgorszy ciąg próbny: ${drift.worstRendered} px zamiast ${drift.worstPredicted} px). ` +
      `Nazwa rodziny "${input.family}" odczytana z pliku nie zgadza się z tym, ` +
      `czym silnik tekstu rozwiązuje tę rodzinę.${ignoredEntirely} ` +
      `Ilustromat nie zapisuje fontu, którego nie potrafi wyrenderować — ` +
      `kafelek wyszedłby "prawie dobry".`,
  )
}

/**
 * Wczytuje do procesu fonty biblioteki, ZANIM zmierzymy plik użytkownika.
 * Powód jest zmierzony: w obrazie bez systemowych fontów wgrany plik bywa
 * jedynym kandydatem, więc silnik tekstu rozwiązuje NA NIEGO nawet zupełnie
 * zmyśloną nazwę rodziny — i rozjazd nazwy przechodzi niezauważony. Przy
 * realnej konkurencji krojów ten sam plik pod cudzą nazwą jest odrzucany
 * (sprawdzone w Alpine na Georgii). Błąd rozgrzewki jest nieistotny: to tylko
 * ustawienie warunków pomiaru, nie sam pomiar.
 */
async function primeCompetingFamilies(renderer: FontProbeRenderer): Promise<void> {
  const entry = resolveFontLibraryEntry(null)
  for (const [fontPath, bold] of [
    [entry.regularPath, false],
    [entry.boldPath, true],
  ] as const) {
    try {
      await renderer({
        text: PROBE_TEXTS[0],
        description: probeDescription(entry.family, bold),
        fontPath,
      })
    } catch {
      // brak pliku biblioteki nie może blokować wgrywania własnego fontu
    }
  }
}

interface MetricDrift {
  mean: number
  worstRendered: number
  worstPredicted: number
}

/** Średni względny rozjazd szerokości renderu wobec metryk WGRANEGO PLIKU.
 *  Nie używa renderu bez `fontfile`, więc nie da się go zafałszować ani
 *  systemowym fontem o tej samej nazwie, ani plikiem, który został
 *  w konfiguracji procesu po wcześniejszym renderze. */
async function measureMetricDrift(
  input: FontVerificationInput,
  description: string,
  applied: FontProbe,
  renderer: FontProbeRenderer,
): Promise<MetricDrift> {
  let sum = 0
  let worst = { relative: -1, rendered: 0, predicted: 0 }

  for (const [index, text] of PROBE_TEXTS.entries()) {
    let predicted: number
    try {
      predicted = predictProbeInkWidth(input.bytes, text)
    } catch (error) {
      throw new FontVerificationError(
        "font-render-failed",
        `Nie da się odczytać metryk wgranego pliku (${
          error instanceof Error ? error.message : String(error)
        }), więc nie ma jak potwierdzić, że to on się renderuje. Plik jest uszkodzony.`,
      )
    }

    const probe =
      index === 0 ? applied : await renderer({ text, description, fontPath: input.fontPath })
    const relative = Math.abs(probe.width - predicted) / predicted
    sum += relative
    if (relative > worst.relative) {
      worst = { relative, rendered: probe.width, predicted: Math.round(predicted) }
    }
  }

  return {
    mean: sum / PROBE_TEXTS.length,
    worstRendered: worst.rendered,
    worstPredicted: worst.predicted,
  }
}

let fontFileSupport: Promise<boolean> | null = null

/**
 * Czy TO środowisko w ogóle stosuje własne pliki fontów. Sprawdzane fontem
 * biblioteki, który jedzie razem z obrazem, więc odpowiedź nie zależy od tego,
 * co wgrał użytkownik. Bez pakietu fontconfig (LUKA 5 projektu) sharp ignoruje
 * `fontfile` w całości i KAŻDY render idzie fontem zastępczym — wtedy odmowa
 * zapisu nie jest winą wgranego pliku i komunikat musi to rozróżniać.
 * Wynik jest zapamiętywany na proces: to własność środowiska, nie żądania.
 */
export function supportsFontFiles(
  renderer: FontProbeRenderer = sharpFontProbeRenderer,
): Promise<boolean> {
  fontFileSupport ??= (async () => {
    const entry = resolveFontLibraryEntry(null)
    const { readFile } = await import("node:fs/promises")
    try {
      const bytes = await readFile(entry.regularPath)
      await verifyFontRendering(
        { bytes, family: entry.family, fontPath: entry.regularPath, bold: false },
        renderer,
      )
      return true
    } catch {
      return false
    }
  })()
  return fontFileSupport
}

/** Wyłącznie dla testów — pamięć wyniku przeżywa import modułu. */
export function clearFontFileSupportMemo(): void {
  fontFileSupport = null
}
