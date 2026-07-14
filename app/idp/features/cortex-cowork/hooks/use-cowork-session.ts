"use client"

import { useCoworkSessionStore } from "@/lib/stores/cortex-cowork-session-store"
import { DEFAULT_COWORK_PROJECT_ID } from "@cortex/types"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { coworkApi, coworkQueryKeys } from "../queries"
import type { CoworkSession } from "../types"
import { useCoworkSessions } from "./use-cowork-sessions"

export function useCoworkSession(sessionId: string | null) {
  return useQuery({
    queryKey: coworkQueryKeys.session(sessionId ?? ""),
    queryFn: () => coworkApi.getSession(sessionId as string),
    enabled: Boolean(sessionId),
  })
}

interface EnsureCoworkSessionResult {
  sessionId: string | null
  error: Error | null
  retry: () => void
}

/**
 * Resolves the active sandbox session for a project: reuses the one pinned in
 * the session store, else adopts the most-recent existing session, else
 * creates a fresh one. Each project keeps its own active session; switching
 * and clearing go through useCoworkSessionActions.
 *
 * Deliberately plain useState + a promise for the create, NOT useMutation:
 * calling `.mutate()` from inside a useEffect doesn't survive React 18 Strict
 * Mode's dev-only double-invocation of effects reliably - the mutation
 * observer's subscription can get orphaned by the synthetic unmount/remount
 * cycle, leaving the caller observing a "pending" status forever even though
 * the underlying request already completed. Plain promise continuations (and
 * Zustand's setter) aren't tied to that subscription lifecycle.
 */
export function useEnsureCoworkSession(
  projectId: string = DEFAULT_COWORK_PROJECT_ID,
): EnsureCoworkSessionResult {
  const client = useQueryClient()
  const sessionId = useCoworkSessionStore((s) => s.sessionIds[projectId] ?? null)
  const setSessionId = useCoworkSessionStore((s) => s.setSessionId)
  const sessions = useCoworkSessions(projectId)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (sessionId || inFlightRef.current) return
    // Wait for the existing-session list before deciding to create.
    if (!sessions.isSuccess) return

    const mostRecent = sessions.data[0]
    if (mostRecent) {
      setSessionId(projectId, mostRecent.id)
      return
    }

    inFlightRef.current = true
    setError(null)
    coworkApi
      .createSession(projectId)
      .then((session: CoworkSession) => {
        client.setQueryData(coworkQueryKeys.session(session.id), session)
        void client.invalidateQueries({ queryKey: coworkQueryKeys.sessions(projectId) })
        setSessionId(projectId, session.id)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error("Failed to start sandbox session"))
      })
      .finally(() => {
        inFlightRef.current = false
      })
    // `attempt` only exists to let retry() re-trigger this effect.
  }, [sessionId, sessions.isSuccess, sessions.data, client, setSessionId, attempt, projectId])

  return { sessionId, error, retry: () => setAttempt((n) => n + 1) }
}
