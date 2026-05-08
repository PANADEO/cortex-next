"use client"

import { useAuthorizedApps, useMe } from "@cortex/api"
import type { ReactNode } from "react"
import { AccessDeniedScreen } from "./access-denied-screen"

interface AppGateProps {
  children: ReactNode
}

export function AppGate({ children }: AppGateProps) {
  const me = useMe()
  const authorized = useAuthorizedApps()

  if (me.isPending || authorized.isLoading) return null

  if (me.isError) return <AccessDeniedScreen reason="error" />

  if (me.data?.has_access === false) {
    return <AccessDeniedScreen email={me.data.email} reason="denied" />
  }

  if (authorized.allowed === false) {
    return <AccessDeniedScreen email={me.data?.email ?? null} reason="denied" />
  }

  if (me.data?.has_access === true && authorized.allowed === true) {
    return <>{children}</>
  }

  // Fallback: any unexpected combination → fail-closed.
  return <AccessDeniedScreen reason="error" />
}
