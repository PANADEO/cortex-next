// Kolor jako dane szablonu marki: hex w bazie i w UI, kanały RGB w composerze.
// Port pomocników z core/composer.py (_darken, _readable_on) i core/templates.py
// (contrast_ratio).

export interface Rgb {
  r: number
  g: number
  b: number
}

const HEX_PATTERN = /^#[0-9a-f]{6}$/i

export class InvalidColorError extends Error {
  /** Odrzucona wartość — pole STRUKTURALNE, żeby kontroler mógł ją wstawić do
   *  przetłumaczonego zdania zamiast przepuszczać `message` na ekran. */
  readonly value: string

  constructor(value: string) {
    super(`Kolor musi być w formacie #RRGGBB, otrzymano: ${value}`)
    this.name = "InvalidColorError"
    this.value = value
  }
}

export function parseHexColor(value: string): Rgb {
  if (!HEX_PATTERN.test(value)) throw new InvalidColorError(value)
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  }
}

export function toHexColor({ r, g, b }: Rgb): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0")
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase()
}

/** Pasek dolny = przyciemniony color_bg szablonu (_DARKEN_FACTOR = 0.65). */
export function darken(color: Rgb, factor: number): Rgb {
  return {
    r: Math.trunc(color.r * factor),
    g: Math.trunc(color.g * factor),
    b: Math.trunc(color.b * factor),
  }
}

/** Biały albo prawie-czarny tekst — cokolwiek czytelniejsze na danym tle.
 *  Próg 140 dosłownie z _readable_on() w core/composer.py. */
export function readableOn(color: Rgb): Rgb {
  const luminance = 0.299 * color.r + 0.587 * color.g + 0.114 * color.b
  return luminance < 140 ? { r: 255, g: 255, b: 255 } : { r: 20, g: 20, b: 20 }
}

/** WCAG relative-luminance contrast ratio (1.0–21.0). >= 4.5 = AA dla
 *  zwykłego tekstu. Port contrast_ratio() z core/templates.py. */
export function contrastRatio(colorA: Rgb, colorB: Rgb): number {
  const relativeLuminance = ({ r, g, b }: Rgb) => {
    const channel = (value: number) => {
      const normalized = value / 255
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  const a = relativeLuminance(colorA)
  const b = relativeLuminance(colorB)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

export const WCAG_AA_NORMAL_TEXT = 4.5
