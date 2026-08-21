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
  // Round D (D8) — panel "SEO i metadane", tylko tryb "Pojedyncza" faktycznie
  // wysyła te dwie wartości (patrz komentarz w generate/route.ts).
  keywordPhrase?: string
  metaDescription?: string
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

// ---- generation jobs (Round C, D4 — tryby "Kilka"/"Pakiet") ----

export type GenerationJobMode = "batch" | "package"
export type GenerationJobStatus = "queued" | "running" | "done" | "done-with-errors"
export type GenerationJobItemStatus =
  "pending" | "running" | "done" | "done-with-warnings" | "error"

export interface GenerationJobItemDto {
  templateId: string
  templateLabel: string
  topic: string
  status: GenerationJobItemStatus
  content?: string
  archiveId?: string
  matchedForbiddenPhrases?: string[]
  errorMessage?: string
}

export interface GenerationJobDto {
  id: string
  mode: GenerationJobMode
  status: GenerationJobStatus
  items: GenerationJobItemDto[]
  createdAt: string
  completedAt: string | null
}

export interface CreateGenerationJobRequestDto {
  mode: GenerationJobMode
  topics: string[]
  templateIds: string[]
  targetAudience: string
  additionalInfo: string
  model: string
  clientProfileId?: string
  marketProfileId?: string
}

export interface CreateGenerationJobResponseDto {
  jobId: string
  status: GenerationJobStatus
}

// ---- archiwum (Round D, design doc §4.5 — /content-guru/history) ----

export interface ContentArchiveEntryDto {
  id: string
  userEmail: string
  contentType: string
  topic: string | null
  generatedContent: string
  status: ContentGuruGenerationStatus
  matchedForbiddenPhrases: string[] | null
  targetAudience: string | null
  additionalInfo: string | null
  keywordPhrase: string | null
  metaDescription: string | null
  modelUsed: string
  clientProfileId: string | null
  marketProfileId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

// ---- mini-generatory (Round D, D8) ----

export interface GenerateTopicsRequestDto {
  transcript: string
  topicCount: number
  model: string
}

export interface GenerateTopicsResponseDto {
  topics: string[]
}

export interface GenerateKeywordPhraseRequestDto {
  topic: string
  targetAudience?: string
  additionalInfo?: string
  model: string
}

export interface GenerateKeywordPhraseResponseDto {
  keywordPhrase: string
}

export interface GenerateMetaDescriptionRequestDto {
  topic: string
  keywordPhrase?: string
  targetAudience?: string
  additionalInfo?: string
  model: string
}

export interface GenerateMetaDescriptionResponseDto {
  metaDescription: string
}
