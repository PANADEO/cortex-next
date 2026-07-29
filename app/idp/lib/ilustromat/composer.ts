// Krok 4 flow: kompozycja BEZ AI — port core/composer.py na sharp.
//
// Zero losowości: ramka, logo, kolory i tekst renderują się deterministycznie
// na wygenerowanym tle. Dlatego edycja tytułu/podtytułu nie wymaga nowej
// generacji (REQ-08) — compose() jest tanie i idempotentne.
//
// TWARDY WYMÓG PRODUKTU: ten moduł nie zna Next.js, HTTP ani bazy. Bierze
// bufory + FrameTemplate, zwraca bufor. To jedyna gwarancja, że kreator
// szablonów i produkcyjna generacja idą TĄ SAMĄ ścieżką renderowania (żadnego
// "w kreatorze wyglądało inaczej") i jedyny sposób na sensowne testy.
//
// Wierność względem Pillow: port jest WIERNY, nie pixel-identyczny. Zawijanie
// robi Pango (`width` + `wrap`), nie własny greedy-wrap, więc wysokość bloku
// tekstu różni się o ~8% (zmierzone: Pillow 165 px vs Pango 152 px na tym samym
// tekście). Kryterium odbioru to KONTRAKT LAYOUTU (polskie znaki, pole obrazu
// >= min_image_area_ratio, tekst w content_width, pasek i logo na miejscu),
// nigdy pixel-diff — patrz composer.test.ts.

import { existsSync } from "node:fs"
import sharp from "sharp"
import { darken, parseHexColor, readableOn, toHexColor } from "./color"
import { resolvePlacement } from "./layouts"
import { pangoFontDescription } from "./pango"
import type { FormatPreset } from "./presets"
import type { FrameTemplate } from "./types"

const PADDING = 56
const BOTTOM_BAR_HEIGHT = 64
const BASE_TITLE_SIZE = 44
const BASE_SUBTITLE_SIZE = 26
const DARKEN_FACTOR = 0.65
const LINE_GAP = 10
const TITLE_SUBTITLE_GAP = 16
const BAR_TEXT_SIZE = 22
const MONOGRAM_DIAMETER = 40
const LOGO_HEIGHT_RATIO = 0.6

/** Stopniowe kroki zmniejszania fontu (100%→60%), próbowane po kolei aż tekst
 *  zmieści się bez naruszania min_image_area_ratio. */
const SHRINK_STEPS = [1.0, 0.9, 0.8, 0.7, 0.6] as const

/** Renderowanie tekstu przy 72 DPI: rozmiar w punktach = rozmiar w px em
 *  u Pillow, czyli mapowanie rozmiarów fontu 1:1 z oryginałem. */
const TEXT_DPI = 72

export const COMPOSER_CONSTANTS = {
  PADDING,
  BOTTOM_BAR_HEIGHT,
  BASE_TITLE_SIZE,
  BASE_SUBTITLE_SIZE,
  SHRINK_STEPS,
} as const

export interface ComposeFonts {
  /** Nazwa rodziny DOKŁADNIE tak, jak widzi ją Pango (odczytana fontkitem —
   *  patrz glyph-coverage.ts). Rozjazd = Pango po cichu dobiera inny font. */
  family: string
  regularPath: string
  boldPath: string
}

export interface ComposeInput {
  background: Buffer
  title: string
  subtitle: string
  format: FormatPreset
  template: FrameTemplate
  fonts: ComposeFonts
  /** Znormalizowane PNG (patrz normalizeLogoToPng). Brak = rysowany monogram. */
  logo?: Buffer | null
}

export class MissingFontFileError extends Error {
  constructor(path: string) {
    super(
      `Plik fontu nie istnieje: ${path}. Render przerwany — Ilustromat nigdy nie ` +
        `renderuje fontem zastępczym, bo jedyną wartością produktu jest gwarancja brandu.`,
    )
    this.name = "MissingFontFileError"
  }
}

/**
 * LUKA 2 projektu, najgroźniejszy tryb awarii. Zweryfikowane na żywo:
 * `fontfile: "/nope/missing.ttf"` renderuje się CICHO fontem zastępczym — bez
 * wyjątku, bez ostrzeżenia. Kafelek wychodzi "prawie dobry", czyli dokładnie
 * to, czego klient chce uniknąć. PoC w Pythonie robi logger.warning + fallback
 * na bibliotekę; tutaj to zachowanie jest świadomie ZAOSTRZONE do twardego
 * błędu, nie skopiowane.
 */
function assertFontFilesExist(fonts: ComposeFonts): void {
  for (const path of [fonts.regularPath, fonts.boldPath]) {
    if (!existsSync(path)) throw new MissingFontFileError(path)
  }
}

/** Pango czyta treść jako markup, więc znaki składni muszą zostać uciekłe —
 *  inaczej tytuł z "&" albo "<" wywraca render albo znika. */
function escapePangoMarkup(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

interface RenderedText {
  buffer: Buffer
  width: number
  height: number
}

async function renderText(options: {
  text: string
  fonts: ComposeFonts
  bold: boolean
  size: number
  color: string
  maxWidth?: number
  align?: "left" | "centre"
}): Promise<RenderedText | null> {
  const { text, fonts, bold, size, color, maxWidth, align = "left" } = options
  if (!text.trim()) return null

  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}">${escapePangoMarkup(text)}</span>`,
      font: pangoFontDescription({ family: fonts.family, bold, size }),
      fontfile: bold ? fonts.boldPath : fonts.regularPath,
      rgba: true,
      dpi: TEXT_DPI,
      align,
      spacing: LINE_GAP,
      ...(maxWidth === undefined
        ? {}
        : {
            width: maxWidth,
            // "word-char" zamiast "word": dla normalnego tekstu daje wynik
            // IDENTYCZNY z "word" (zweryfikowane), ale pojedyncze bardzo długie
            // słowo łamie zamiast wyjść poza content_width. Pillow (i PoC)
            // takiego słowa nie łamie i pozwala mu wyjechać poza kafelek —
            // to zaostrzenie, nie kopia.
            wrap: "word-char" as const,
          }),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true })

  return { buffer: data, width: info.width, height: info.height }
}

interface TextBlock {
  title: RenderedText | null
  subtitle: RenderedText | null
  blockHeight: number
}

/** Liczy zawijanie i wysokość bloku tekstu. Ten sam wynik służy obu układom —
 *  budżet wysokości nie zależy od kolejności obraz/tekst, tylko od tego ILE
 *  miejsca zajmie tekst. */
async function layoutText(
  input: ComposeInput,
  contentWidth: number,
  titleSize: number,
  subtitleSize: number,
): Promise<TextBlock> {
  const align = input.template.textAlign === "center" ? "centre" : "left"
  const color = input.template.colorText

  const title = await renderText({
    text: input.title,
    fonts: input.fonts,
    bold: true,
    size: titleSize,
    color,
    maxWidth: contentWidth,
    align,
  })
  const subtitle = await renderText({
    text: input.subtitle,
    fonts: input.fonts,
    bold: false,
    size: subtitleSize,
    color,
    maxWidth: contentWidth,
    align,
  })

  let blockHeight = title?.height ?? 0
  if (subtitle) blockHeight += TITLE_SUBTITLE_GAP + subtitle.height

  return { title, subtitle, blockHeight }
}

function roundedMask(width: number, height: number, radius: number): Buffer {
  const clamped = Math.max(0, Math.min(radius, Math.floor(Math.min(width, height) / 2)))
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect x="0" y="0" width="${width}" height="${height}" rx="${clamped}" ry="${clamped}" fill="#fff"/>` +
      `</svg>`,
  )
}

/** Pasek dolny + ewentualne kółko monogramu jako JEDEN overlay SVG o rozmiarze
 *  paska — prościej niż w Pillow, gdzie to dwa osobne wywołania rysowania. */
function bottomBar(options: {
  width: number
  barColor: string
  monogram: { left: number; accent: string } | null
}): Buffer {
  const { width, barColor, monogram } = options
  const circle = monogram
    ? `<circle cx="${monogram.left + MONOGRAM_DIAMETER / 2}" cy="${BOTTOM_BAR_HEIGHT / 2}" ` +
      `r="${MONOGRAM_DIAMETER / 2}" fill="${monogram.accent}"/>`
    : ""
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${BOTTOM_BAR_HEIGHT}">` +
      `<rect x="0" y="0" width="${width}" height="${BOTTOM_BAR_HEIGHT}" fill="${barColor}"/>` +
      circle +
      `</svg>`,
  )
}

type Overlay = { input: Buffer; top: number; left: number }

/**
 * Pillow rysuje poza kanwę po cichu (przycina), sharp rzuca przy overlayu
 * wychodzącym poza bazę. Dla skrajnie długiego tekstu w niskim formacie
 * (1200×627) blok tekstu realnie nie mieści się w budżecie — przycinamy go
 * zamiast wywracać cały render, zachowując semantykę oryginału.
 * Zwraca null, gdy overlay jest w całości poza kanwą.
 */
async function clampOverlay(
  overlay: Overlay,
  canvasWidth: number,
  canvasHeight: number,
): Promise<Overlay | null> {
  const meta = await sharp(overlay.input).metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0

  const left = Math.max(0, overlay.left)
  const top = Math.max(0, overlay.top)
  const cropLeft = left - overlay.left
  const cropTop = top - overlay.top
  const visibleWidth = Math.min(width - cropLeft, canvasWidth - left)
  const visibleHeight = Math.min(height - cropTop, canvasHeight - top)

  if (visibleWidth <= 0 || visibleHeight <= 0) return null
  if (cropLeft === 0 && cropTop === 0 && visibleWidth === width && visibleHeight === height) {
    return { input: overlay.input, top, left }
  }

  const cropped = await sharp(overlay.input)
    .extract({ left: cropLeft, top: cropTop, width: visibleWidth, height: visibleHeight })
    .png()
    .toBuffer()
  return { input: cropped, top, left }
}

/** Nakłada ramkę + logo + tekst na wygenerowane tło. Deterministyczne, bez AI. */
export async function compose(input: ComposeInput): Promise<Buffer> {
  assertFontFilesExist(input.fonts)

  const { format, template } = input
  const { width, height } = format
  const contentWidth = width - 2 * PADDING
  const minImageAreaHeight = Math.trunc(height * template.minImageAreaRatio)

  // Próbuj kolejnych stopni zmniejszenia fontu, zatrzymaj się na pierwszym,
  // który mieści pole obrazu w limicie. Jeśli nawet najmniejszy krok nie
  // wystarczy (skrajnie długi tekst), pole obrazu i tak zostaje przycięte do
  // min_image_area_ratio poniżej — REQ-03 nigdy nie jest łamane.
  let block: TextBlock | null = null
  let imageAreaHeight = 0
  for (const scale of SHRINK_STEPS) {
    const titleSize = Math.max(1, Math.round(BASE_TITLE_SIZE * scale))
    const subtitleSize = Math.max(1, Math.round(BASE_SUBTITLE_SIZE * scale))
    block = await layoutText(input, contentWidth, titleSize, subtitleSize)
    imageAreaHeight = height - BOTTOM_BAR_HEIGHT - block.blockHeight - 3 * PADDING
    if (imageAreaHeight >= minImageAreaHeight) break
  }
  imageAreaHeight = Math.max(minImageAreaHeight, imageAreaHeight)
  const textBlock = block as TextBlock

  const imageArea = await sharp(input.background)
    .resize(contentWidth, imageAreaHeight, {
      fit: "cover",
      position: "centre",
      kernel: "lanczos3",
    })
    .ensureAlpha()
    .composite([
      { input: roundedMask(contentWidth, imageAreaHeight, template.cornerRadius), blend: "dest-in" },
    ])
    .png()
    .toBuffer()

  const placement = resolvePlacement(template.layout)({
    padding: PADDING,
    imageHeight: imageAreaHeight,
    textBlockHeight: textBlock.blockHeight,
  })

  const centeredLeft = (renderedWidth: number) =>
    template.textAlign === "center"
      ? PADDING + Math.max(0, Math.trunc((contentWidth - renderedWidth) / 2))
      : PADDING

  const overlays: Overlay[] = [
    { input: imageArea, top: placement.imageTop, left: PADDING },
  ]

  if (textBlock.title) {
    overlays.push({
      input: textBlock.title.buffer,
      top: placement.textTop,
      left: centeredLeft(textBlock.title.width),
    })
  }
  if (textBlock.subtitle) {
    const subtitleTop =
      placement.textTop + (textBlock.title?.height ?? 0) + TITLE_SUBTITLE_GAP
    overlays.push({
      input: textBlock.subtitle.buffer,
      top: subtitleTop,
      left: centeredLeft(textBlock.subtitle.width),
    })
  }

  // Pasek dolny idzie PO tekście — tak jak w Pillow, gdzie draw.rectangle()
  // jest wywołane po bloku tekstu i zakrywa ewentualne przelanie.
  const barTop = height - BOTTOM_BAR_HEIGHT
  const barColor = toHexColor(darken(parseHexColor(template.colorBg), DARKEN_FACTOR))
  const logoOnLeft = template.logoPosition === "bottom-left"

  const logoOverlays = await buildLogoOverlays({
    input,
    barTop,
    barColor,
    width,
    logoOnLeft,
  })

  overlays.push({
    input: bottomBar({ width, barColor, monogram: logoOverlays.monogram }),
    top: barTop,
    left: 0,
  })
  overlays.push(...logoOverlays.overlays)

  const clamped: Overlay[] = []
  for (const overlay of overlays) {
    const fitted = await clampOverlay(overlay, width, height)
    if (fitted) clamped.push(fitted)
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: template.colorBg,
    },
  })
    .composite(clamped)
    .png()
    .toBuffer()
}

async function buildLogoOverlays(options: {
  input: ComposeInput
  barTop: number
  barColor: string
  width: number
  logoOnLeft: boolean
}): Promise<{ overlays: Overlay[]; monogram: { left: number; accent: string } | null }> {
  const { input, barTop, barColor, width, logoOnLeft } = options
  const { template, fonts } = input
  const overlays: Overlay[] = []

  const barTextColor = toHexColor(readableOn(parseHexColor(barColor)))

  if (template.websiteText) {
    const site = await renderText({
      text: template.websiteText,
      fonts,
      bold: false,
      size: BAR_TEXT_SIZE,
      color: barTextColor,
    })
    if (site) {
      // ODSTĘPSTWO OD PoC (świadome, zweryfikowane wizualnie): w Pythonie tekst
      // strony ZAWSZE ląduje na x=_PADDING, a monogram przy logo_position=
      // "bottom-left" ląduje w tym samym miejscu — nachodzą na siebie. Tutaj
      // tekst strony idzie po stronie PRZECIWNEJ do logo. Dla domyślnego
      // ustawienia (logo z prawej) wynik jest identyczny z PoC, naprawiony
      // zostaje wyłącznie przypadek, który w oryginale wychodził nieczytelnie.
      overlays.push({
        input: site.buffer,
        left: logoOnLeft ? width - PADDING - site.width : PADDING,
        top: barTop + Math.trunc((BOTTOM_BAR_HEIGHT - site.height) / 2),
      })
    }
  }

  // Prawdziwe logo wygrywa z monogramem; monogram to tymczasowy branding do
  // czasu podesłania pliku (dziś realny stan assetów marki).
  if (input.logo) {
    const targetHeight = Math.trunc(BOTTOM_BAR_HEIGHT * LOGO_HEIGHT_RATIO)
    const resized = await sharp(input.logo)
      .resize({ height: targetHeight })
      .png()
      .toBuffer({ resolveWithObject: true })
    const left = logoOnLeft ? PADDING : width - PADDING - resized.info.width
    overlays.push({
      input: resized.data,
      left,
      top: barTop + Math.trunc((BOTTOM_BAR_HEIGHT - targetHeight) / 2),
    })
    return { overlays, monogram: null }
  }

  const monogramLeft = logoOnLeft ? PADDING : width - PADDING - MONOGRAM_DIAMETER
  const letter = (template.name.trim().slice(0, 1) || "?").toUpperCase()
  const glyph = await renderText({
    text: letter,
    fonts,
    bold: true,
    size: BAR_TEXT_SIZE,
    color: toHexColor(readableOn(parseHexColor(template.colorAccent))),
  })
  if (glyph) {
    overlays.push({
      input: glyph.buffer,
      left: monogramLeft + Math.trunc((MONOGRAM_DIAMETER - glyph.width) / 2),
      top: barTop + Math.trunc((BOTTOM_BAR_HEIGHT - glyph.height) / 2),
    })
  }

  return { overlays, monogram: { left: monogramLeft, accent: template.colorAccent } }
}
