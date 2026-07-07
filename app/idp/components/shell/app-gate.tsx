"use client"

import { useAuthorizedApps, useMe } from "@cortex/api"
import type { ReactNode } from "react"
import { canAccessTile } from "@/lib/tiles"
import { AccessDeniedScreen } from "./access-denied-screen"

interface AppGateProps {
  children: ReactNode
  /**
   * undefined = callsite not migrated yet, skip the tile-specific check.
   * null      = caller tried to resolve a tile for the current path and failed — deny.
   * string    = required tile id, checked via canAccessTile.
   */
  tileId?: string | null
}

export function AppGate({ children, tileId }: AppGateProps) {
  const me = useMe()
  const authorized = useAuthorizedApps()

  if (me.isPending || authorized.isLoading) return null

  if (me.isError) return <AccessDeniedScreen reason="error" />

  // has_access comes from the idp backend's /user/me and is scoped to the
  // idp application specifically (APPLICATION_CODE=idp) — it answers "does
  // this email have idp access", not "does it have access to the current
  // tile". It must only gate the idp tile itself (or unmigrated callsites
  // that don't pass tileId at all), never idp-basic/intrastat/ai-tools.
  const hasAccessIsRelevant = tileId === undefined || tileId === "idp"

  if (hasAccessIsRelevant && me.data?.has_access === false) {
    return <AccessDeniedScreen email={me.data?.email ?? null} reason="denied" />
  }

  if (authorized.allowed === false) {
    return <AccessDeniedScreen email={me.data?.email ?? null} reason="denied" />
  }

  if (tileId === null) {
    return <AccessDeniedScreen email={me.data?.email ?? null} reason="denied" />
  }

  if (tileId && !canAccessTile(authorized.apps, tileId)) {
    return <AccessDeniedScreen email={me.data?.email ?? null} reason="denied" />
  }

  const hasAccessOk = !hasAccessIsRelevant || me.data?.has_access === true
  if (hasAccessOk && authorized.allowed === true) {
    return <>{children}</>
  }

  // Fallback: any unexpected combination → fail-closed.
  return <AccessDeniedScreen reason="error" />
}
