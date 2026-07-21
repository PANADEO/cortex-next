"use client"

import { useQuery } from "@tanstack/react-query"
import { coworkApi, coworkQueryKeys } from "../queries"

export function useCoworkArtifacts(sessionId: string | null) {
  return useQuery({
    queryKey: coworkQueryKeys.artifacts(sessionId ?? ""),
    queryFn: () => coworkApi.listArtifacts(sessionId as string),
    enabled: Boolean(sessionId),
  })
}
