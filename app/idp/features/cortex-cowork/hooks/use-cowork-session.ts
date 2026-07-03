"use client"

import { useCoworkSessionStore } from "@/lib/stores/cortex-cowork-session-store"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { coworkApi, coworkQueryKeys } from "../queries"
import type { CoworkSession } from "../types"

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
 * Creates a sandbox session once (per app session) and publishes its id to
 * the shared cortex-cowork session store once ready.
 *
 * Deliberately plain useState + a promise, NOT useMutation: calling
 * `.mutate()` from inside a useEffect doesn't survive React 18 Strict
 * Mode's dev-only double-invocation of effects reliably - the mutation
 * observer's subscription can get orphaned by the synthetic
 * unmount/remount cycle, leaving the caller observing a "pending" status
 * forever even though the underlying request already completed. Plain
 * promise continuations (and Zustand's setter) aren't tied to that
 * subscription lifecycle, so they aren't affected.
 */
export function useEnsureCoworkSession(): EnsureCoworkSessionResult {
  const client = useQueryClient()
  const sessionId = useCoworkSessionStore((s) => s.sessionId)
  const setSessionId = useCoworkSessionStore((s) => s.setSessionId)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (sessionId || inFlightRef.current) return
    inFlightRef.current = true
    setError(null)
    coworkApi
      .createSession()
      .then((session: CoworkSession) => {
        client.setQueryData(coworkQueryKeys.session(session.id), session)
        setSessionId(session.id)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error("Failed to start sandbox session"))
      })
      .finally(() => {
        inFlightRef.current = false
      })
    // `attempt` only exists to let retry() re-trigger this effect.
  }, [sessionId, client, setSessionId, attempt])

  return { sessionId, error, retry: () => setAttempt((n) => n + 1) }
}
