"use client"

import { usePreset } from "@/lib/presets/preset-store"
import { TILES } from "@/lib/tiles"
import { useModuleVersion } from "@cortex/api"
import { cva } from "class-variance-authority"

/** Stopka paska bocznego. Pod `ruled` numer wersji jest monospace'owy i pisany
 *  wersalikami — jak stopka druku, spójnie z etykietami sekcji w menu. */
const versionText = cva("px-2", {
  variants: {
    variant: {
      plain: "text-[10px] text-muted-foreground",
      ruled: "font-mono text-[11px] uppercase text-sidebar-foreground",
    },
  },
  defaultVariants: { variant: "plain" },
})

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
  const variant = usePreset().variants.shell
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
    <p className={versionText({ variant })}>
      {fePart} · {modulePart}
    </p>
  )
}
