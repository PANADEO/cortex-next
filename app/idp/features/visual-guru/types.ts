// Kontrakt klient<->BFF. Kształt odpowiada temu, co zwraca
// POST /api/visual-guru/generate (app/idp/app/api/visual-guru/generate/route.ts).

/** Zgodne z lib/visual-guru/prompts.ts FIDELITY_KEYS — duplikowane świadomie,
 *  client i server to dwa różne bundle'e (design doc sekcja 1.2). */
export type FidelityKey = "high" | "loose"

export interface ReferenceImageDto {
  dataUrl: string
  fileName?: string | undefined
}

export interface GenerateRequestDto {
  prompt: string
  additionalContext?: string | undefined
  referenceImages: ReferenceImageDto[]
  fidelity?: FidelityKey | undefined
  variantCount: 2 | 4
}

export interface GeneratedVariantDto {
  variantIndex: number
  /** Data URI base64, gotowe do <img src>/pobrania — serwer już dekoduje
   *  bytea z Postgresa na base64 przy odpowiedzi. */
  dataUrl: string
}

export interface GenerateResponseDto {
  id: string
  prompt: string
  additionalContext: string | null
  model: string
  variantCount: number
  hadReferenceImage: boolean
  createdAt: string
  variants: GeneratedVariantDto[]
}
