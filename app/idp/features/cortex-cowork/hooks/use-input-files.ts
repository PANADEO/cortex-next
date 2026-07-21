"use client"

import { toastApiError } from "@cortex/api"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { coworkApi, coworkQueryKeys } from "../queries"
import type { CoworkInputFile, CoworkSession } from "../types"

/**
 * Uploads user files (picker, drag&drop, clipboard paste) into the session
 * sandbox's input/ directory and patches the cached session's inputFiles from
 * the response - no refetch of the whole transcript.
 */
export function useUploadInputFiles(sessionId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (files: File[]) => {
      if (!sessionId) return Promise.reject(new Error("Sesja jeszcze nie wystartowała"))
      return coworkApi.uploadInputFiles(sessionId, files)
    },
    onSuccess: (result: { files: CoworkInputFile[] }) => {
      if (!sessionId) return
      queryClient.setQueryData<CoworkSession>(coworkQueryKeys.session(sessionId), (session) =>
        session ? { ...session, inputFiles: result.files } : session,
      )
    },
    onError: (error) => toastApiError(error, "Nie udało się wgrać plików"),
  })
}
