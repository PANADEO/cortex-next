// Domenowy kształt szablonu marki — odpowiednik dataclass FrameTemplate
// z core/templates.py. Świadomie NIE jest to typ wierszowy z Drizzle:
// composer.ts ma być wolny od zależności od bazy (wymóg projektu), więc
// warstwa serwisowa mapuje wiersz na ten typ.

export type FontSource = "library" | "custom"
export type LogoPosition = "bottom-left" | "bottom-right"
export type FrameLayout = "image-top" | "image-bottom"
export type TextAlign = "left" | "center"

export interface FrameTemplate {
  id: string
  name: string
  /** Kolory jako #RRGGBB — konwersja na kanały w color.ts. */
  colorBg: string
  colorText: string
  colorAccent: string
  fontSource: FontSource
  fontLibraryId: string | null
  logoPosition: LogoPosition
  cornerRadius: number
  minImageAreaRatio: number
  websiteText: string | null
  layout: FrameLayout
  textAlign: TextAlign
  isActive: boolean
  createdBy: string
}

// Kolejność opcji w kreatorze szablonu — pierwsza pozycja jest domyślna.
// Napisy żyją w przestrzeni `ilustromat` (`options.logoPosition.<value>`,
// `options.layout.<value>`, `options.textAlign.<value>`).
export const LOGO_POSITIONS: readonly LogoPosition[] = ["bottom-right", "bottom-left"]

export const FRAME_LAYOUTS: readonly FrameLayout[] = ["image-top", "image-bottom"]

export const TEXT_ALIGNS: readonly TextAlign[] = ["left", "center"]
