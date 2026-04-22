import type {
  AttachRuleRequest,
  AutoClassifyResponse,
  CompileRuleRequest,
  CompileRuleResponse,
  ExplainRuleRequest,
  ExplainRuleResponse,
  DeletePackagesRequest,
  DirtyPackageStatus,
  DocMode,
  DocType,
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
import {
  buildDirtyPackageDetails,
  buildDirtyPackages,
} from "./fixtures/classification"
import {
  allowedTransitions,
  buildActionLogs,
  buildDetails,
  packageActions,
} from "./fixtures/details"
import { buildPackageFixtures } from "./fixtures/packages"
import {
  RULE_TEMPLATES,
  attachRuleToPackage,
  buildRuleDetails,
  buildRules,
  compileRuleStub,
  detachRuleFromPackage,
  explainRuleStub,
  packageRuleAttachments,
} from "./fixtures/rules"
import { buildTransportOrders } from "./fixtures/transport-orders"

const packages = buildPackageFixtures(54)
const packagesById = new Map(packages.map((p) => [p.id, p]))

const dirtyPackages = buildDirtyPackages(12)
const dirtyById = new Map(dirtyPackages.map((p) => [p.id, p]))
const dirtyDetailsById = new Map(
  dirtyPackages.map((p) => [p.id, buildDirtyPackageDetails(p)]),
)

const rules = buildRules()
const rulesById = new Map(rules.map((r) => [r.id, r]))
const ruleDetailsById = new Map(rules.map((r) => [r.id, buildRuleDetails(r)]))

const userPreferences: UserPreferencesResponse = {
  document_panel_ratio: null,
  theme_mode: null,
}

const liveActions = new Map<string, PackageActionReadModel[]>()

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
  // MSW carve-out: explicit passthrough tych endpointów musi być PRZED dynamicznymi
  // handlerami typu /packages/:id, które inaczej je łapią.
  http.get("/user/me", () => passthrough()),
  http.get("/packages/dashboard-stats", () => passthrough()),
  http.get("/packages/get_all", () => passthrough()),
  http.get("/packages/action_logs", () => passthrough()),
  http.get("/packages/:id/actions", () => passthrough()),
  http.get("/packages/:id/transitions", () => passthrough()),
  http.get("/packages/:id/transport-orders", () => passthrough()),
  http.get("/packages/:id/download", () => passthrough()),
  http.get("/packages/:id/download-result", () => passthrough()),
  http.get("/packages/:id", () => passthrough()),
  http.post("/packages/import", () => passthrough()),
  http.post("/packages/import-multiple", () => passthrough()),
  http.post("/packages/:id/start-verification", () => passthrough()),
  http.post("/packages/:id/cancel-verification", () => passthrough()),
  http.post("/packages/:id/finish-verification", () => passthrough()),
  http.post("/packages/:id/reset-verification", () => passthrough()),
  http.post("/packages/:id/reprocess", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/seller", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/buyer", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/consignor", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/consignee", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/transport-info", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/totals", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/delivery-terms", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/lines", () => passthrough()),

  http.get("/health", () => HttpResponse.json({ status: "ok" })),

  http.get("/user/preferences", () => HttpResponse.json(userPreferences)),

  http.post("/user/preferences", async ({ request }) => {
    const body = (await request.json()) as SetUserPreferencesRequest
    if ("theme_mode" in body) userPreferences.theme_mode = body.theme_mode ?? null
    if ("document_panel_ratio" in body)
      userPreferences.document_panel_ratio = body.document_panel_ratio ?? null
    return HttpResponse.json(userPreferences)
  }),

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

    const dateFrom = url.searchParams.get("date_from")
    const dateTo = url.searchParams.get("date_to")

    let filtered = packages
    if (processingFilter) filtered = filtered.filter((p) => p.processing_state === processingFilter)
    if (verificationFilter)
      filtered = filtered.filter((p) => p.verification_state === verificationFilter)
    if (customStatusFilter)
      filtered = filtered.filter((p) => p.custom_status === customStatusFilter)
    if (search) filtered = filtered.filter((p) => p.file_name.toLowerCase().includes(search))
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
    if (performedBy)
      all = all.filter((e) => e.performed_by.toLowerCase().includes(performedBy))
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
    return HttpResponse.json(buildDetails(pkg))
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

  http.get("/packages/:id/source-files/content", async ({ request }) => {
    const url = new URL(request.url)
    const path = url.searchParams.get("path") ?? ""
    if (path.toLowerCase().endsWith(".pdf")) {
      const asset = await fetch("/mock-assets/sample-invoice.pdf")
      const blob = await asset.blob()
      return new HttpResponse(blob, {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      })
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

    let filtered = dirtyPackages
    if (status) filtered = filtered.filter((p) => p.status === status)
    if (customer) filtered = filtered.filter((p) => p.customer_tag === customer)
    if (search) filtered = filtered.filter((p) => p.name.toLowerCase().includes(search))

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

  http.get(
    "/classification/dirty-packages/:id/documents/:docId/content",
    async ({ params }) => {
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
      return new HttpResponse(new Blob(["mock-bytes"]), { status: 200 })
    },
  ),

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

  http.patch(
    "/classification/dirty-packages/:id/documents/:docId",
    async ({ params, request }) => {
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
      if (body.target_clean_package_id !== undefined) {
        const previous = doc.target_clean_package_id
        if (previous) {
          const draft = details.drafts.find((d) => d.id === previous)
          if (draft) draft.document_ids = draft.document_ids.filter((x) => x !== doc.id)
        }
        doc.target_clean_package_id = body.target_clean_package_id ?? null
        if (doc.target_clean_package_id) {
          const draft = details.drafts.find((d) => d.id === doc.target_clean_package_id)
          if (draft && !draft.document_ids.includes(doc.id))
            draft.document_ids.push(doc.id)
        }
      }
      if (body.notes !== undefined) doc.notes = body.notes
      if (body.human_reviewed !== undefined) doc.human_reviewed = body.human_reviewed
      return HttpResponse.json({})
    },
  ),

  http.post(
    "/classification/dirty-packages/:id/drafts",
    async ({ params, request }) => {
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
    },
  ),

  http.delete(
    "/classification/dirty-packages/:id/drafts/:draftId",
    ({ params }) => {
      const details = dirtyDetailsById.get(String(params.id))
      if (!details) return HttpResponse.json({}, { status: 404 })
      details.drafts = details.drafts.filter((d) => d.id !== String(params.draftId))
      for (const doc of details.documents) {
        if (doc.target_clean_package_id === String(params.draftId))
          doc.target_clean_package_id = null
      }
      return HttpResponse.json({})
    },
  ),

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
