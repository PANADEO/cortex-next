"use client"

import { useModuleVersion } from "@cortex/api"
import { TILES } from "@/lib/tiles"

const SHELL_VERSION = process.env.NEXT_PUBLIC_SHELL_VERSION ?? "dev"

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
