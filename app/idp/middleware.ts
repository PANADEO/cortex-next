import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { auth } from "./auth"

const PUBLIC_PATHS = ["/login"]

const STATIC_IDP_PATHS = new Set([
  "/user/me",
  "/user/preferences",
  "/packages/dashboard-stats",
  "/packages/get_all",
  "/packages/action_logs",
  "/packages/export-templates",
  "/packages/delete",
  "/packages/import",
  "/packages/import-multiple",
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
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+\/totals$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+\/delivery-terms$/,
  /^\/packages\/[^/]+\/transport-orders\/[^/]+\/invoices\/[^/]+\/lines$/,
  /^\/packages\/[^/]+\/source-files$/,
  /^\/packages\/[^/]+\/export\/validate$/,
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
]

function tryLegacyRedirect(req: NextRequest) {
  // XHR/fetch with Accept: application/json is API traffic — let it fall through
  // to tryIdpRewrite or 404. Redirecting JSON XHR breaks apiClient (308 → HTML page → parse error).
  if ((req.headers.get("accept") ?? "").includes("application/json")) return null

  const { pathname, search } = req.nextUrl
  for (const { from, to } of LEGACY_REDIRECTS) {
    const match = pathname.match(from)
    if (match) {
      const rest = match[1] ?? ""
      return NextResponse.redirect(new URL(to + rest + search, req.nextUrl), 308)
    }
  }
  return null
}

function tryIdpRewrite(req: NextRequest) {
  const idpBackend = process.env.IDP_BACKEND_URL ?? "http://idp-app"
  const { pathname, search } = req.nextUrl

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

export default auth((req) => {
  const rewrite = tryIdpRewrite(req)
  if (rewrite) return rewrite

  const legacyRedirect = tryLegacyRedirect(req)
  if (legacyRedirect) return legacyRedirect

  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p))

  if (isPublic) {
    if (isLoggedIn && nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", nextUrl))
    }
    return NextResponse.next()
  }
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|mockServiceWorker.js|pdfjs|mock-assets|.*\\.(?:png|jpg|jpeg|svg|webp|ico|js|mjs|pdf)$).*)",
  ],
}
