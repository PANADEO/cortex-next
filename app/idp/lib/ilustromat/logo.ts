// Normalizacja wgranego logo — port normalize_logo_to_png() z core/templates.py.
//
// Wgrane PNG/JPG/SVG sprowadzamy do jednego, przewidywalnego PNG z alfą, żeby
// composer.ts czytał zawsze ten sam format i nic nie wiedział o SVG/JPG.
// `cairosvg` z PoC znika BEZ zamiennika-zależności — rsvg jest wbudowany
// w prebuilt binary sharpa (zweryfikowane: rsvg 2.61.2).
//
// JPG nie niesie przezroczystości — konwersja jej nie "odtworzy", logo z JPG-a
// wyjdzie jako pełny prostokąt. To ograniczenie formatu, nie błąd.

import sharp from "sharp"

/** Rozdzielczość rasteryzacji SVG — composer i tak skaluje logo w dół do
 *  ~38 px wysokości paska, więc 400 px daje zapas na retinę bez rozdmuchania. */
const LOGO_RASTER_HEIGHT = 400

export class InvalidLogoError extends Error {
  /** Diagnostyka od sharpa — pole STRUKTURALNE, żeby kontroler wstawił ją do
   *  przetłumaczonego zdania zamiast przepuszczać `message` na ekran. */
  readonly detail: string

  constructor(reason: string) {
    super(`Nie udało się odczytać pliku logo: ${reason}`)
    this.name = "InvalidLogoError"
    this.detail = reason
  }
}

function looksLikeSvg(bytes: Buffer, filename: string): boolean {
  if (filename.toLowerCase().endsWith(".svg")) return true
  const head = bytes.subarray(0, 512).toString("utf8").trimStart().toLowerCase()
  return head.startsWith("<svg") || head.startsWith("<?xml")
}

export async function normalizeLogoToPng(bytes: Buffer, filename: string): Promise<Buffer> {
  try {
    const pipeline = looksLikeSvg(bytes, filename)
      ? sharp(bytes, { density: 300 }).resize({ height: LOGO_RASTER_HEIGHT, fit: "inside" })
      : sharp(bytes)

    return await pipeline.ensureAlpha().png().toBuffer()
  } catch (error) {
    throw new InvalidLogoError(error instanceof Error ? error.message : String(error))
  }
}
