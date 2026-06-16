import type {
  AttachRuleRequest,
  AutoClassifyResponse,
  CompileRuleRequest,
  CompileRuleResponse,
  DashboardStatsResponse,
  DeletePackagesRequest,
  DirtyPackageStatus,
  DocMode,
  DocType,
  ExplainRuleRequest,
  ExplainRuleResponse,
  ExportTemplateInfo,
  ExportValidationResponse,
  PackageActionReadModel,
  PackageActionType,
  PackageReadModel,
  PackageRuleAttachment,
  PackageRuleAttachmentsResponse,
  PackageSortField,
  PaginatedActionLogResponse,
  PaginatedDirtyPackageResponse,
  PaginatedPackageResponse,
  PaginatedRuleResponse,
  ProcessingState,
  PromoteDirtyPackageResponse,
  RuleCategory,
  RuleDetailsResponse,
  RulePreviewRequest,
  RulePreviewResponse,
  RuleReadModel,
  RuleStatus,
  RuleTemplateReadModel,
  RuleTrigger,
  RuleVersionReadModel,
  SaveRuleVersionRequest,
  SetAdditionalAiContextRequest,
  SetCustomStatusRequest,
  SetUserNotesRequest,
  SetUserPreferencesRequest,
  SortOrder,
  SourceFileReadModel,
  UpdateDocumentClassificationRequest,
  UpsertDraftRequest,
  UpsertRuleRequest,
  UserPreferencesResponse,
  VerificationState,
} from "@cortex/types"
import { http, HttpResponse, passthrough } from "msw"
import * as XLSX from "xlsx"
import { buildDirtyPackageDetails, buildDirtyPackages } from "./fixtures/classification"
import {
  allowedTransitions,
  buildActionLogs,
  buildDetails,
  packageActions,
} from "./fixtures/details"
import { buildPackageFixtures } from "./fixtures/packages"
import {
  attachRuleToPackage,
  buildRuleDetails,
  buildRules,
  compileRuleStub,
  detachRuleFromPackage,
  explainRuleStub,
  packageRuleAttachments,
  RULE_TEMPLATES,
} from "./fixtures/rules"
import { buildTransportOrders } from "./fixtures/transport-orders"

const packages = buildPackageFixtures(54)
const packagesById = new Map(packages.map((p) => [p.id, p]))

const dirtyPackages = buildDirtyPackages(12)
const dirtyById = new Map(dirtyPackages.map((p) => [p.id, p]))
const dirtyDetailsById = new Map(dirtyPackages.map((p) => [p.id, buildDirtyPackageDetails(p)]))

const rules = buildRules()
const rulesById = new Map(rules.map((r) => [r.id, r]))
const ruleDetailsById = new Map(rules.map((r) => [r.id, buildRuleDetails(r)]))

const userPreferences: UserPreferencesResponse = {
  document_panel_ratio: null,
  theme_mode: null,
  invoice_line_hidden_columns: null,
}

const liveActions = new Map<string, PackageActionReadModel[]>()
const additionalAiContextById = new Map<string, string | null>()

let cachedLogs: ReturnType<typeof buildActionLogs> | null = null
function getActionLogs() {
  if (!cachedLogs) cachedLogs = buildActionLogs(packages, liveActions)
  return cachedLogs
}
function invalidateLogs() {
  cachedLogs = null
}

function appendLiveAction(
  pkg: PackageReadModel,
  type: PackageActionType,
  actorEmail: string | null,
  payload?: unknown,
) {
  const existing = liveActions.get(pkg.id) ?? []
  const event: PackageActionReadModel = {
    id: `${pkg.id}-evt-live-${existing.length}`,
    action_type: type,
    timestamp: new Date().toISOString(),
    performed_by: actorEmail ?? "system@cortex.local",
    payload: payload ? JSON.stringify(payload) : null,
  }
  liveActions.set(pkg.id, [...existing, event])
  invalidateLogs()
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
    const av = a[sortBy] ?? ""
    const bv = b[sortBy] ?? ""
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

function hasMockScope(request: Request, scope: string): boolean {
  const raw =
    request.headers.get("X-Auth-Request-Scopes") ?? process.env.NEXT_PUBLIC_DEV_USER_SCOPES ?? ""
  return raw
    .split(",")
    .map((s) => s.trim())
    .includes(scope)
}

function applyTransition(pkg: PackageReadModel, transition: string, request: Request) {
  switch (transition) {
    case "start-verification":
      pkg.verification_state = "in_progress"
      pkg.assignee = authEmail(request) ?? pkg.assignee
      break
    case "cancel-verification":
      pkg.verification_state = "not_started"
      pkg.assignee = null
      break
    case "unlock-verification":
      pkg.verification_state = "not_started"
      pkg.assignee = null
      break
    case "finish-verification":
      pkg.verification_state = "completed"
      break
    case "reset-verification":
      pkg.verification_state = "not_started"
      pkg.assignee = null
      break
    case "reprocess":
      pkg.processing_state = "analysing"
      pkg.verification_state = "not_started"
      pkg.assignee = null
      break
  }
  invalidateLogs()
}

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

function syntheticXlsxResponse(rows: (string | number)[][]) {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer
  return new HttpResponse(buffer, {
    status: 200,
    headers: { "Content-Type": XLSX_CONTENT_TYPE },
  })
}

export const handlers = [
  // ── Real IDP passthrough (38 endpointów) ───────────────────────
  // Muszą być PRZED dynamicznymi handlerami typu /packages/:id,
  // inaczej mock by je łapał w dev mode z włączonym NEXT_PUBLIC_API_MOCKING.

  // User
  http.get("/user/me", () => passthrough()),
  http.get("/user/preferences", () => passthrough()),
  http.post("/user/preferences", () => passthrough()),

  // Config
  http.get("/config", () => passthrough()),
  http.get("/config/feature-flags", () => passthrough()),
  http.put("/config/feature-flags", () => passthrough()),
  http.post("/config/feature-flags/reload-from-env", () => passthrough()),
  http.get("/config/custom-statuses", () => passthrough()),

  // Module version (proxied to backend /version)
  http.get("/idp/version", () => passthrough()),

  // Packages — static paths
  http.get("/packages/dashboard-stats", () => passthrough()),
  http.get("/packages/get_all", () => passthrough()),
  http.get("/packages/action_logs", () => passthrough()),
  http.get("/packages/export-templates", () => passthrough()),
  http.post("/packages/import", () => passthrough()),
  http.post("/packages/import-email", () => passthrough()),
  http.post("/packages/import-multiple", () => passthrough()),
  http.post("/packages/delete", () => passthrough()),

  // Packages — dynamic GETs
  http.get("/packages/:id/actions", () => passthrough()),
  http.get("/packages/:id/transitions", () => passthrough()),
  http.get("/packages/:id/transport-orders", () => passthrough()),
  http.get("/packages/:id/source-files", () => passthrough()),
  http.get("/packages/:id/source-files/content", () => passthrough()),
  http.get("/packages/:id/download", () => passthrough()),
  http.get("/packages/:id/download-result", () => passthrough()),
  http.get("/packages/:id/export", () => passthrough()),
  http.get("/packages/:id/export/validate", () => passthrough()),
  http.get("/packages/:id", () => passthrough()),

  // Packages — verification workflow
  http.post("/packages/:id/start-verification", () => passthrough()),
  http.post("/packages/:id/cancel-verification", () => passthrough()),
  http.post("/packages/:id/unlock-verification", () => passthrough()),
  http.post("/packages/:id/finish-verification", () => passthrough()),
  http.post("/packages/:id/reset-verification", () => passthrough()),
  http.post("/packages/:id/reprocess", () => passthrough()),
  http.post("/packages/:id/export/email", () => passthrough()),

  // Packages — ops (custom status / notes / restore)
  http.post("/packages/:id/custom-status", () => passthrough()),
  http.post("/packages/:id/user-notes", () => passthrough()),
  http.post("/packages/:id/restore", () => passthrough()),

  // Transport order edits
  http.post("/packages/:pid/transport-orders/:oid/seller", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/buyer", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/consignor", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/consignee", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/transport-info", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/sad-context", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/totals", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/delivery-terms", () =>
    passthrough(),
  ),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/lines", () => passthrough()),

  // ── Dev-only helpers ───────────────────────────────────────────
  http.get("/health", () => HttpResponse.json({ status: "ok" })),

  // ── Mock fallback (dev z NEXT_PUBLIC_API_MOCKING=enabled + brak IDP) ──
  // Te handlery działają tylko gdy passthrough nie jest aktywny.
  // W prod (demo-dev) mocki są wyłączone globalnie.

  http.get("/user/me", ({ request }) => {
    const email = process.env.NEXT_PUBLIC_DEV_USER_EMAIL ?? "dev@cortex.local"
    const url = new URL(request.url)
    const hasAccessFlag = url.searchParams.get("has_access")
    const has_access = hasAccessFlag === "false" ? false : true
    return HttpResponse.json({ email, has_access })
  }),

  http.get("/api/me/access", ({ request }) => {
    const email = process.env.NEXT_PUBLIC_DEV_USER_EMAIL ?? "dev@cortex.local"
    const url = new URL(request.url)
    const allowedFlag = url.searchParams.get("allowed")
    const allowed = allowedFlag === "false" ? false : true
    return HttpResponse.json({ allowed, email })
  }),

  http.get("/idp/version", () => HttpResponse.json({ version: "1.13.0" })),

  http.get("/config", () =>
    HttpResponse.json({
      enable_classification: false,
      enable_customs_code: false,
      enable_atr_processing: false,
    }),
  ),

  http.get("/config/feature-flags", () =>
    HttpResponse.json({
      enable_verification_process: true,
      package_custom_statuses: false,
      enable_user_notes: false,
      enable_po_number: false,
      enable_customs_code: false,
      enable_additional_ai_context: false,
      enable_atr_processing: false,
      enable_document_preview: true,
      enable_classification: false,
      hide_menu_items: [],
      custom_statuses: ["Accounting Department", "Controling Department", "Accepted"],
      export_templates: ["csv_new", "standard_xml", "standard_json", "sad_xml"],
      sad_context_defaults: "",
      smtp_host: "smtp.gmail.com",
      smtp_port: 587,
      smtp_from_email: "idp@example.com",
      smtp_from_name: "Cortex IDP",
      smtp_use_tls: true,
      smtp_use_ssl: false,
      smtp_timeout_seconds: 10,
      gemini_model: "gemini-2.5-pro",
      gemini_fast_model: "gemini-3.5-flash",
      gemini_temperature: 0.1,
      gemini_fast_temperature: 0.4,
      gemini_thinking_budget: 12000,
    }),
  ),

  http.get("/user/preferences", () => HttpResponse.json(userPreferences)),

  http.post("/user/preferences", async ({ request }) => {
    const body = (await request.json()) as SetUserPreferencesRequest
    if ("theme_mode" in body) userPreferences.theme_mode = body.theme_mode ?? null
    if ("document_panel_ratio" in body)
      userPreferences.document_panel_ratio = body.document_panel_ratio ?? null
    if ("invoice_line_hidden_columns" in body)
      userPreferences.invoice_line_hidden_columns = body.invoice_line_hidden_columns ?? null
    return HttpResponse.json(userPreferences)
  }),

  http.get("/packages/dashboard-stats", () => HttpResponse.json(computeStats(packages))),

  http.get("/packages/get_all", ({ request }) => {
    const url = new URL(request.url)
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 10))
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    const processingFilter = url.searchParams.get("processing_state") as ProcessingState | null
    const verificationFilter = url.searchParams.get(
      "verification_state",
    ) as VerificationState | null
    const customStatusFilter = url.searchParams.get("custom_status")
    const assigneeFilter = url.searchParams.get("assignee")
    const uploadedByFilter = url.searchParams.get("uploaded_by")
    const search = url.searchParams.get("search")?.toLowerCase() ?? null
    const sortBy = (url.searchParams.get("sort_by") ?? "created_date") as PackageSortField
    const order = (url.searchParams.get("sort_order") ?? "desc") as SortOrder

    const dateFrom = url.searchParams.get("date_from")
    const dateTo = url.searchParams.get("date_to")

    let filtered = packages
    if (processingFilter) filtered = filtered.filter((p) => p.processing_state === processingFilter)
    if (verificationFilter)
      filtered = filtered.filter((p) => p.verification_state === verificationFilter)
    if (customStatusFilter)
      filtered = filtered.filter((p) => p.custom_status === customStatusFilter)
    if (assigneeFilter) {
      const needle = assigneeFilter.toLowerCase()
      filtered = filtered.filter((p) => p.assignee != null && p.assignee.toLowerCase() === needle)
    }
    if (uploadedByFilter) {
      const needle = uploadedByFilter.toLowerCase()
      filtered = filtered.filter(
        (p) => p.uploaded_by != null && p.uploaded_by.toLowerCase() === needle,
      )
    }
    if (search) {
      filtered = filtered.filter(
        (p) =>
          p.file_name.toLowerCase().includes(search) ||
          (p.package_name?.toLowerCase().includes(search) ?? false),
      )
    }
    if (dateFrom) filtered = filtered.filter((p) => p.created_date.slice(0, 10) >= dateFrom)
    if (dateTo) filtered = filtered.filter((p) => p.created_date.slice(0, 10) <= dateTo)

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
    if (performedBy) all = all.filter((e) => e.performed_by.toLowerCase().includes(performedBy))
    if (dateFrom) all = all.filter((e) => e.timestamp.slice(0, 10) >= dateFrom)
    if (dateTo) all = all.filter((e) => e.timestamp.slice(0, 10) <= dateTo)

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
    const details = buildDetails(pkg)
    const override = additionalAiContextById.get(pkg.id)
    if (override !== undefined) details.last_additional_ai_context = override
    return HttpResponse.json(details)
  }),

  http.get("/packages/:id/actions", ({ params }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({
      package_id: pkg.id,
      actions: packageActions(packages, pkg.id, liveActions),
    })
  }),

  http.get("/packages/:id/transitions", ({ params, request }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    return HttpResponse.json({
      transitions: allowedTransitions(
        pkg,
        authEmail(request),
        hasMockScope(request, "package_unlock"),
      ),
    })
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
      {
        path: "summary.docx",
        file_name: "summary.docx",
        media_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        preview_kind: "download_only",
        size_bytes: 18_240,
      },
    ]
    return HttpResponse.json(body)
  }),

  http.get("/packages/:id/source-files/content", async ({ request }) => {
    const url = new URL(request.url)
    const path = url.searchParams.get("path") ?? ""
    const lower = path.toLowerCase()
    if (lower.endsWith(".pdf")) {
      const asset = await fetch("/mock-assets/sample-invoice.pdf")
      const blob = await asset.blob()
      return new HttpResponse(blob, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      })
    }
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
      return syntheticXlsxResponse([
        ["CN code", "Description", "Qty", "Net (kg)", "Value (EUR)"],
        ["8541", "Electronic components", 250, 18.5, 4820.0],
        ["7307", "Steel fittings", 85, 142.3, 2910.5],
        ["3926", "Plastic housings", 500, 43.1, 4720.25],
      ])
    }
    return new HttpResponse(new Blob(["mock-bytes"]), { status: 200 })
  }),

  http.get("/packages/:id/export/validate", () => {
    const body: ExportValidationResponse = { warnings: [] }
    return HttpResponse.json(body)
  }),

  http.get(
    "/packages/:id/export",
    () => new HttpResponse(new Blob(["mock,export"], { type: "text/csv" })),
  ),

  http.post("/packages/:id/export/email", async ({ request }) => {
    const url = new URL(request.url)
    const template = url.searchParams.get("template") ?? "export"
    const body = (await request.json().catch(() => ({}))) as { to_email?: string }
    return HttpResponse.json({
      sent_to:
        body.to_email?.trim() || process.env.NEXT_PUBLIC_DEV_USER_EMAIL || "dev@cortex.local",
      file_name: `mock_${template}.csv`,
    })
  }),

  ...[
    "start-verification",
    "cancel-verification",
    "unlock-verification",
    "finish-verification",
    "reset-verification",
  ].map((transition) =>
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
    appendLiveAction(pkg, "custom_status_updated", authEmail(request), {
      custom_status: body.custom_status ?? null,
    })
    return HttpResponse.json({})
  }),

  http.post("/packages/:id/user-notes", async ({ params, request }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    const body = (await request.json()) as SetUserNotesRequest
    pkg.user_notes = body.user_notes ?? null
    appendLiveAction(pkg, "user_notes_updated", authEmail(request))
    return HttpResponse.json({})
  }),

  http.post("/packages/:id/additional-ai-context", async ({ params, request }) => {
    const pkg = packagesById.get(String(params.id))
    if (!pkg) return notFound(params.id)
    const body = (await request.json()) as SetAdditionalAiContextRequest
    additionalAiContextById.set(pkg.id, body.additional_ai_context ?? null)
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

  http.post("/packages/import", () => HttpResponse.json({ id: crypto.randomUUID() })),
  http.post("/packages/import-email", () => HttpResponse.json({ id: crypto.randomUUID() })),
  http.post("/packages/import-multiple", () => HttpResponse.json({ id: crypto.randomUUID() })),

  // Transport-order edits — catch-all returning {} per openapi.
  http.post("/packages/:id/transport-orders/*", () => HttpResponse.json({})),

  // Blob downloads — tiny placeholder so dev doesn't hit the network.
  http.get("/packages/:id/download", () => new HttpResponse(new Blob(["mock-zip"]))),
  http.get(
    "/packages/:id/download-result",
    () => new HttpResponse(new Blob(["{}"], { type: "application/json" })),
  ),

  // ── Classification ──────────────────────────────────────────────
  http.get("/classification/dirty-packages", ({ request }) => {
    const url = new URL(request.url)
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 25))
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    const status = url.searchParams.get("status") as DirtyPackageStatus | null
    const customer = url.searchParams.get("customer_tag")
    const search = url.searchParams.get("search")?.toLowerCase() ?? null
    const sortBy = (url.searchParams.get("sort_by") ?? "created_date") as
      | "created_date"
      | "name"
      | "status"
    const sortOrder = (url.searchParams.get("sort_order") ?? "desc") as "asc" | "desc"

    let filtered = [...dirtyPackages]
    if (status) filtered = filtered.filter((p) => p.status === status)
    if (customer) filtered = filtered.filter((p) => p.customer_tag === customer)
    if (search) filtered = filtered.filter((p) => p.name.toLowerCase().includes(search))

    filtered.sort((a, b) => {
      const av = a[sortBy] ?? ""
      const bv = b[sortBy] ?? ""
      if (av === bv) return 0
      return (av < bv ? -1 : 1) * (sortOrder === "asc" ? 1 : -1)
    })

    const body: PaginatedDirtyPackageResponse = {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    }
    return HttpResponse.json(body)
  }),

  http.get("/classification/dirty-packages/:id", ({ params }) => {
    const details = dirtyDetailsById.get(String(params.id))
    if (!details) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Dirty package not found" },
        { status: 404 },
      )
    }
    return HttpResponse.json(details)
  }),

  http.get("/classification/dirty-packages/:id/documents/:docId/content", async ({ params }) => {
    const details = dirtyDetailsById.get(String(params.id))
    const doc = details?.documents.find((d) => d.id === String(params.docId))
    if (!doc) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Document not found" },
        { status: 404 },
      )
    }
    if (doc.preview_kind === "pdf") {
      const asset = await fetch("/mock-assets/sample-invoice.pdf")
      const blob = await asset.blob()
      return new HttpResponse(blob, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      })
    }
    if (doc.preview_kind === "image") {
      // 1x1 transparent PNG placeholder; real backend returns actual image bytes.
      const placeholder = Uint8Array.from(
        atob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        ),
        (c) => c.charCodeAt(0),
      )
      return new HttpResponse(placeholder, {
        status: 200,
        headers: { "Content-Type": doc.media_type },
      })
    }
    if (doc.file_name.toLowerCase().endsWith(".xlsx")) {
      return syntheticXlsxResponse([
        ["CN code", "Description", "Qty"],
        ["8541", "Sample row", 100],
      ])
    }
    return new HttpResponse(new Blob(["mock-bytes"]), { status: 200 })
  }),

  http.post("/classification/dirty-packages/:id/auto-classify", ({ params }) => {
    const details = dirtyDetailsById.get(String(params.id))
    const summary = dirtyById.get(String(params.id))
    if (!details || !summary) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Dirty package not found" },
        { status: 404 },
      )
    }
    summary.status = "classified"
    summary.needs_review_count = Math.max(0, Math.floor(details.documents.length * 0.2))
    details.status = "classified"
    details.last_classification_run_at = new Date().toISOString()
    for (const doc of details.documents) {
      if (doc.confidence === null) doc.confidence = 0.8
    }
    const body: AutoClassifyResponse = {
      classification_run_id: `clrun-${Date.now()}`,
      documents_updated: details.documents.length,
      drafts_proposed: details.drafts.length,
    }
    return HttpResponse.json(body)
  }),

  http.patch("/classification/dirty-packages/:id/documents/:docId", async ({ params, request }) => {
    const details = dirtyDetailsById.get(String(params.id))
    if (!details) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Dirty package not found" },
        { status: 404 },
      )
    }
    const doc = details.documents.find((d) => d.id === String(params.docId))
    if (!doc) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Document not found" },
        { status: 404 },
      )
    }
    const body = (await request.json()) as UpdateDocumentClassificationRequest
    if (body.doc_type !== undefined) doc.doc_type = body.doc_type as DocType
    if (body.mode !== undefined) doc.mode = body.mode as DocMode
    if (body.target_clean_package_ids !== undefined) {
      const nextIds = new Set(body.target_clean_package_ids)
      const previousIds = new Set(doc.target_clean_package_ids)
      doc.target_clean_package_ids = [...nextIds]
      for (const draft of details.drafts) {
        const shouldHave = nextIds.has(draft.id)
        const currentlyHas = draft.document_ids.includes(doc.id)
        if (shouldHave && !currentlyHas) draft.document_ids.push(doc.id)
        else if (!shouldHave && currentlyHas && previousIds.has(draft.id)) {
          draft.document_ids = draft.document_ids.filter((x) => x !== doc.id)
        }
      }
    }
    if (body.notes !== undefined) doc.notes = body.notes
    if (body.human_reviewed !== undefined) doc.human_reviewed = body.human_reviewed
    return HttpResponse.json({})
  }),

  http.post("/classification/dirty-packages/:id/drafts", async ({ params, request }) => {
    const details = dirtyDetailsById.get(String(params.id))
    if (!details) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Dirty package not found" },
        { status: 404 },
      )
    }
    const body = (await request.json()) as UpsertDraftRequest
    if (body.id) {
      const existing = details.drafts.find((d) => d.id === body.id)
      if (existing) {
        existing.name = body.name
        existing.customer_tag = body.customer_tag ?? null
        existing.notes = body.notes ?? null
        return HttpResponse.json(existing)
      }
    }
    const draft = {
      id: `${details.id}-draft-${details.drafts.length}`,
      name: body.name,
      document_ids: [],
      customer_tag: body.customer_tag ?? null,
      notes: body.notes ?? null,
    }
    details.drafts.push(draft)
    return HttpResponse.json(draft)
  }),

  http.delete("/classification/dirty-packages/:id/drafts/:draftId", ({ params }) => {
    const details = dirtyDetailsById.get(String(params.id))
    if (!details) return HttpResponse.json({}, { status: 404 })
    details.drafts = details.drafts.filter((d) => d.id !== String(params.draftId))
    for (const doc of details.documents) {
      doc.target_clean_package_ids = doc.target_clean_package_ids.filter(
        (x) => x !== String(params.draftId),
      )
    }
    return HttpResponse.json({})
  }),

  http.post("/classification/dirty-packages/:id/promote", ({ params }) => {
    const details = dirtyDetailsById.get(String(params.id))
    const summary = dirtyById.get(String(params.id))
    if (!details || !summary) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Dirty package not found" },
        { status: 404 },
      )
    }
    const cleanIds = details.drafts.map((_, idx) => `pkg-${Date.now()}-${idx}`)
    summary.status = "promoted"
    summary.promoted_clean_package_ids = cleanIds
    details.status = "promoted"
    details.promoted_clean_package_ids = cleanIds
    const skipped = details.documents.filter((d) => d.mode === "skip").length
    const body: PromoteDirtyPackageResponse = {
      clean_package_ids: cleanIds,
      skipped_documents: skipped,
    }
    return HttpResponse.json(body)
  }),

  // ── Rules ───────────────────────────────────────────────────────
  http.get("/rules/templates", () => {
    const body: RuleTemplateReadModel[] = RULE_TEMPLATES
    return HttpResponse.json(body)
  }),

  http.get("/rules", ({ request }) => {
    const url = new URL(request.url)
    const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50))
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    const status = url.searchParams.get("status") as RuleStatus | null
    const category = url.searchParams.get("category") as RuleCategory | null
    const search = url.searchParams.get("search")?.toLowerCase() ?? null

    let filtered: RuleReadModel[] = rules
    if (status) filtered = filtered.filter((r) => r.status === status)
    if (category) filtered = filtered.filter((r) => r.category === category)
    if (search) filtered = filtered.filter((r) => r.name.toLowerCase().includes(search))

    const body: PaginatedRuleResponse = {
      items: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    }
    return HttpResponse.json(body)
  }),

  http.post("/rules", async ({ request }) => {
    const body = (await request.json()) as UpsertRuleRequest
    const id = `rule-${String(rules.length + 1).padStart(4, "0")}`
    const newRule: RuleReadModel = {
      id,
      name: body.name,
      description: body.description ?? null,
      category: body.category,
      status: body.status ?? "draft",
      current_version: 0,
      tags: body.tags ?? [],
      customer_tag: body.customer_tag ?? null,
      trigger: body.trigger ?? "manual",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_run_at: null,
      attached_package_count: 0,
    }
    rules.push(newRule)
    rulesById.set(id, newRule)
    const details: RuleDetailsResponse = {
      ...newRule,
      versions: [],
    }
    ruleDetailsById.set(id, details)
    return HttpResponse.json(newRule)
  }),

  http.get("/rules/:id", ({ params }) => {
    const details = ruleDetailsById.get(String(params.id))
    if (!details) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Rule not found" },
        { status: 404 },
      )
    }
    return HttpResponse.json(details)
  }),

  http.patch("/rules/:id", async ({ params, request }) => {
    const rule = rulesById.get(String(params.id))
    const details = ruleDetailsById.get(String(params.id))
    if (!rule || !details) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Rule not found" },
        { status: 404 },
      )
    }
    const body = (await request.json()) as UpsertRuleRequest
    rule.name = body.name
    rule.description = body.description ?? null
    rule.category = body.category
    rule.tags = body.tags ?? rule.tags
    rule.customer_tag = body.customer_tag ?? null
    if (body.trigger) rule.trigger = body.trigger
    if (body.status) rule.status = body.status
    rule.updated_at = new Date().toISOString()
    Object.assign(details, {
      name: rule.name,
      description: rule.description,
      category: rule.category,
      tags: rule.tags,
      customer_tag: rule.customer_tag,
      trigger: rule.trigger,
      status: rule.status,
    })
    return HttpResponse.json({})
  }),

  http.post("/rules/compile", async ({ request }) => {
    const body = (await request.json()) as CompileRuleRequest
    await new Promise((resolve) => setTimeout(resolve, 500)) // mock LLM latency
    const result = compileRuleStub(body.nl_definition)
    const response: CompileRuleResponse = result
    return HttpResponse.json(response)
  }),

  http.post("/rules/explain", async ({ request }) => {
    const body = (await request.json()) as ExplainRuleRequest
    await new Promise((resolve) => setTimeout(resolve, 350)) // mock LLM latency
    const response: ExplainRuleResponse = explainRuleStub(body.nl_definition)
    return HttpResponse.json(response)
  }),

  http.post("/rules/preview", async ({ request }) => {
    const body = (await request.json()) as RulePreviewRequest
    const lineCount = 6
    const rows = Array.from({ length: lineCount }, (_, i) => ({
      line_number: i + 1,
      before: {
        product_code: `SKU-${100 + i}`,
        net_weight_kg: 10 + i * 2,
        invoice_value: 200 + i * 50,
      } as Record<string, string | number | null>,
      after: {
        product_code: `SKU-${100 + i}`,
        net_weight_kg: 10 + i * 2,
        invoice_value: 200 + i * 50,
        freight_share: Math.round((10 + i * 2) * 3.5 * 100) / 100,
      } as Record<string, string | number | null>,
      changed_columns: ["freight_share"],
    }))
    const response: RulePreviewResponse = {
      rows,
      added_columns: ["freight_share"],
      warnings: [],
      errors: body.python_code.length === 0 ? ["python_code is empty"] : [],
    }
    return HttpResponse.json(response)
  }),

  http.post("/rules/:id/versions", async ({ params, request }) => {
    const details = ruleDetailsById.get(String(params.id))
    const rule = rulesById.get(String(params.id))
    if (!details || !rule) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Rule not found" },
        { status: 404 },
      )
    }
    const body = (await request.json()) as SaveRuleVersionRequest
    const version = (details.versions[0]?.version ?? 0) + 1
    const newVersion: RuleVersionReadModel = {
      version,
      nl_definition: body.nl_definition,
      python_code: body.python_code,
      output_columns: body.output_columns,
      created_at: new Date().toISOString(),
      created_by: "demo@cortex.local",
      notes: body.notes ?? null,
    }
    details.versions = [newVersion, ...details.versions]
    details.current_version = version
    rule.current_version = version
    rule.updated_at = newVersion.created_at
    return HttpResponse.json(newVersion)
  }),

  // ── Package ↔ Rules attachments ─────────────────────────────────
  http.get("/packages/:id/rules", ({ params }) => {
    const id = String(params.id)
    const body: PackageRuleAttachmentsResponse = {
      package_id: id,
      attachments: packageRuleAttachments(id),
    }
    return HttpResponse.json(body)
  }),

  http.post("/packages/:id/rules", async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json()) as AttachRuleRequest
    const rule = rulesById.get(body.rule_id)
    if (!rule) {
      return HttpResponse.json(
        { error_code: "ENTITY_NOT_FOUND", message: "Rule not found" },
        { status: 404 },
      )
    }
    const trigger: RuleTrigger = body.trigger ?? "manual"
    const attachment: PackageRuleAttachment = attachRuleToPackage(id, rule, trigger)
    return HttpResponse.json(attachment)
  }),

  http.delete("/packages/:id/rules/:attachmentId", ({ params }) => {
    detachRuleFromPackage(String(params.id), String(params.attachmentId))
    return HttpResponse.json({})
  }),

  http.post("/packages/:id/rules/:attachmentId/run", ({ params }) => {
    const list = packageRuleAttachments(String(params.id))
    const att = list.find((a) => a.id === String(params.attachmentId))
    if (att) {
      att.last_executed_at = new Date().toISOString()
      att.last_status = "success"
    }
    return HttpResponse.json({})
  }),
]
