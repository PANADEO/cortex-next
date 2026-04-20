import type {
  DashboardStatsResponse,
  DeletePackagesRequest,
  ExportTemplateInfo,
  ExportValidationResponse,
  PackageActionType,
  PackageReadModel,
  PackageSortField,
  PaginatedActionLogResponse,
  PaginatedPackageResponse,
  ProcessingState,
  SetCustomStatusRequest,
  SetUserNotesRequest,
  SetUserPreferencesRequest,
  SortOrder,
  SourceFileReadModel,
  UserInfoResponse,
  UserPreferencesResponse,
  VerificationState,
} from "@cortex/types"
import { http, HttpResponse } from "msw"
import {
  allowedTransitions,
  buildActionLogs,
  buildDetails,
  packageActions,
} from "./fixtures/details"
import { buildPackageFixtures } from "./fixtures/packages"
import { buildTransportOrders } from "./fixtures/transport-orders"

const packages = buildPackageFixtures(54)
const packagesById = new Map(packages.map((p) => [p.id, p]))

const userPreferences: UserPreferencesResponse = {
  document_panel_ratio: null,
  theme_mode: null,
}

let cachedLogs: ReturnType<typeof buildActionLogs> | null = null
function getActionLogs() {
  if (!cachedLogs) cachedLogs = buildActionLogs(packages)
  return cachedLogs
}
function invalidateLogs() {
  cachedLogs = null
}

function computeStats(items: PackageReadModel[]): DashboardStatsResponse {
  let in_queue = 0
  let processing = 0
  let ready_for_verification = 0
  let in_verification = 0
  let verified = 0
  let failed = 0

  for (const p of items) {
    switch (p.processing_state) {
      case "imported":
        in_queue++
        break
      case "analysing":
        processing++
        break
      case "imported_with_error":
      case "analysis_failed":
        failed++
        break
      case "ready":
        if (p.verification_state === "not_started") ready_for_verification++
        else if (p.verification_state === "in_progress") in_verification++
        else verified++
        break
    }
  }
  return { in_queue, processing, ready_for_verification, in_verification, verified, failed }
}

function sortPackages(
  items: PackageReadModel[],
  sortBy: PackageSortField,
  order: SortOrder,
): PackageReadModel[] {
  const sign = order === "desc" ? -1 : 1
  return [...items].sort((a, b) => {
    const av = a[sortBy]
    const bv = b[sortBy]
    if (av === bv) return 0
    return av < bv ? -sign : sign
  })
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

function authEmail(request: Request): string | null {
  return request.headers.get("X-Auth-Request-Email")
}

function applyTransition(pkg: PackageReadModel, transition: string, request: Request) {
  switch (transition) {
    case "start-verification":
      pkg.verification_state = "in_progress"
      pkg.assignee = authEmail(request) ?? pkg.assignee
      break
    case "cancel-verification":
      pkg.verification_state = "not_started"
      break
    case "finish-verification":
      pkg.verification_state = "completed"
      break
    case "reset-verification":
      pkg.verification_state = "not_started"
      break
    case "reprocess":
      pkg.processing_state = "analysing"
      pkg.verification_state = "not_started"
      break
  }
  invalidateLogs()
}

export const handlers = [
  http.get("/health", () => HttpResponse.json({ status: "ok" })),

  http.get("/user/me", ({ request }) => {
    const email = authEmail(request) ?? "demo@cortex.local"
    const body: UserInfoResponse = { email, has_access: true }
    return HttpResponse.json(body)
  }),

  http.get("/user/preferences", () => HttpResponse.json(userPreferences)),

  http.post("/user/preferences", async ({ request }) => {
    const body = (await request.json()) as SetUserPreferencesRequest
    if ("theme_mode" in body) userPreferences.theme_mode = body.theme_mode ?? null
    if ("document_panel_ratio" in body)
      userPreferences.document_panel_ratio = body.document_panel_ratio ?? null
    return HttpResponse.json(userPreferences)
  }),

  http.get("/packages/dashboard-stats", () => HttpResponse.json(computeStats(packages))),

  http.get("/packages/get_all", ({ request }) => {
    const url = new URL(request.url)
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 10))
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    const processingFilter = url.searchParams.get("processing_state") as ProcessingState | null
    const verificationFilter = url.searchParams.get("verification_state") as VerificationState | null
    const customStatusFilter = url.searchParams.get("custom_status")
    const search = url.searchParams.get("search")?.toLowerCase() ?? null
    const sortBy = (url.searchParams.get("sort_by") ?? "created_date") as PackageSortField
    const order = (url.searchParams.get("sort_order") ?? "desc") as SortOrder

    let filtered = packages
    if (processingFilter) filtered = filtered.filter((p) => p.processing_state === processingFilter)
    if (verificationFilter)
      filtered = filtered.filter((p) => p.verification_state === verificationFilter)
    if (customStatusFilter)
      filtered = filtered.filter((p) => p.custom_status === customStatusFilter)
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

    let all = getActionLogs()
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

  http.get("/packages/export-templates", () => {
    const body: ExportTemplateInfo[] = [
      {
        name: "default_csv",
        display_name: "Default CSV",
        format: "csv",
        description: "Flat line-items export",
      },
      {
        name: "customs_xml",
        display_name: "Customs XML",
        format: "xml",
        description: "XML zgodny z eksportem celnym",
      },
    ]
    return HttpResponse.json(body)
  }),

  http.get("/packages/:id", ({ params }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    return HttpResponse.json(buildDetails(pkg))
  }),

  http.get("/packages/:id/actions", ({ params }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({
      package_id: pkg.id,
      actions: packageActions(packages, pkg.id),
    })
  }),

  http.get("/packages/:id/transitions", ({ params, request }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({ transitions: allowedTransitions(pkg, authEmail(request)) })
  }),

  http.get("/packages/:id/transport-orders", ({ params }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({
      package_id: pkg.id,
      ...buildTransportOrders(pkg),
    })
  }),

  http.get("/packages/:id/source-files", ({ params }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    const body: SourceFileReadModel[] = [
      {
        path: "invoice.pdf",
        file_name: "invoice.pdf",
        media_type: "application/pdf",
        preview_kind: "pdf",
        size_bytes: 234_567,
      },
      {
        path: "packing-list.xlsx",
        file_name: "packing-list.xlsx",
        media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        preview_kind: "download_only",
        size_bytes: 45_120,
      },
    ]
    return HttpResponse.json(body)
  }),

  http.get(
    "/packages/:id/source-files/content",
    () => new HttpResponse(new Blob(["mock-bytes"]), { status: 200 }),
  ),

  http.get("/packages/:id/export/validate", () => {
    const body: ExportValidationResponse = { warnings: [] }
    return HttpResponse.json(body)
  }),

  http.get(
    "/packages/:id/export",
    () => new HttpResponse(new Blob(["mock,export"], { type: "text/csv" })),
  ),

  ...["start-verification", "cancel-verification", "finish-verification", "reset-verification"].map(
    (transition) =>
      http.post(`/packages/:id/${transition}`, ({ params, request }) => {
        const pkg = packagesById.get(String(params.id))
        if (!pkg) return notFound(params.id)
        applyTransition(pkg, transition, request)
        return HttpResponse.json({})
      }),
  ),

  http.post("/packages/:id/reprocess", ({ params, request }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    applyTransition(pkg, "reprocess", request)
    return HttpResponse.json({})
  }),

  http.post("/packages/:id/custom-status", async ({ params, request }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    const body = (await request.json()) as SetCustomStatusRequest
    pkg.custom_status = body.custom_status ?? null
    invalidateLogs()
    return HttpResponse.json({})
  }),

  http.post("/packages/:id/user-notes", async ({ params, request }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    const body = (await request.json()) as SetUserNotesRequest
    pkg.user_notes = body.user_notes ?? null
    invalidateLogs()
    return HttpResponse.json({})
  }),

  http.post("/packages/:id/restore", ({ params }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    invalidateLogs()
    return HttpResponse.json({})
  }),

  http.post("/packages/delete", async ({ request }) => {
    const body = (await request.json()) as DeletePackagesRequest
    for (const id of body.package_ids) packagesById.delete(id)
    invalidateLogs()
    return HttpResponse.json({})
  }),

  http.post("/packages/import", () => HttpResponse.json({})),
  http.post("/packages/import-multiple", () => HttpResponse.json({})),

  // Transport-order edits — catch-all returning {} per openapi.
  http.post("/packages/:id/transport-orders/*", () => HttpResponse.json({})),

  // Blob downloads — tiny placeholder so dev doesn't hit the network.
  http.get("/packages/:id/download", () => new HttpResponse(new Blob(["mock-zip"]))),
  http.get(
    "/packages/:id/download-result",
    () => new HttpResponse(new Blob(["{}"], { type: "application/json" })),
  ),
]
