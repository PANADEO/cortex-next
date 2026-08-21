"use client"

import { apiErrorMessage } from "@/lib/i18n/api-error"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
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
  const { t } = useTranslation("cortex-cowork")
  return useMutation({
    mutationFn: (instructions: string) => coworkApi.setMyInstructions(instructions),
    onSuccess: (result) => {
      queryClient.setQueryData(coworkQueryKeys.myInstructions(), result)
    },
    // Trasa zwraca kod, a przy przekroczonym limicie także klucz komunikatu i
    // jego parametr — samą wartość limitu zna wyłącznie serwer.
    onError: (error) => toast.error(apiErrorMessage(t, error, t("sidebar.saveInstructionsFailed"))),
  })
}
