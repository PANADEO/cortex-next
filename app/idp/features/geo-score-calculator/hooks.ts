"use client"

import { useMutation } from "@tanstack/react-query"
import { endpoints } from "./queries"
import type { AnalyzeGeoScoreRequestDto } from "./types"

export function useAnalyzeGeoScore() {
  return useMutation({ mutationFn: (body: AnalyzeGeoScoreRequestDto) => endpoints.analyze(body) })
}
