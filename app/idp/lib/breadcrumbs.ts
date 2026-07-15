import { usePackage } from "@cortex/api"
import { useMemo } from "react"
import { getAiToolDefinition } from "./ai-tools/registry"
import { IDP_BASIC_NAV, IDP_NAV, INTRASTAT_NAV, INVOICE_SUPERVISOR_NAV } from "./nav"
import { TILES } from "./tiles"

export interface BreadcrumbEntry {
  label: string
  href?: string
}

const NAV_LABELS: Record<string, string> = Object.fromEntries(
  IDP_NAV.flatMap((s) => s.items).map((i) => [i.id, i.label]),
)
const IDP_BASIC_NAV_LABELS: Record<string, string> = Object.fromEntries(
  IDP_BASIC_NAV.flatMap((s) => s.items).map((i) => [i.id, i.label]),
)
const INTRASTAT_NAV_LABELS: Record<string, string> = Object.fromEntries(
  INTRASTAT_NAV.flatMap((s) => s.items).map((i) => [i.id, i.label]),
)
const INVOICE_SUPERVISOR_NAV_LABELS: Record<string, string> = Object.fromEntries(
  INVOICE_SUPERVISOR_NAV.flatMap((s) => s.items).map((i) => [i.id, i.label]),
)
const IDP_BASIC_ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  packages: "Packages",
  results: "Results",
}
const INTRASTAT_ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  batches: "Batches",
  review: "Review",
  resources: "Resources",
  settings: "Settings",
}
const PACKAGE_DETAIL_PATTERN = /^\/idp\/packages\/([^/]+)\/?$/

function tileConfig(tileId: string | undefined): {
  label: string
  hrefPrefix: string
  navLabels: Record<string, string>
} {
  if (tileId === "idp-basic") {
    return {
      label: "IDP Basic",
      hrefPrefix: "/idp-basic",
      navLabels: { ...IDP_BASIC_ROUTE_LABELS, ...IDP_BASIC_NAV_LABELS },
    }
  }
  if (tileId === "intrastat") {
    return {
      label: "Intrastat",
      hrefPrefix: "/intrastat",
      navLabels: { ...INTRASTAT_ROUTE_LABELS, ...INTRASTAT_NAV_LABELS },
    }
  }
  if (tileId === "invoice-supervisor") {
    return {
      label: "Nadzorca Faktur",
      hrefPrefix: "/invoice-supervisor",
      navLabels: INVOICE_SUPERVISOR_NAV_LABELS,
    }
  }
  return { label: "IDP", hrefPrefix: "/idp", navLabels: NAV_LABELS }
}

export function breadcrumbsFromPath(pathname: string): BreadcrumbEntry[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "IDP" }]

  if (segments[0] === "ai-tools") {
    const tool = getAiToolDefinition(segments[1] ?? "")
    if (tool) return [{ label: "Aplikacje", href: "/" }, { label: tool.shortLabel }]
    return [{ label: "Aplikacje", href: "/" }]
  }

  const tileId = segments[0]
  const config = tileConfig(tileId)
  const isKnownTile = TILES.some((tile) => tile.id === tileId)
  const root: BreadcrumbEntry = isKnownTile ? { label: config.label, href: "/" } : { label: "IDP" }
  const rest = isKnownTile ? segments.slice(1) : segments
  if (rest.length === 0) return [root]

  const trail: BreadcrumbEntry[] = [root]
  let accum = config.hrefPrefix
  rest.forEach((seg, idx) => {
    accum += `/${seg}`
    const label = config.navLabels[seg] ?? seg
    const isLast = idx === rest.length - 1
    trail.push(isLast ? { label } : { label, href: accum })
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
