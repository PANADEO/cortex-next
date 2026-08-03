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
  templateId?: string
  clientProfileId?: string
  marketProfileId?: string
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

// ---- templates (Round B, D6 — zasób WSPÓLNY) ----

export interface TemplateDto {
  id: string
  name: string
  category: string
  content: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TemplateInputDto {
  name: string
  category: string
  content: string
}

export interface TestTemplateGenerationRequestDto {
  category: string
  name: string
  content: string
  topic?: string
  model: string
}

export interface TestTemplateGenerationResponseDto {
  content: string
  status: ContentGuruGenerationStatus
  matchedForbiddenPhrases: string[]
  model: string
}

// ---- client/market profiles (Round B, D7 — PER-USER) ----

export interface ClientProfileDto {
  id: string
  userEmail: string
  profileName: string
  history: string | null
  description: string | null
  products: string | null
  offer: string | null
  useCases: string | null
  experience: string | null
  createdAt: string
  updatedAt: string
}

export interface ClientProfileInputDto {
  profileName: string
  history?: string
  description?: string
  products?: string
  offer?: string
  useCases?: string
  experience?: string
}

export interface MarketProfileDto {
  id: string
  userEmail: string
  profileName: string
  description: string | null
  sizeTrends: string | null
  personas: string | null
  problems: string | null
  needs: string | null
  plans: string | null
  createdAt: string
  updatedAt: string
}

export interface MarketProfileInputDto {
  profileName: string
  description?: string
  sizeTrends?: string
  personas?: string
  problems?: string
  needs?: string
  plans?: string
}
