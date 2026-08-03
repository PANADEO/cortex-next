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

// Kontrakt GET /api/visual-guru/history (§6.2) — jeden wiersz archiwum.
// `firstVariantDataUrl` to jedyny wariant potrzebny do miniatury w kolumnie
// listy; `null` tylko w teoretycznym przypadku generacji bez zapisanego
// wariantu (patrz GenerationListItem w @cortex/service/src/visual-guru.ts).
export interface GenerationListItemDto {
  id: string
  prompt: string
  model: string
  variantCount: number
  hadReferenceImage: boolean
  createdAt: string
  firstVariantDataUrl: string | null
}

// Kontrakt GET /api/visual-guru/history/:id (§6.3) — pełne szczegóły + WSZYSTKIE
// warianty. `referenceImageFileName` to jedyny ślad obrazu referencyjnego
// wystawiany klientowi (D5 — same bajty nigdy nie trafiają do Postgresa, więc
// nie ma ich skąd zwrócić).
export interface GenerationDetailDto {
  id: string
  prompt: string
  additionalContext: string | null
  model: string
  variantCount: number
  hadReferenceImage: boolean
  referenceImageFileName: string | null
  createdAt: string
  variants: GeneratedVariantDto[]
}
