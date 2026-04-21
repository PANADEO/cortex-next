import type {
  CleanPackageDraft,
  DirtyDocument,
  DirtyPackageDetailsResponse,
  DirtyPackageReadModel,
  DirtyPackageStatus,
  DocMode,
  DocType,
} from "@cortex/types"

interface DocTemplate {
  file_name: string
  doc_type: DocType
  pages: number
  size_kb: number
}

const CUSTOMERS = ["Acme Corp", "Müller GmbH", "Sahara Logistics", "Polontex", null]

const STATUSES: DirtyPackageStatus[] = [
  "needs_classification",
  "classifying",
  "classified",
  "promoted",
  "needs_classification",
  "classified",
]

const DIRTY_NAMES = [
  "Acme inbound %n",
  "Müller batch %n",
  "Sahara express %n",
  "Polontex containers %n",
  "Mixed shipment %n",
]

const DOC_TEMPLATES: DocTemplate[] = [
  { file_name: "invoices_combined.pdf", doc_type: "invoice", pages: 8, size_kb: 1240 },
  { file_name: "packing_list.pdf", doc_type: "packing_list", pages: 3, size_kb: 410 },
  { file_name: "translation_EN.pdf", doc_type: "translation_sheet", pages: 2, size_kb: 280 },
  { file_name: "cn_codes_table.xlsx", doc_type: "code_assignment", pages: 1, size_kb: 95 },
  { file_name: "bill_of_lading.pdf", doc_type: "bill_of_lading", pages: 1, size_kb: 320 },
  { file_name: "cert_of_origin.pdf", doc_type: "certificate_of_origin", pages: 1, size_kb: 180 },
  { file_name: "email_thread.pdf", doc_type: "correspondence", pages: 4, size_kb: 220 },
  { file_name: "screenshot_whatsapp.jpg", doc_type: "skip", pages: 1, size_kb: 88 },
  { file_name: "scratch_notes.pdf", doc_type: "other", pages: 2, size_kb: 130 },
]

const MEDIA_BY_EXT: Record<string, { media: string; preview: DirtyDocument["preview_kind"] }> = {
  pdf: { media: "application/pdf", preview: "pdf" },
  xlsx: {
    media: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    preview: "download_only",
  },
  jpg: { media: "image/jpeg", preview: "image" },
  png: { media: "image/png", preview: "image" },
}

function pseudoRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(d.getHours() - ((days * 7) % 24))
  return d.toISOString()
}

function mediaFor(file_name: string) {
  const ext = file_name.split(".").pop()?.toLowerCase() ?? "pdf"
  return MEDIA_BY_EXT[ext] ?? MEDIA_BY_EXT.pdf!
}

function defaultMode(doc_type: DocType): DocMode {
  if (doc_type === "skip") return "skip"
  if (doc_type === "translation_sheet" || doc_type === "code_assignment") return "pass_through"
  if (doc_type === "correspondence" || doc_type === "other") return "pass_through"
  return "process"
}

function buildDocuments(
  pkgIndex: number,
  rand: () => number,
): { docs: DirtyDocument[]; drafts: CleanPackageDraft[] } {
  const count = 4 + Math.floor(rand() * 5)
  const docs: DirtyDocument[] = []
  const usedTemplates = new Set<number>()

  for (let i = 0; i < count; i++) {
    let templateIdx = Math.floor(rand() * DOC_TEMPLATES.length)
    if (usedTemplates.size < DOC_TEMPLATES.length) {
      while (usedTemplates.has(templateIdx))
        templateIdx = (templateIdx + 1) % DOC_TEMPLATES.length
    }
    usedTemplates.add(templateIdx)
    const tpl = DOC_TEMPLATES[templateIdx]!
    const media = mediaFor(tpl.file_name)
    docs.push({
      id: `pkg-dirty-${pkgIndex}-doc-${i}`,
      file_name: tpl.file_name.replace(/\./, `_${i + 1}.`),
      media_type: media.media,
      size_bytes: tpl.size_kb * 1024,
      preview_kind: media.preview,
      page_count: tpl.pages,
      doc_type: tpl.doc_type,
      mode: defaultMode(tpl.doc_type),
      confidence: tpl.doc_type === "skip" ? 0.42 : 0.7 + rand() * 0.28,
      target_clean_package_id: null,
      human_reviewed: false,
      notes: null,
    })
  }

  const draftCount = 1 + (docs.some((d) => d.doc_type === "invoice") ? Math.floor(rand() * 2) : 0)
  const drafts: CleanPackageDraft[] = []
  for (let i = 0; i < draftCount; i++) {
    drafts.push({
      id: `pkg-dirty-${pkgIndex}-draft-${i}`,
      name: `Clean package ${String.fromCharCode(65 + i)}`,
      document_ids: [],
      customer_tag: null,
      notes: null,
    })
  }
  for (const doc of docs) {
    if (doc.mode === "skip") continue
    const targetIdx = doc.doc_type === "invoice"
      ? Math.floor(rand() * drafts.length)
      : 0
    const draft = drafts[targetIdx]!
    draft.document_ids.push(doc.id)
    doc.target_clean_package_id = draft.id
  }

  return { docs, drafts }
}

export function buildDirtyPackages(count = 12): DirtyPackageReadModel[] {
  const rand = pseudoRandom(99)
  const items: DirtyPackageReadModel[] = []
  for (let i = 0; i < count; i++) {
    const status = STATUSES[Math.floor(rand() * STATUSES.length)]!
    const tpl = DIRTY_NAMES[Math.floor(rand() * DIRTY_NAMES.length)]!
    const customer = CUSTOMERS[Math.floor(rand() * CUSTOMERS.length)] ?? null
    const docCount = 4 + Math.floor(rand() * 5)
    const needsReview =
      status === "needs_classification"
        ? docCount
        : status === "classifying"
          ? Math.floor(docCount / 2)
          : status === "classified"
            ? Math.floor(rand() * 2)
            : 0
    items.push({
      id: `dirty-${String(i + 1).padStart(4, "0")}`,
      name: tpl.replace("%n", String(2400 + i)),
      status,
      customer_tag: customer,
      created_date: daysAgo(Math.floor(rand() * 14)),
      document_count: docCount,
      needs_review_count: needsReview,
      promoted_clean_package_ids:
        status === "promoted" ? [`pkg-${String(1000 + i).padStart(4, "0")}`] : [],
    })
  }
  items.sort((a, b) => (a.created_date < b.created_date ? 1 : -1))
  return items
}

export function buildDirtyPackageDetails(
  pkg: DirtyPackageReadModel,
): DirtyPackageDetailsResponse {
  const seed = Number(pkg.id.replace(/\D/g, ""))
  const rand = pseudoRandom(seed * 13 + 7)
  const { docs, drafts } = buildDocuments(Number(pkg.id.replace(/\D/g, "")), rand)
  return {
    id: pkg.id,
    name: pkg.name,
    status: pkg.status,
    customer_tag: pkg.customer_tag,
    created_date: pkg.created_date,
    documents: docs,
    drafts,
    last_classification_run_at:
      pkg.status === "needs_classification" ? null : daysAgo(0),
    promoted_clean_package_ids: pkg.promoted_clean_package_ids,
  }
}
