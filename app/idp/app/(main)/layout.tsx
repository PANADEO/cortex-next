"use client"

import { FeatureErrorBoundary } from "@/components/error-boundaries"
import { AppGate } from "@/components/shell/app-gate"
import { VersionLabel } from "@/components/shell/version-label"
import { Topbar } from "@/components/topbar"
import {
  resolveActiveItemId,
  useContentGuruNavSections,
  useCortexConfigNavSections,
  useDocumentParserNavSections,
  useGeoScoreCalculatorNavSections,
  useIdpBasicNavSections,
  useIdpNavSections,
  useIlustromatNavSections,
  useIntrastatNavSections,
  useInvoiceSupervisorNavSections,
  useSystemConfigNavSections,
  useTokenUsageNavSections,
  useOknaCzasoweNavSections,
  useStorePitNavSections,
  useVisualGuruNavSections,
} from "@/lib/nav"
import { usePreset } from "@/lib/presets/preset-store"
import { useSidebarStore } from "@/lib/stores/sidebar-store"
import { AI_TOOLS_TILE_ID } from "@/lib/ai-tools/app-codes"
import { resolveRequiredTileId, TILES } from "@/lib/tiles"
import { AppShell, TileMenu } from "@cortex/ui"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

// URL first segments that own an app-shell. store-pit serves two tile ids
// (sp-console/sp-client) but one nav+label, keyed by its path segment.
// cortex-cowork lives in its own route group with a Codex-style shell.
const KNOWN_TILE_SEGMENTS = new Set([
  "idp",
  "idp-basic",
  "store-pit",
  "okna-czasowe",
  "cortex-config",
  "system-config",
  "intrastat",
  "invoice-supervisor",
  "token-usage",
  "ilustromat",
  "visual-guru",
  "geo-score-calculator",
  "content-guru",
  "document-parser",
])

/* `pathToItemId()` usunięte — mapowało ścieżkę na identyfikator pozycji menu,
   czyli wymagało zgodności dwóch niezależnych list i w trzech kafelkach jej nie
   było. Zastąpione dopasowaniem po `href` (`resolveActiveItemId` w `lib/nav.ts`,
   tam pełne uzasadnienie i opis defektu). */

function pathToTileId(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  const first = segments[0]
  const second = segments[1]
  if (first === "ai-tools") {
    // Hub AI Tools (`/ai-tools`, bez segmentu narzędzia) też należy do rodziny
    // AI Tools — inaczej dostawałby sidebar IDP na czas przekierowania na hub.
    return second && TILES.some((tile) => tile.id === second) ? second : AI_TOOLS_TILE_ID
  }
  return first && KNOWN_TILE_SEGMENTS.has(first) ? first : "idp"
}

const TILE_LABELS: Record<string, string> = {
  "idp-basic": "IDP Basic",
  "store-pit": "Store-Pit",
  "okna-czasowe": "Okna czasowe",
  "cortex-config": "Cortex Config",
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const tileId = pathToTileId(pathname)
  const requiredTileId = resolveRequiredTileId(pathname)
  const tile = TILES.find((t) => t.id === tileId)
  const collapsed = useSidebarStore((s) => s.collapsed)
  // Warstwa 2 dojeżdża do `@cortex/ui` PROPSEM, nie kontekstem. Pakiet
  // prymitywów nie ma prawa zależeć od mechanizmu presetów aplikacji —
  // kierunek zależności jest odwrotny. Ten sam wzorzec, którym hub podaje
  // `variants` do swojego layoutu.
  const shellVariant = usePreset().variants.shell
  const isBoardRoute = pathname === "/idp/dashboard" || pathname === "/idp/board"
  const idpNavSections = useIdpNavSections()
  const idpBasicNavSections = useIdpBasicNavSections()
  const ilustromatNavSections = useIlustromatNavSections()
  const intrastatNavSections = useIntrastatNavSections()
  const invoiceSupervisorNavSections = useInvoiceSupervisorNavSections()
  const storePitNavSections = useStorePitNavSections()
  const oknaCzasoweNavSections = useOknaCzasoweNavSections()
  const cortexConfigNavSections = useCortexConfigNavSections()
  const systemConfigNavSections = useSystemConfigNavSections()
  const tokenUsageNavSections = useTokenUsageNavSections()
  const visualGuruNavSections = useVisualGuruNavSections()
  const geoScoreCalculatorNavSections = useGeoScoreCalculatorNavSections()
  const documentParserNavSections = useDocumentParserNavSections()
  const contentGuruNavSections = useContentGuruNavSections()
  // Every nav hook returns a constant, so this map is stable per render; the
  // hooks stay called unconditionally above (rules of hooks).
  const navByTile: Record<string, typeof idpNavSections> = {
    "idp-basic": idpBasicNavSections,
    "store-pit": storePitNavSections,
    "okna-czasowe": oknaCzasoweNavSections,
    "cortex-config": cortexConfigNavSections,
    "system-config": systemConfigNavSections,
    "token-usage": tokenUsageNavSections,
    intrastat: intrastatNavSections,
    "invoice-supervisor": invoiceSupervisorNavSections,
    ilustromat: ilustromatNavSections,
    "visual-guru": visualGuruNavSections,
    "geo-score-calculator": geoScoreCalculatorNavSections,
    "document-parser": documentParserNavSections,
    "content-guru": contentGuruNavSections,
  }
  const isAiToolPage = tileId === AI_TOOLS_TILE_ID || (tile?.href.startsWith("/ai-tools/") ?? false)
  const navSections = isAiToolPage ? [] : (navByTile[tileId] ?? idpNavSections)
  // PO `navSections`, bo dopasowanie idzie po `href` pozycji z faktycznie
  // renderowanego menu — a to menu bywa przefiltrowane (ukryte pozycje).
  const activeItemId = resolveActiveItemId(pathname, navSections)
  const tileLabel = tile?.label ?? TILE_LABELS[tileId] ?? "IDP"

  const brandIcon = (
    <Link
      href="/"
      aria-label="Powrót do Cortex360 hub"
      className="inline-block transition-opacity motion-reduce:transition-none hover:opacity-80"
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
      className="flex items-center gap-2 font-semibold tracking-tight transition-opacity motion-reduce:transition-none hover:opacity-80"
    >
      <Image
        src="/cortex-logo.png"
        alt="Cortex360"
        width={28}
        height={28}
        className="dark:hue-rotate-180 dark:invert"
      />
      <span className="text-sm">Cortex360 {tileLabel}</span>
    </Link>
  )

  return (
    <AppGate tileId={requiredTileId}>
      <AppShell
        variant={shellVariant}
        sidebarCollapsed={collapsed}
        {...(isBoardRoute ? { mainClassName: "overflow-hidden" } : {})}
        sidebar={
          isAiToolPage ? null : (
            <TileMenu
              variant={shellVariant}
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
