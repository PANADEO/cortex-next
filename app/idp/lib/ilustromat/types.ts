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

export const LOGO_POSITION_LABELS: Record<LogoPosition, string> = {
  "bottom-right": "Logo z prawej (domyślnie)",
  "bottom-left": "Logo z lewej",
}

export const FRAME_LAYOUT_LABELS: Record<FrameLayout, string> = {
  "image-top": "Obraz u góry, tekst pod nim (domyślnie)",
  "image-bottom": "Tekst u góry, obraz pod nim",
}

export const TEXT_ALIGN_LABELS: Record<TextAlign, string> = {
  left: "Do lewej (domyślnie)",
  center: "Wyśrodkowany",
}
