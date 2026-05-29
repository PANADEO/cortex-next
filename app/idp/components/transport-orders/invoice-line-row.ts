import type {
  AtrDocument,
  InvoiceLine,
  InvoiceLineSadOverride,
  InvoiceLineUpdateRequest,
} from "@cortex/types"
import { mapTrimToNull, trimToNull } from "@/lib/form-helpers"

export interface InvoiceLineRow {
  line_number: string
  po_number: string
  product_code: string
  description: string
  cn_code: string
  hs: string
  quantity: string
  unit_of_measure: string
  invoice_value: string
  net_weight_kg: string
  gross_weight_kg: string
  packages_quantity: string
  packages_type: string
  packages_marking: string
  origin_country: string
  preference_code: string
  atr_documents: string
}

export function invoiceLineToRow(line: InvoiceLine): InvoiceLineRow {
  return {
    line_number: line.line_number ?? "",
    po_number: line.po_number ?? "",
    product_code: line.product_code ?? "",
    description: line.description ?? "",
    cn_code: line.cn_code ?? "",
    hs: line.hs ?? "",
    quantity: line.quantity ?? "",
    unit_of_measure: line.unit_of_measure ?? "",
    invoice_value: line.invoice_value ?? "",
    net_weight_kg: line.net_weight_kg ?? "",
    gross_weight_kg: line.gross_weight_kg ?? "",
    packages_quantity: line.packages_quantity ?? "",
    packages_type: line.packages_type ?? "",
    packages_marking: line.packages_marking ?? "",
    origin_country: line.origin_country ?? "",
    preference_code: line.sad_override?.preference_code ?? "",
    atr_documents: formatAtrDocuments(line.sad_override?.atr_documents ?? []),
  }
}

export function invoiceLineRowToRequest(
  id: string,
  row: InvoiceLineRow,
  originalLine?: InvoiceLine,
): InvoiceLineUpdateRequest {
  const { preference_code, atr_documents, ...lineFields } = row
  const request: InvoiceLineUpdateRequest = { line_id: id, ...mapTrimToNull(lineFields) }
  const sadOverride = buildSadOverride({
    preferenceCode: preference_code,
    atrDocumentsText: atr_documents,
    productCode: row.product_code,
    originalLine,
  })
  if (sadOverride !== undefined) {
    request.sad_override = sadOverride
  }
  return request
}

export function formatAtrDocuments(documents: AtrDocument[]): string {
  return documents
    .map((document) =>
      [document.document_code || "N018", document.document_number, document.quantity]
        .filter(Boolean)
        .join(" | "),
    )
    .join("\n")
}

function buildSadOverride({
  preferenceCode,
  atrDocumentsText,
  productCode,
  originalLine,
}: {
  preferenceCode: string
  atrDocumentsText: string
  productCode: string
  originalLine: InvoiceLine | undefined
}): InvoiceLineSadOverride | null | undefined {
  const existing = originalLine?.sad_override
  const next: InvoiceLineSadOverride = existing ? { ...existing } : {}
  const normalizedPreference = trimToNull(preferenceCode)
  const normalizedAtrText = atrDocumentsText.trim()
  const existingAtrSummary = formatAtrDocuments(existing?.atr_documents ?? [])

  if (normalizedPreference) {
    next.preference_code = normalizedPreference
  } else {
    delete next.preference_code
  }

  if (normalizedAtrText === existingAtrSummary) {
    if (existing?.atr_documents) {
      next.atr_documents = existing.atr_documents
    }
  } else {
    next.atr_documents = parseAtrDocuments(normalizedAtrText, productCode)
  }

  if (!normalizedAtrText && !existing?.atr_documents?.length) {
    delete next.atr_documents
  }

  const hasExistingOverride = Boolean(existing)
  const hasNextOverride = Object.keys(next).length > 0
  if (!hasExistingOverride && !hasNextOverride) return undefined
  return hasNextOverride ? next : {}
}

function parseAtrDocuments(value: string, productCode: string): AtrDocument[] {
  if (!value) return []
  return value
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const parts = line
        .split(line.includes("|") ? "|" : "/")
        .map((part) => part.trim())
        .filter(Boolean)
      if (parts.length >= 3) {
        const [documentCode, documentNumber, quantity] = parts
        if (!documentNumber || !quantity) return []
        return [
          {
            product_code: productCode,
            document_code: documentCode || "N018",
            document_number: documentNumber,
            quantity,
          },
        ]
      }
      if (parts.length === 2) {
        const [documentNumber, quantity] = parts
        if (!documentNumber || !quantity) return []
        return [
          {
            product_code: productCode,
            document_code: "N018",
            document_number: documentNumber,
            quantity,
          },
        ]
      }
      return []
    })
}
