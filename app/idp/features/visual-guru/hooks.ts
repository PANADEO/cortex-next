"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type { GenerateRequestDto } from "./types"

export function useGenerate() {
  return useMutation({ mutationFn: (body: GenerateRequestDto) => endpoints.generate(body) })
}

/** Archiwum (§6.2) — bez page/sort/search, CortexDataGrid filtruje/sortuje/
 *  paginuje po stronie przeglądarki nad całą tablicą (wzorem useMyJobs()). */
export function useHistory() {
  return useQuery({ queryKey: queryKeys.history(), queryFn: endpoints.history.list })
}

export function useGenerationDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.historyItem(id ?? ""),
    queryFn: () => endpoints.history.get(id as string),
    enabled: id !== null,
  })
}

export function useDeleteGeneration() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endpoints.history.delete(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.history() })
    },
  })
}
