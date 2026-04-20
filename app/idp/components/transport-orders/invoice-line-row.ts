import type { InvoiceLine, InvoiceLineUpdateRequest } from "@cortex/types"
import { mapTrimToNull } from "@/lib/form-helpers"

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
  }
}

export function invoiceLineRowToRequest(
  id: string,
  row: InvoiceLineRow,
): InvoiceLineUpdateRequest {
  return { line_id: id, ...mapTrimToNull(row) }
}
