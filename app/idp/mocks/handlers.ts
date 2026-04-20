import type {
  DashboardStatsResponse,
  PackageActionType,
  PackageReadModel,
  PackageSortField,
  PackageStatus,
  PaginatedActionLogResponse,
  PaginatedPackageResponse,
  SortOrder,
  UserInfoResponse,
} from "@cortex/types"
import { http, HttpResponse } from "msw"
import { ALLOWED_TRANSITIONS, buildActionLogs, buildDetails, packageActions } from "./fixtures/details"
import { buildPackageFixtures } from "./fixtures/packages"

const packages = buildPackageFixtures(54)

function computeStats(items: PackageReadModel[]): DashboardStatsResponse {
  const counts: Record<PackageStatus, number> = {
    imported: 0,
    imported_with_error: 0,
    analysing: 0,
    analysis_failed: 0,
    ready_for_verification: 0,
    verification: 0,
    verified: 0,
  }
  for (const p of items) counts[p.status]++
  return {
    in_queue: counts.imported,
    processing: counts.analysing,
    ready_for_verification: counts.ready_for_verification,
    in_verification: counts.verification,
    verified: counts.verified,
    failed: counts.imported_with_error + counts.analysis_failed,
  }
}

function sortPackages(
  items: PackageReadModel[],
  sortBy: PackageSortField,
  order: SortOrder,
): PackageReadModel[] {
  const copy = [...items]
  copy.sort((a, b) => {
    const av = a[sortBy]
    const bv = b[sortBy]
    if (av === bv) return 0
    return av < bv ? -1 : 1
  })
  return order === "desc" ? copy.reverse() : copy
}

function notFound(id: string | readonly string[] | undefined) {
  const pid = Array.isArray(id) ? id.join(",") : String(id)
  return HttpResponse.json(
    {
      error_code: "PACKAGE_NOT_FOUND",
      message: `Package with id '${pid}' not found`,
      variables: { package_id: pid },
    },
    { status: 404 },
  )
}

const TRANSITION_MAP: Record<string, PackageStatus | "same"> = {
  start_verification: "verification",
  cancel_verification: "ready_for_verification",
  finish_verification: "verified",
  reset_verification: "ready_for_verification",
  reprocess: "analysing",
}

export const handlers = [
  http.get("/health", () => HttpResponse.json({ status: "ok" })),

  http.get("/user/me", ({ request }) => {
    const email = request.headers.get("X-Auth-Request-Email") ?? "demo@cortex.local"
    const body: UserInfoResponse = { email, has_access: true }
    return HttpResponse.json(body)
  }),

  http.get("/packages/dashboard-stats", () => HttpResponse.json(computeStats(packages))),

  http.get("/packages/get_all", ({ request }) => {
    const url = new URL(request.url)
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 10))
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    const statusFilter = url.searchParams.get("status") as PackageStatus | null
    const search = url.searchParams.get("search")?.toLowerCase() ?? null
    const sortBy = (url.searchParams.get("sort_by") ?? "created_date") as PackageSortField
    const order = (url.searchParams.get("sort_order") ?? "desc") as SortOrder

    let filtered = packages
    if (statusFilter) filtered = filtered.filter((p) => p.status === statusFilter)
    if (search) filtered = filtered.filter((p) => p.file_name.toLowerCase().includes(search))

    const sorted = sortPackages(filtered, sortBy, order)
    const page = sorted.slice(offset, offset + limit)

    const body: PaginatedPackageResponse = {
      items: page,
      total: sorted.length,
      limit,
      offset,
    }
    return HttpResponse.json(body)
  }),

  http.get("/packages/action_logs", ({ request }) => {
    const url = new URL(request.url)
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 10))
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    const typeFilter = url.searchParams.get("action_type") as PackageActionType | null
    const performedBy = url.searchParams.get("performed_by")?.toLowerCase() ?? null
    const dateFrom = url.searchParams.get("date_from")
    const dateTo = url.searchParams.get("date_to")

    let all = buildActionLogs(packages)
    if (typeFilter) all = all.filter((e) => e.action_type === typeFilter)
    if (performedBy)
      all = all.filter((e) => e.performed_by.toLowerCase().includes(performedBy))
    if (dateFrom) all = all.filter((e) => e.timestamp >= dateFrom)
    if (dateTo) all = all.filter((e) => e.timestamp <= dateTo)

    const body: PaginatedActionLogResponse = {
      items: all.slice(offset, offset + limit),
      total: all.length,
      limit,
      offset,
    }
    return HttpResponse.json(body)
  }),

  http.get("/packages/:id", ({ params }) => {
    const pkg = packages.find((p) => p.id === params.id)
    if (!pkg) return notFound(params.id)
    return HttpResponse.json(buildDetails(pkg))
  }),

  http.get("/packages/:id/actions", ({ params }) => {
    const pkg = packages.find((p) => p.id === params.id)
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({
      package_id: pkg.id,
      actions: packageActions(packages, pkg.id),
    })
  }),

  http.get("/packages/:id/transitions", ({ params }) => {
    const pkg = packages.find((p) => p.id === params.id)
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({ transitions: ALLOWED_TRANSITIONS[pkg.status] })
  }),

  http.get("/packages/:id/transport-orders", ({ params }) => {
    const pkg = packages.find((p) => p.id === params.id)
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({
      package_id: pkg.id,
      transport_orders: null,
      verified_transport_orders: null,
    })
  }),

  ...Object.keys(TRANSITION_MAP).map((transition) => {
    const kebab = transition.replace(/_/g, "-")
    return http.post(`/packages/:id/${kebab}`, ({ params, request }) => {
      const pkg = packages.find((p) => p.id === params.id)
      if (!pkg) return notFound(params.id)
      const next = TRANSITION_MAP[transition]
      if (next && next !== "same") {
        pkg.status = next
        if (transition === "start_verification") {
          const email = request.headers.get("X-Auth-Request-Email")
          if (email) pkg.assignee = email
        }
      }
      return HttpResponse.json({})
    })
  }),

  http.post("/packages/import", () => HttpResponse.json({})),
  http.post("/packages/import-multiple", () => HttpResponse.json({})),

  // Transport-order edits — catch-all returning {} per openapi. Specific handlers
  // go here once the verification form is wired (Wave 6 follow-up).
  http.post("/packages/:id/transport-orders/*", () => HttpResponse.json({})),

  // Blob downloads — tiny placeholder so dev doesn't hit the network.
  http.get("/packages/:id/download", () => new HttpResponse(new Blob(["mock-zip"]))),
  http.get(
    "/packages/:id/download-result",
    () => new HttpResponse(new Blob(["{}"], { type: "application/json" })),
  ),
  http.get(
    "/packages/:id/export-csv",
    () => new HttpResponse(new Blob(["mock,csv"], { type: "text/csv" })),
  ),
  http.get(
    "/packages/:id/export-xml",
    () => new HttpResponse(new Blob(["<mock/>"], { type: "application/xml" })),
  ),
]
