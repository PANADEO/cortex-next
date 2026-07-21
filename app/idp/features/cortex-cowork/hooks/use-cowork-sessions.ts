"use client"

import { useCoworkSessionStore } from "@/lib/stores/cortex-cowork-session-store"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { coworkApi, coworkQueryKeys } from "../queries"
import type { CoworkSession } from "../types"

/** Session summaries for a project's switcher, newest first. */
export function useCoworkSessions(projectId: string) {
  return useQuery({
    queryKey: coworkQueryKeys.sessions(projectId),
    queryFn: () => coworkApi.listSessions(projectId),
    staleTime: 5_000,
  })
}

/**
 * Create-new and clear actions for a project's sessions, keeping the active
 * session pointer (in the session store) and the session list in sync.
 * Deleting the active session clears the pointer so the ensure hook re-picks
 * the next most-recent one (or creates a fresh one).
 */
export function useCoworkSessionActions(projectId: string) {
  const client = useQueryClient()
  const setSessionId = useCoworkSessionStore((s) => s.setSessionId)
  const invalidateList = () =>
    client.invalidateQueries({ queryKey: coworkQueryKeys.sessions(projectId) })

  const create = useMutation({
    mutationFn: () => coworkApi.createSession(projectId),
    onSuccess: (session: CoworkSession) => {
      client.setQueryData(coworkQueryKeys.session(session.id), session)
      setSessionId(projectId, session.id)
    },
    onSettled: invalidateList,
  })

  const remove = useMutation({
    mutationFn: (sessionId: string) => coworkApi.deleteSession(sessionId),
    onSuccess: (_result, sessionId) => {
      const active = useCoworkSessionStore.getState().sessionIds[projectId]
      if (active === sessionId) setSessionId(projectId, null)
      client.removeQueries({ queryKey: coworkQueryKeys.session(sessionId) })
    },
    onSettled: invalidateList,
  })

  return { create, remove }
}
