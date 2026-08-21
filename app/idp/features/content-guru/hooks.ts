"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type {
  ClientProfileInputDto,
  CreateGenerationJobRequestDto,
  GenerateContentRequestDto,
  GenerateKeywordPhraseRequestDto,
  GenerateMetaDescriptionRequestDto,
  GenerateTopicsRequestDto,
  GenerationJobDto,
  MarketProfileInputDto,
  TemplateInputDto,
  TestTemplateGenerationRequestDto,
} from "./types"

const JOB_POLL_INTERVAL_MS = 2000

function isJobInProgress(job: GenerationJobDto | undefined): boolean {
  return job?.status === "queued" || job?.status === "running"
}

/** Lista dozwolonych modeli nie zmienia się w trakcie sesji (env-config
 *  instancji) — `staleTime: Infinity`, wzorem `useUserPreferences()`. */
export function useContentGuruConfig() {
  return useQuery({ queryKey: queryKeys.config(), queryFn: endpoints.config, staleTime: Infinity })
}

export function useGenerateContent() {
  return useMutation({ mutationFn: (body: GenerateContentRequestDto) => endpoints.generate(body) })
}

// ---- templates (Round B) ----

export function useTemplates() {
  return useQuery({ queryKey: queryKeys.templates(), queryFn: endpoints.templates.list })
}

function useInvalidateTemplates() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: queryKeys.templates() })
}

export function useCreateTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: (body: TemplateInputDto) => endpoints.templates.create(body),
    onSuccess: invalidate,
  })
}

export function useUpdateTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TemplateInputDto }) =>
      endpoints.templates.update(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: (id: string) => endpoints.templates.remove(id),
    onSuccess: invalidate,
  })
}

export function useDuplicateTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: (id: string) => endpoints.templates.duplicate(id),
    onSuccess: invalidate,
  })
}

/** "Testuj generację" (design doc §4.2) — NIE inwaliduje żadnej listy, bo nie
 *  zapisuje niczego (ani szablonu, ani wpisu w archiwum). */
export function useTestTemplateGeneration() {
  return useMutation({
    mutationFn: (body: TestTemplateGenerationRequestDto) =>
      endpoints.templates.testGeneration(body),
  })
}

// ---- client profiles (Round B, D7) ----

export function useMyClientProfiles() {
  return useQuery({ queryKey: queryKeys.clientProfiles(), queryFn: endpoints.clientProfiles.list })
}

function useInvalidateClientProfiles() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: queryKeys.clientProfiles() })
}

export function useCreateClientProfile() {
  const invalidate = useInvalidateClientProfiles()
  return useMutation({
    mutationFn: (body: ClientProfileInputDto) => endpoints.clientProfiles.create(body),
    onSuccess: invalidate,
  })
}

export function useUpdateClientProfile() {
  const invalidate = useInvalidateClientProfiles()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ClientProfileInputDto }) =>
      endpoints.clientProfiles.update(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteClientProfile() {
  const invalidate = useInvalidateClientProfiles()
  return useMutation({
    mutationFn: (id: string) => endpoints.clientProfiles.remove(id),
    onSuccess: invalidate,
  })
}

// ---- market profiles (Round B, D7) ----

export function useMyMarketProfiles() {
  return useQuery({ queryKey: queryKeys.marketProfiles(), queryFn: endpoints.marketProfiles.list })
}

function useInvalidateMarketProfiles() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: queryKeys.marketProfiles() })
}

export function useCreateMarketProfile() {
  const invalidate = useInvalidateMarketProfiles()
  return useMutation({
    mutationFn: (body: MarketProfileInputDto) => endpoints.marketProfiles.create(body),
    onSuccess: invalidate,
  })
}

export function useUpdateMarketProfile() {
  const invalidate = useInvalidateMarketProfiles()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: MarketProfileInputDto }) =>
      endpoints.marketProfiles.update(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteMarketProfile() {
  const invalidate = useInvalidateMarketProfiles()
  return useMutation({
    mutationFn: (id: string) => endpoints.marketProfiles.remove(id),
    onSuccess: invalidate,
  })
}

// ---- generation jobs (Round C, D4 — tryby "Kilka"/"Pakiet") ----

export function useCreateGenerationJob() {
  return useMutation({
    mutationFn: (body: CreateGenerationJobRequestDto) => endpoints.jobs.create(body),
  })
}

/**
 * Polling zgodnie z architecture_rules.md §5: "Polling — tylko z
 * refetchInterval + enabled. Nie używamy setInterval ręcznie." — wzorem
 * `useJob()` w document-parser/hooks.ts. Wyłącza się samo, gdy job osiągnie
 * status końcowy (`done`/`done-with-errors`, D4) — kolejny poll po tym
 * momencie byłby bez sensu, Postgres już ma kompletny rekord.
 *
 * `jobId: null` wyłącza zapytanie całkowicie (`enabled: false`) — ekran
 * generowania używa tego, dopóki nie ma jeszcze jobId z odpowiedzi
 * `POST /jobs`.
 */
export function useGenerationJob(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.job(jobId ?? ""),
    queryFn: () => endpoints.jobs.get(jobId as string),
    enabled: jobId !== null,
    refetchInterval: (query) => (isJobInProgress(query.state.data) ? JOB_POLL_INTERVAL_MS : false),
  })
}

// ---- archiwum (Round D, design doc §4.5 — /content-guru/history) ----

export function useMyArchive() {
  return useQuery({ queryKey: queryKeys.archive(), queryFn: endpoints.archive.list })
}

/** `id: null` wyłącza zapytanie całkowicie (`enabled: false`) — wzorem
 *  `useGenerationJob()` powyżej, dla momentu przed nawodnieniem `useParams()`. */
export function useArchiveEntry(id: string | null) {
  return useQuery({
    queryKey: queryKeys.archiveEntry(id ?? ""),
    queryFn: () => endpoints.archive.get(id as string),
    enabled: id !== null,
  })
}

// ---- mini-generatory (Round D, D8) ----

export function useGenerateTopics() {
  return useMutation({
    mutationFn: (body: GenerateTopicsRequestDto) => endpoints.miniGenerators.topics(body),
  })
}

export function useGenerateKeywordPhrase() {
  return useMutation({
    mutationFn: (body: GenerateKeywordPhraseRequestDto) => endpoints.miniGenerators.keyword(body),
  })
}

export function useGenerateMetaDescriptionMini() {
  return useMutation({
    mutationFn: (body: GenerateMetaDescriptionRequestDto) =>
      endpoints.miniGenerators.metaDescription(body),
  })
}
