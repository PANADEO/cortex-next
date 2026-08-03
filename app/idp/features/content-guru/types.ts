// Kontrakt klient<->BFF. Kształty odpowiadają temu, co zwracają route'y pod
// /api/content-guru/**. Tryb "Pojedyncza" jest jedynym funkcjonalnym trybem
// tej rundy — DTO batch/pakietu (generation_jobs) dochodzą w Round E/F.

export interface ContentGuruConfigDto {
  models: string[]
}

export interface GenerateContentRequestDto {
  contentType: string
  topic: string
  targetAudience: string
  additionalInfo: string
  model: string
}

export type ContentGuruGenerationStatus = "done" | "done-with-warnings"

export interface GenerateContentResponseDto {
  id: string
  content: string
  status: ContentGuruGenerationStatus
  matchedForbiddenPhrases: string[]
  model: string
  createdAt: string
}
