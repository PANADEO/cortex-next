"use client"

import { configureApiClient } from "@cortex/api"
import { useSession } from "next-auth/react"
import { useEffect, useRef } from "react"

/**
 * Syncs NextAuth session email into the shared apiClient so outgoing requests
 * carry the X-Auth-Request-Email header without each feature reaching into auth.
 *
 * SWAP POINT: behind a real auth proxy, headers are injected at the edge;
 * this component becomes a no-op (or configureApiClient with getAuthEmail → null).
 */
export function AuthSync() {
  const { data: session } = useSession()
  const sessionRef = useRef(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    configureApiClient({
      baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
      getAuthEmail: () => sessionRef.current?.user?.email ?? null,
    })
  }, [])

  return null
}
