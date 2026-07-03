"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { endpoints, queryKeys } from "../queries"

export function useRunScan() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: endpoints.scan.run,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.films() })
      client.invalidateQueries({ queryKey: queryKeys.snapshots() })
      client.invalidateQueries({ queryKey: queryKeys.log() })
    },
  })
}
