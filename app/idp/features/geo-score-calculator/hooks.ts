"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type { AnalyzeGeoScoreRequestDto } from "./types"

export function useAnalyzeGeoScore() {
  return useMutation({ mutationFn: (body: AnalyzeGeoScoreRequestDto) => endpoints.analyze(body) })
}

export function useMyGeoScoreHistory() {
  return useQuery({ queryKey: queryKeys.history(), queryFn: endpoints.history.list })
}

export function useGeoScoreCalculation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.calculation(id ?? ""),
    queryFn: () => endpoints.history.get(id as string),
    enabled: id !== null,
  })
}

export function useDeleteGeoScoreCalculation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => endpoints.history.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.history() })
    },
  })
}
