import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const STATIC_IDP_PATHS = new Set([
  "/user/me",
  "/user/preferences",
  "/packages/dashboard-stats",
  "/packages/get_all",
  "/packages/action_logs",
  "/packages/export-templates",
  "/packages/delete",
  "/packages/import",
  "/packages/import-email",
  "/packages/import-multiple",
  "/config",
  "/config/feature-flags",
  "/config/feature-flags/reload-from-env",
  "/config/feature-flags/test-imap",
  "/config/feature-flags/test-smtp",
  "/config/custom-statuses",
])

const DOWNLOAD_PATTERNS: RegExp[] = [
  /^\/packages\/[^/]+\/download$/,
  /^\/packages\/[^/]+\/download-result$/,
  /^\/packages\/[^/]+\/source-files\/content$/,
  /^\/packages\/[^/]+\/export$/,
]

const JSON_API_PATTERNS: RegExp[] = [
  /^\/packages\/[^/]+\/start-verification$/,
  /^\/packages\/[^/]+\/cancel-verification$/,
  /^\/packages\/[^/]+\/unlock-verification$/,
  /^\/packages\/[^/]+\/finish-verification$/,
  /^\/packages\/[^/]+\/reset-verification$/,
  /^\/packages\/[^/]+\/reprocess$/,
  /^\/packages\/[^/]+\/actions$/,
  /^\/packages\/[^/]+\/transitions$/,
  /^\/packages\/[^/]+\/transport-orders$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/seller$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/buyer$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/consignor$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/consignee$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/transport-info$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/sad-context$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+\/totals$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+\/delivery-terms$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+\/lines$/,
  /^\/packages\/[^/]+\/source-files$/,
  /^\/packages\/[^/]+\/export\/validate$/,
  /^\/packages\/[^/]+\/export\/email$/,
  /^\/packages\/[^/]+\/custom-status$/,
  /^\/packages\/[^/]+\/user-notes$/,
  /^\/packages\/[^/]+\/restore$/,
  /^\/packages\/[^/]+$/,
]

const LEGACY_REDIRECTS: ReadonlyArray<{ from: RegExp; to: string }> = [
  { from: /^\/dashboard(\/.*)?$/, to: "/idp/dashboard" },
  { from: /^\/packages(\/.*)?$/, to: "/idp/packages" },
  { from: /^\/import(\/.*)?$/, to: "/idp/import" },
  { from: /^\/export(\/.*)?$/, to: "/idp/export" },
  { from: /^\/audit-log(\/.*)?$/, to: "/idp/audit-log" },
  { from: /^\/rules(\/.*)?$/, to: "/idp/rules" },
  { from: /^\/board(\/.*)?$/, to: "/idp/board" },
  { from: /^\/verify(\/.*)?$/, to: "/idp/verify" },
  { from: /^\/classification(\/.*)?$/, to: "/idp/classification" },
  // Naming-rule fix (02.08.2026): route segments must be English identifiers,
  // no exceptions for "consistency with an existing Polish segment" — see
  // .claude/skills/code-ui/SKILL.md rule 4. Reverses the explicit decision in
  // [[cortex-frontend-aplikacje-ux-projekt]] ("Polski segment, spójnie z
  // istniejącym /system-config/uzytkownicy"). `/system-config/kafelki` used to
  // be its own client-side redirect page (`KafelkiRedirectPage`) — folded in
  // here instead, same job, one mechanism.
  { from: /^\/system-config\/aplikacje(\/.*)?$/, to: "/system-config/applications" },
  { from: /^\/system-config\/uzytkownicy(\/.*)?$/, to: "/system-config/users" },
  { from: /^\/system-config\/kafelki(\/.*)?$/, to: "/system-config/applications" },
  { from: /^\/ilustromat\/generowanie(\/.*)?$/, to: "/ilustromat/generation" },
  { from: /^\/ilustromat\/szablony(\/.*)?$/, to: "/ilustromat/templates" },
]

const IDP_BASIC_API_PATTERNS: RegExp[] = [
  /^\/idp-basic\/api(\/.*)?$/,
  /^\/idp-basic\/health$/,
  /^\/idp-basic\/version$/,
]

const INTRASTAT_API_PATTERNS: RegExp[] = [
  /^\/intrastat\/api(\/.*)?$/,
  /^\/intrastat\/health$/,
  /^\/intrastat\/version$/,
]

const INVOICE_SUPERVISOR_API_PATTERNS: RegExp[] = [
  /^\/invoice-supervisor\/api(\/.*)?$/,
  /^\/invoice-supervisor\/health$/,
  /^\/invoice-supervisor\/version$/,
]

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)

function normalizeBasePath(value: string | undefined): string {
  if (!value) return ""
  const trimmed = value.trim()
  if (!trimmed || trimmed === "/") return ""
  return trimmed.startsWith("/") ? trimmed.replace(/\/+$/, "") : `/${trimmed.replace(/\/+$/, "")}`
}

function stripBasePath(pathname: string): string {
  if (!basePath) return pathname
  if (pathname === basePath) return "/"
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length)
  return pathname
}

function withBasePath(pathname: string): string {
  return basePath ? `${basePath}${pathname}` : pathname
}

function tryLegacyRedirect(req: NextRequest) {
  // XHR/fetch with Accept: application/json is API traffic — let it fall through
  // to tryIdpRewrite or 404. Redirecting JSON XHR breaks apiClient (308 → HTML page → parse error).
  if ((req.headers.get("accept") ?? "").includes("application/json")) return null

  const pathname = stripBasePath(req.nextUrl.pathname)
  const { search } = req.nextUrl
  for (const { from, to } of LEGACY_REDIRECTS) {
    const match = pathname.match(from)
    if (match) {
      const rest = match[1] ?? ""
      return NextResponse.redirect(new URL(withBasePath(to + rest) + search, req.nextUrl), 308)
    }
  }
  return null
}

function tryIdpRewrite(req: NextRequest) {
  const idpBackend = process.env.IDP_BACKEND_URL ?? "http://idp-app"
  const pathname = stripBasePath(req.nextUrl.pathname)
  const { search } = req.nextUrl

  // Tile-namespaced module version: /idp/version → backend /version (no tile prefix).
  // Backend (PANADEO/idp#52) exposes /version at root; frontend uses /idp/version
  // for cross-tile namespacing.
  if (pathname === "/idp/version") {
    return NextResponse.rewrite(new URL("/version" + search, idpBackend))
  }

  if (STATIC_IDP_PATHS.has(pathname)) {
    return NextResponse.rewrite(new URL(pathname + search, idpBackend))
  }

  for (const pattern of DOWNLOAD_PATTERNS) {
    if (pattern.test(pathname)) {
      return NextResponse.rewrite(new URL(pathname + search, idpBackend))
    }
  }

  const accept = req.headers.get("accept") ?? ""
  if (accept.includes("application/json")) {
    for (const pattern of JSON_API_PATTERNS) {
      if (pattern.test(pathname)) {
        return NextResponse.rewrite(new URL(pathname + search, idpBackend))
      }
    }
  }

  return null
}

function tryIdpBasicRewrite(req: NextRequest) {
  const idpBasicBackend =
    process.env.IDP_BASIC_BACKEND_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:8010" : undefined)
  if (!idpBasicBackend) return null

  const pathname = stripBasePath(req.nextUrl.pathname)
  const { search } = req.nextUrl
  if (!IDP_BASIC_API_PATTERNS.some((pattern) => pattern.test(pathname))) return null

  const upstreamPath =
    pathname === "/idp-basic/health" || pathname === "/idp-basic/version"
      ? pathname.replace("/idp-basic", "")
      : pathname.replace("/idp-basic/api", "/api")

  return NextResponse.rewrite(new URL(upstreamPath + search, idpBasicBackend))
}

function tryIntrastatRewrite(req: NextRequest) {
  const intrastatBackend =
    process.env.INTRASTAT_BACKEND_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:8020" : undefined)
  if (!intrastatBackend) return null

  const pathname = stripBasePath(req.nextUrl.pathname)
  const { search } = req.nextUrl
  if (!INTRASTAT_API_PATTERNS.some((pattern) => pattern.test(pathname))) return null

  const upstreamPath =
    pathname === "/intrastat/health" || pathname === "/intrastat/version"
      ? pathname.replace("/intrastat", "")
      : pathname.replace("/intrastat/api", "/api")

  return NextResponse.rewrite(new URL(upstreamPath + search, intrastatBackend))
}

function tryInvoiceSupervisorRewrite(req: NextRequest) {
  const backend =
    process.env.INVOICE_SUPERVISOR_BACKEND_URL ??
    (process.env.NODE_ENV === "development" ? "http://localhost:8504" : undefined)
  if (!backend) return null

  const pathname = stripBasePath(req.nextUrl.pathname)
  const { search } = req.nextUrl
  if (!INVOICE_SUPERVISOR_API_PATTERNS.some((pattern) => pattern.test(pathname))) return null

  // backend-next's FastAPI routes are unprefixed (/invoices, /health, /version —
  // no /api segment on the backend side), unlike idp-basic/intrastat which keep
  // /api on their upstream. Strip the whole /invoice-supervisor/api prefix down
  // to "", not down to "/api".
  const upstreamPath =
    pathname === "/invoice-supervisor/health" || pathname === "/invoice-supervisor/version"
      ? pathname.replace("/invoice-supervisor", "")
      : pathname.replace("/invoice-supervisor/api", "")

  return NextResponse.rewrite(new URL(upstreamPath + search, backend))
}

export default function middleware(req: NextRequest) {
  const intrastatRewrite = tryIntrastatRewrite(req)
  if (intrastatRewrite) return intrastatRewrite

  const invoiceSupervisorRewrite = tryInvoiceSupervisorRewrite(req)
  if (invoiceSupervisorRewrite) return invoiceSupervisorRewrite

  const idpBasicRewrite = tryIdpBasicRewrite(req)
  if (idpBasicRewrite) return idpBasicRewrite

  const rewrite = tryIdpRewrite(req)
  if (rewrite) return rewrite

  const legacyRedirect = tryLegacyRedirect(req)
  if (legacyRedirect) return legacyRedirect

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|mockServiceWorker.js|pdfjs|mock-assets|.*\\.(?:png|jpg|jpeg|svg|webp|ico|js|mjs|pdf)$).*)",
  ],
}
