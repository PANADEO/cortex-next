export interface BreadcrumbEntry {
  label: string
  href?: string
}

const STATIC_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  packages: "Packages",
  import: "Import",
  "audit-log": "Audit log",
  classification: "Classification",
  rules: "Rule editor",
}

export function breadcrumbsFromPath(pathname: string): BreadcrumbEntry[] {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return [{ label: "IDP" }]

  const trail: BreadcrumbEntry[] = [{ label: "IDP" }]
  let accum = ""
  segments.forEach((seg, idx) => {
    accum += `/${seg}`
    const label = STATIC_LABELS[seg] ?? seg
    const isLast = idx === segments.length - 1
    trail.push(isLast ? { label } : { label, href: accum })
  })
  return trail
}
