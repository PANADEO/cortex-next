"use client"

import { useModuleVersion } from "@cortex/api"
import { TILES } from "@/lib/tiles"

// Inlined at build time (Next.js NEXT_PUBLIC_ vars are compiled into the
// bundle, not read at runtime). In prod, Dockerfile/GHA set it from
// github.ref_name (tag) or the commit sha — see Dockerfile `ENV
// NEXT_PUBLIC_SHELL_VERSION=$VERSION`. Unset locally = "dev", not an error.
export const SHELL_VERSION = process.env.NEXT_PUBLIC_SHELL_VERSION ?? "dev"

export function stripLeadingV(s: string): string {
  return s.startsWith("v") ? s.slice(1) : s
}

interface VersionLabelProps {
  tileId: string
}

export function VersionLabel({ tileId }: VersionLabelProps) {
  const tile = TILES.find((t) => t.id === tileId)
  const { data, isLoading, isError } = useModuleVersion(tile?.versionEndpoint)

  const fePart = `FE v${stripLeadingV(SHELL_VERSION)}`
  const moduleLabel = tile?.label ?? tileId.toUpperCase()

  let modulePart: string
  if (!tile?.versionEndpoint || isError) {
    modulePart = moduleLabel
  } else if (isLoading || !data) {
    modulePart = `${moduleLabel} v…`
  } else {
    modulePart = `${moduleLabel} v${stripLeadingV(data.version)}`
  }

  return (
    <p className="px-2 text-[10px] text-muted-foreground">
      {fePart} · {modulePart}
    </p>
  )
}
