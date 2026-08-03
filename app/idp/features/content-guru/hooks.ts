"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type {
  ClientProfileInputDto,
  GenerateContentRequestDto,
  MarketProfileInputDto,
  TemplateInputDto,
  TestTemplateGenerationRequestDto,
} from "./types"

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
    mutationFn: (body: TestTemplateGenerationRequestDto) => endpoints.templates.testGeneration(body),
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
