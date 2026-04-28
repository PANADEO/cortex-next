import { IDP_NAV } from "./nav"

export interface BreadcrumbEntry {
  label: string
  href?: string
}

const NAV_LABELS: Record<string, string> = Object.fromEntries(
  IDP_NAV.flatMap((s) => s.items).map((i) => [i.id, i.label]),
)

export function breadcrumbsFromPath(pathname: string): BreadcrumbEntry[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "IDP" }]

  const root: BreadcrumbEntry =
    segments[0] === "idp" ? { label: "IDP", href: "/" } : { label: "IDP" }
  const rest = segments[0] === "idp" ? segments.slice(1) : segments
  if (rest.length === 0) return [root]

  const trail: BreadcrumbEntry[] = [root]
  let accum = "/idp"
  rest.forEach((seg, idx) => {
    accum += `/${seg}`
    const label = NAV_LABELS[seg] ?? seg
    const isLast = idx === rest.length - 1
    trail.push(isLast ? { label } : { label, href: accum })
  })
  return trail
}
