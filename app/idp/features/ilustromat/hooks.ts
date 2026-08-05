"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type {
  AssistRequestDto,
  ComposeRequestDto,
  FrameTemplateInputDto,
  GenerateRequestDto,
} from "./types"

export function useFrameTemplates(activeOnly = false) {
  return useQuery({
    queryKey: queryKeys.templates(activeOnly),
    queryFn: () => endpoints.templates.list(activeOnly),
  })
}

function useInvalidateTemplates() {
  const client = useQueryClient()
  return () => client.invalidateQueries({ queryKey: [...queryKeys.all, "templates"] })
}

export function useCreateTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: (body: FrameTemplateInputDto) => endpoints.templates.create(body),
    onSuccess: invalidate,
  })
}

export function useUpdateTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: FrameTemplateInputDto }) =>
      endpoints.templates.update(id, body),
    onSuccess: invalidate,
  })
}

export function useSetTemplateActive() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      endpoints.templates.setActive(id, isActive),
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

export function useDeleteTemplate() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: (id: string) => endpoints.templates.remove(id),
    onSuccess: invalidate,
  })
}

export function useGenerate() {
  return useMutation({ mutationFn: (body: GenerateRequestDto) => endpoints.generate(body) })
}

/** Rekompozycja bez AI. Wołana z debounce przy edycji tekstu — nigdy nie
 *  uruchamia nowej generacji (REQ-08). */
export function useCompose() {
  return useMutation({ mutationFn: (body: ComposeRequestDto) => endpoints.compose(body) })
}

/** "Dopracuj" / "Inna wersja" / "Podpowiedz" — jedno wywołanie na jawne
 *  kliknięcie, nigdy w tle. */
export function useAssistText() {
  return useMutation({ mutationFn: (body: AssistRequestDto) => endpoints.assist(body) })
}

export function useTemplatePreview() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      endpoints.templates.preview(id, body),
  })
}

export function useUploadTemplateAsset() {
  const invalidate = useInvalidateTemplates()
  return useMutation({
    mutationFn: ({ id, kind, file }: { id: string; kind: string; file: File }) =>
      endpoints.templates.uploadAsset(id, kind, file),
    onSuccess: invalidate,
  })
}
