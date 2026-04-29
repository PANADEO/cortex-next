"use client"

import { configureApiClient } from "@cortex/api"
import { useSession } from "next-auth/react"
import { useEffect, useRef } from "react"

/**
 * Syncs NextAuth session email into the shared apiClient so outgoing requests
 * carry the X-Auth-Request-Email header without each feature reaching into auth.
 *
 * In prod behind oauth2-proxy, the proxy injects X-Auth-Request-Email at the
 * edge, so the value set here is harmlessly overwritten.
 * In dev with DEV_AUTH_USER_EMAIL, NextAuth populates session.user.email from
 * env so MSW handlers see the same email the backend would in prod.
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
