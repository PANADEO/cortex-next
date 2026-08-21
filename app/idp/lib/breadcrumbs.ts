import { usePackage } from "@cortex/api"
import type { TileMenuSection } from "@cortex/ui"
import { useMemo } from "react"
import { getAiToolDefinition } from "./ai-tools/registry"
import {
  CORTEX_CONFIG_NAV,
  IDP_BASIC_NAV,
  IDP_NAV,
  ILUSTROMAT_NAV,
  INTRASTAT_NAV,
  INVOICE_SUPERVISOR_NAV,
  OKNA_CZASOWE_NAV,
  STORE_PIT_NAV,
  SYSTEM_CONFIG_NAV,
  TOKEN_USAGE_NAV,
} from "./nav"
import { resolveRequiredTileId, TILES } from "./tiles"

export interface BreadcrumbEntry {
  label: string
  href?: string
}

// Nav sections per URL root segment — the SAME registry `(main)/layout.tsx`
// wires into the sidebar (`navByTile`), keyed the same way (by URL segment,
// not always a tile id: `store-pit` hosts two tiles, sp-console/sp-client,
// under one shared segment). This is what makes breadcrumb middle-segment
// labels match the sidebar. A tile missing here still gets a WORKING link
// (never `/idp/*`) via the root-label resolution below — just with the raw
// URL segment as label instead of a friendly one.
const NAV_SECTIONS_BY_SEGMENT: Record<string, TileMenuSection[]> = {
  idp: IDP_NAV,
  "idp-basic": IDP_BASIC_NAV,
  "store-pit": STORE_PIT_NAV,
  "okna-czasowe": OKNA_CZASOWE_NAV,
  "cortex-config": CORTEX_CONFIG_NAV,
  "system-config": SYSTEM_CONFIG_NAV,
  "token-usage": TOKEN_USAGE_NAV,
  intrastat: INTRASTAT_NAV,
  "invoice-supervisor": INVOICE_SUPERVISOR_NAV,
  ilustromat: ILUSTROMAT_NAV,
}

// Route segments that aren't sidebar nav items (detail sub-pages, mostly) but
// still deserve a friendly breadcrumb label instead of the raw segment.
const EXTRA_ROUTE_LABELS_BY_SEGMENT: Record<string, Record<string, string>> = {
  "idp-basic": { dashboard: "Dashboard", packages: "Packages", results: "Results" },
  intrastat: {
    dashboard: "Dashboard",
    batches: "Batches",
    review: "Review",
    resources: "Resources",
    settings: "Settings",
  },
}

const PACKAGE_DETAIL_PATTERN = /^\/idp\/packages\/([^/]+)\/?$/

function navLabelsForSegment(segment: string): Record<string, string> {
  const sections = NAV_SECTIONS_BY_SEGMENT[segment]
  const fromNav = sections
    ? Object.fromEntries(
        sections.flatMap((section) => section.items).map((item) => [item.id, item.label]),
      )
    : {}
  return { ...EXTRA_ROUTE_LABELS_BY_SEGMENT[segment], ...fromNav }
}

/**
 * Resolves the display label for a URL root segment from `TILES` — the same
 * registry the sidebar reads its labels from — instead of a second,
 * hand-maintained tileId -> label list. Two shapes:
 *  - segment IS a tile id (idp, idp-basic, cortex-config, ...): direct lookup.
 *  - segment hosts tile(s) under a shared prefix (store-pit -> sp-console /
 *    sp-client): delegate to `resolveRequiredTileId`, the same resolver the
 *    access-control gate uses, so the breadcrumb and the gate never disagree
 *    about which tile a path belongs to.
 * Returns `undefined` when the segment matches no tile at all.
 */
function labelForSegment(pathname: string, segment: string): string | undefined {
  const direct = TILES.find((tile) => tile.id === segment)
  if (direct) return direct.label
  const resolvedId = resolveRequiredTileId(pathname)
  return resolvedId ? TILES.find((tile) => tile.id === resolvedId)?.label : undefined
}

export function breadcrumbsFromPath(pathname: string): BreadcrumbEntry[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "IDP" }]

  if (segments[0] === "ai-tools") {
    const tool = getAiToolDefinition(segments[1] ?? "")
    if (tool) return [{ label: "Aplikacje", href: "/" }, { label: tool.shortLabel }]
    return [{ label: "Aplikacje", href: "/" }]
  }

  const segment = segments[0] ?? ""
  const label = labelForSegment(pathname, segment)
  const root: BreadcrumbEntry = label ? { label, href: "/" } : { label: "IDP" }
  const rest = label ? segments.slice(1) : segments
  if (rest.length === 0) return [root]

  const navLabels = label ? navLabelsForSegment(segment) : {}
  const trail: BreadcrumbEntry[] = [root]
  let accum = label ? `/${segment}` : "/idp"
  rest.forEach((seg, idx) => {
    accum += `/${seg}`
    const entryLabel = navLabels[seg] ?? seg
    const isLast = idx === rest.length - 1
    trail.push(isLast ? { label: entryLabel } : { label: entryLabel, href: accum })
  })
  return trail
}

export function useResolvedBreadcrumbs(pathname: string): BreadcrumbEntry[] {
  const match = pathname.match(PACKAGE_DETAIL_PATTERN)
  const packageId = match?.[1] ?? ""
  const pkg = usePackage(packageId, { polling: false })
  const displayName = pkg.data ? (pkg.data.package_name ?? pkg.data.file_name) : undefined

  return useMemo(() => {
    const trail = breadcrumbsFromPath(pathname)
    if (!packageId || !displayName) return trail
    const last = trail[trail.length - 1]
    if (!last || last.label !== packageId) return trail
    return [...trail.slice(0, -1), { ...last, label: displayName }]
  }, [pathname, packageId, displayName])
}
