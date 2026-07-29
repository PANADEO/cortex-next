// Kontrakt klient<->BFF. Kształty odpowiadają temu, co zwracają route'y
// pod /api/ilustromat/**.

export interface FrameTemplateDto {
  id: string
  name: string
  colorBg: string
  colorText: string
  colorAccent: string
  fontSource: "library" | "custom"
  fontLibraryId: string | null
  logoPosition: "bottom-left" | "bottom-right"
  cornerRadius: number
  minImageAreaRatio: number
  websiteText: string | null
  layout: "image-top" | "image-bottom"
  textAlign: "left" | "center"
  isActive: boolean
  createdBy: string
}

export interface FrameTemplateInputDto {
  name: string
  colorBg: string
  colorText: string
  colorAccent: string
  fontSource: "library" | "custom"
  fontLibraryId: string | null
  logoPosition: "bottom-left" | "bottom-right"
  cornerRadius: number
  minImageAreaRatio: number
  websiteText: string | null
  layout: "image-top" | "image-bottom"
  textAlign: "left" | "center"
  isActive?: boolean
}

export interface GenerateRequestDto {
  templateId: string
  formatKey: string
  styleKey: string
  title: string
  subtitle: string
  idea: string
  variants: number
}

/** Wariant niesie OBA obrazy: gotowy kafelek do pokazania (REQ-06) i surowe
 *  tło do rekompozycji bez ponownego płacenia za AI (REQ-08). */
export interface GeneratedVariantDto {
  background: string
  composed: string
}

export interface GenerateResponseDto {
  prompt: string
  model: string
  templateId: string
  formatKey: string
  variants: GeneratedVariantDto[]
}

export interface ComposeRequestDto {
  templateId: string
  formatKey: string
  title: string
  subtitle: string
  background: string
}

/** Wpis historii sesji — żyje wyłącznie w pamięci przeglądarki (parytet z PoC,
 *  patrz sekcja 3.2 projektu). Odświeżenie strony ją kasuje i tak ma być. */
export interface SessionHistoryEntry {
  id: string
  createdAt: number
  title: string
  subtitle: string
  idea: string
  styleKey: string
  formatKey: string
  templateId: string
  prompt: string
  model: string
  variants: GeneratedVariantDto[]
  selectedIndex: number
}
