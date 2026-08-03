"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { endpoints, queryKeys } from "./queries"
import type { GenerateContentRequestDto } from "./types"

/** Lista dozwolonych modeli nie zmienia się w trakcie sesji (env-config
 *  instancji) — `staleTime: Infinity`, wzorem `useUserPreferences()`. */
export function useContentGuruConfig() {
  return useQuery({ queryKey: queryKeys.config(), queryFn: endpoints.config, staleTime: Infinity })
}

export function useGenerateContent() {
  return useMutation({ mutationFn: (body: GenerateContentRequestDto) => endpoints.generate(body) })
}
