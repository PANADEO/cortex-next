import type {
  AttachRuleRequest,
  AutoClassifyResponse,
  CompileRuleRequest,
  CompileRuleResponse,
  ExplainRuleRequest,
  ExplainRuleResponse,
  DirtyPackageStatus,
  DocMode,
  DocType,
  PackageRuleAttachment,
  PackageRuleAttachmentsResponse,
  PaginatedDirtyPackageResponse,
  PaginatedRuleResponse,
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
  UpdateDocumentClassificationRequest,
  UpsertDraftRequest,
  UpsertRuleRequest,
} from "@cortex/types"
import { http, HttpResponse, passthrough } from "msw"
import {
  buildDirtyPackageDetails,
  buildDirtyPackages,
} from "./fixtures/classification"
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

const dirtyPackages = buildDirtyPackages(12)
const dirtyById = new Map(dirtyPackages.map((p) => [p.id, p]))
const dirtyDetailsById = new Map(
  dirtyPackages.map((p) => [p.id, buildDirtyPackageDetails(p)]),
)

const rules = buildRules()
const rulesById = new Map(rules.map((r) => [r.id, r]))
const ruleDetailsById = new Map(rules.map((r) => [r.id, buildRuleDetails(r)]))

export const handlers = [
  // ── Real IDP passthrough (38 endpointów) ───────────────────────
  // Muszą być PRZED dynamicznymi handlerami typu /packages/:id,
  // inaczej mock by je łapał w dev mode.

  // User
  http.get("/user/me", () => passthrough()),
  http.get("/user/preferences", () => passthrough()),
  http.post("/user/preferences", () => passthrough()),

  // Config
  http.get("/config/custom-statuses", () => passthrough()),

  // Packages — static paths
  http.get("/packages/dashboard-stats", () => passthrough()),
  http.get("/packages/get_all", () => passthrough()),
  http.get("/packages/action_logs", () => passthrough()),
  http.get("/packages/export-templates", () => passthrough()),
  http.post("/packages/import", () => passthrough()),
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
  http.post("/packages/:id/finish-verification", () => passthrough()),
  http.post("/packages/:id/reset-verification", () => passthrough()),
  http.post("/packages/:id/reprocess", () => passthrough()),

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
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/totals", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/delivery-terms", () => passthrough()),
  http.post("/packages/:pid/transport-orders/:oid/invoices/:iid/lines", () => passthrough()),

  // ── Dev-only helpers ───────────────────────────────────────────
  http.get("/health", () => HttpResponse.json({ status: "ok" })),

  // ── Mocki: Classification (IDP nie ma — Wave 14+ feature) ──────
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

  // ── Mocki: Rules (IDP nie ma — Wave 18-19 feature) ──────────────
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
    await new Promise((resolve) => setTimeout(resolve, 500))
    const result = compileRuleStub(body.nl_definition)
    const response: CompileRuleResponse = result
    return HttpResponse.json(response)
  }),

  http.post("/rules/explain", async ({ request }) => {
    const body = (await request.json()) as ExplainRuleRequest
    await new Promise((resolve) => setTimeout(resolve, 350))
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

  // ── Mocki: Package ↔ Rules attachments (IDP nie ma) ─────────────
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
