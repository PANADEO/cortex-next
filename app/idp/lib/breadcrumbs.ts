import { usePackage } from "@cortex/api"
import { useMemo } from "react"
import { IDP_BASIC_NAV, IDP_NAV } from "./nav"

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
const IDP_BASIC_ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  packages: "Packages",
  results: "Results",
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
  return { label: "IDP", hrefPrefix: "/idp", navLabels: NAV_LABELS }
}

export function breadcrumbsFromPath(pathname: string): BreadcrumbEntry[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "IDP" }]

  const tileId = segments[0]
  const config = tileConfig(tileId)
  const isKnownTile = tileId === "idp" || tileId === "idp-basic"
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
