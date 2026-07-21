"use client"

import { toastApiError } from "@cortex/api"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { coworkApi, coworkQueryKeys } from "../queries"

/**
 * The user layer of the hierarchical AGENTS.md ("Moje instrukcje"): a personal
 * note composed into the agent's system prompt after the admin layers.
 */
export function useMyInstructions(enabled = true) {
  return useQuery({
    queryKey: coworkQueryKeys.myInstructions(),
    queryFn: coworkApi.getMyInstructions,
    enabled,
  })
}

export function useSaveMyInstructions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (instructions: string) => coworkApi.setMyInstructions(instructions),
    onSuccess: (result) => {
      queryClient.setQueryData(coworkQueryKeys.myInstructions(), result)
    },
    onError: (error) => toastApiError(error, "Nie udało się zapisać instrukcji"),
  })
}
