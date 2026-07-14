"use client"

import { FeatureErrorBoundary } from "@/components/error-boundaries"
import { AppGate } from "@/components/shell/app-gate"
import { VersionLabel } from "@/components/shell/version-label"
import { Topbar } from "@/components/topbar"
import {
  useCortexConfigNavSections,
  useCortexCoworkNavSections,
  useIdpBasicNavSections,
  useIdpNavSections,
  useIntrastatNavSections,
  useInvoiceSupervisorNavSections,
  useOknaCzasoweNavSections,
  useStorePitNavSections,
} from "@/lib/nav"
import { useSidebarStore } from "@/lib/stores/sidebar-store"
import { resolveRequiredTileId, TILES } from "@/lib/tiles"
import { AppShell, TileMenu } from "@cortex/ui"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

// URL first segments that own an app-shell. store-pit serves two tile ids
// (sp-console/sp-client) but one nav+label, keyed by its path segment.
const KNOWN_TILE_SEGMENTS = new Set([
  "idp",
  "idp-basic",
  "store-pit",
  "okna-czasowe",
  "cortex-cowork",
  "cortex-config",
  "intrastat",
  "invoice-supervisor",
])

function pathToItemId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  if (first === "ai-tools") return segments[1] ?? "app"
  if (first && KNOWN_TILE_SEGMENTS.has(first)) return segments[1] ?? "dashboard"
  return first ?? "dashboard"
}

function pathToTileId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  const second = segments[1]
  if (first === "ai-tools" && second && TILES.some((tile) => tile.id === second)) return second
  return first && KNOWN_TILE_SEGMENTS.has(first) ? first : "idp"
}

const TILE_LABELS: Record<string, string> = {
  "idp-basic": "IDP Basic",
  "store-pit": "Store-Pit",
  "okna-czasowe": "Okna czasowe",
  "cortex-cowork": "Cortex Cowork",
  "cortex-config": "Cortex Config",
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const tileId = pathToTileId(pathname)
  const requiredTileId = resolveRequiredTileId(pathname)
  const tile = TILES.find((t) => t.id === tileId)
  const activeItemId = pathToItemId(pathname)
  const collapsed = useSidebarStore((s) => s.collapsed)
  const isBoardRoute = pathname === "/idp/dashboard" || pathname === "/idp/board"
  const idpNavSections = useIdpNavSections()
  const idpBasicNavSections = useIdpBasicNavSections()
  const intrastatNavSections = useIntrastatNavSections()
  const invoiceSupervisorNavSections = useInvoiceSupervisorNavSections()
  const storePitNavSections = useStorePitNavSections()
  const oknaCzasoweNavSections = useOknaCzasoweNavSections()
  const cortexCoworkNavSections = useCortexCoworkNavSections()
  const cortexConfigNavSections = useCortexConfigNavSections()
  // Every nav hook returns a constant, so this map is stable per render; the
  // hooks stay called unconditionally above (rules of hooks).
  const navByTile: Record<string, typeof idpNavSections> = {
    "idp-basic": idpBasicNavSections,
    "store-pit": storePitNavSections,
    "okna-czasowe": oknaCzasoweNavSections,
    "cortex-cowork": cortexCoworkNavSections,
    "cortex-config": cortexConfigNavSections,
    intrastat: intrastatNavSections,
    "invoice-supervisor": invoiceSupervisorNavSections,
  }
  const isAiToolPage = tile?.href.startsWith("/ai-tools/") ?? false
  const navSections = isAiToolPage ? [] : (navByTile[tileId] ?? idpNavSections)
  const tileLabel = tile?.label ?? TILE_LABELS[tileId] ?? "IDP"

  const brandIcon = (
    <Link
      href="/"
      aria-label="Powrót do Cortex360 hub"
      className="inline-block transition-opacity hover:opacity-80"
    >
      <Image
        src="/cortex-logo.png"
        alt="Cortex360"
        width={28}
        height={28}
        className="dark:hue-rotate-180 dark:invert"
        priority
      />
    </Link>
  )

  const brand = (
    <Link
      href="/"
      aria-label="Powrót do Cortex360 hub"
      className="flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-80"
    >
      <Image
        src="/cortex-logo.png"
        alt="Cortex360"
        width={28}
        height={28}
        className="dark:hue-rotate-180 dark:invert"
      />
      <span className="text-sm">Cortex360 {tile?.label ?? "IDP"}</span>
    </Link>
  )

  return (
    <AppGate tileId={requiredTileId}>
      <AppShell
        sidebarCollapsed={collapsed}
        {...(isBoardRoute ? { mainClassName: "overflow-hidden" } : {})}
        sidebar={
          isAiToolPage ? null : (
            <TileMenu
              sections={navSections}
              activeItemId={activeItemId}
              collapsed={collapsed}
              brand={brand}
              brandIcon={brandIcon}
              footerSlot={<VersionLabel tileId={tileId} />}
            />
          )
        }
        topbar={<Topbar showSidebarToggle={!isAiToolPage} />}
      >
        <FeatureErrorBoundary>{children}</FeatureErrorBoundary>
      </AppShell>
    </AppGate>
  )
}
