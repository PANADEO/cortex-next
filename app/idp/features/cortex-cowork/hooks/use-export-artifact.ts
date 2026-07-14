"use client"

import { useMutation } from "@tanstack/react-query"
import { coworkApi } from "../queries"

/** Copies an artifact to the project's export share and returns paste path. */
export function useExportArtifact(sessionId: string | null) {
  return useMutation({
    mutationFn: (artifactId: string) => {
      if (!sessionId) throw new Error("No active session")
      return coworkApi.exportArtifact(sessionId, artifactId)
    },
  })
}
