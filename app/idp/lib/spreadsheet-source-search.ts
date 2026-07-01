import type { InvoiceLine } from "@cortex/types"
import type { SpreadsheetSearchTerm } from "@cortex/ui/components/spreadsheet-search"
import {
  normalizeSpreadsheetNumericValue,
  normalizeSpreadsheetText,
} from "@cortex/ui/components/spreadsheet-search"

type SearchableInvoiceLineField =
  | "po_number"
  | "product_code"
  | "description"
  | "cn_code"
  | "hs"
  | "quantity"
  | "unit_of_measure"
  | "invoice_value"
  | "net_weight_kg"
  | "gross_weight_kg"
  | "packages_quantity"
  | "packages_type"
  | "packages_marking"
  | "origin_country"

interface SearchableFieldConfig {
  key: SearchableInvoiceLineField
  allowSubstring: boolean
  numeric: boolean
  weight: number
}

const SEARCHABLE_FIELDS: SearchableFieldConfig[] = [
  { key: "po_number", allowSubstring: true, numeric: false, weight: 5 },
  { key: "product_code", allowSubstring: true, numeric: false, weight: 6 },
  { key: "description", allowSubstring: true, numeric: false, weight: 1.5 },
  { key: "cn_code", allowSubstring: false, numeric: false, weight: 4.5 },
  { key: "hs", allowSubstring: false, numeric: false, weight: 4.5 },
  { key: "quantity", allowSubstring: false, numeric: true, weight: 2 },
  { key: "unit_of_measure", allowSubstring: false, numeric: false, weight: 1.5 },
  { key: "invoice_value", allowSubstring: false, numeric: true, weight: 1.5 },
  { key: "net_weight_kg", allowSubstring: false, numeric: true, weight: 2 },
  { key: "gross_weight_kg", allowSubstring: false, numeric: true, weight: 2 },
  { key: "packages_quantity", allowSubstring: false, numeric: true, weight: 1.5 },
  { key: "packages_type", allowSubstring: true, numeric: false, weight: 1.5 },
  { key: "packages_marking", allowSubstring: true, numeric: false, weight: 4 },
  { key: "origin_country", allowSubstring: false, numeric: false, weight: 0.5 },
]

const MINIMUM_TEXT_LENGTH = 2

export function buildInvoiceLineSpreadsheetSearchTerms(
  line: InvoiceLine | null | undefined,
): SpreadsheetSearchTerm[] {
  if (!line) return []

  return SEARCHABLE_FIELDS.flatMap((field): SpreadsheetSearchTerm[] => {
    const raw = line[field.key]
    if (raw === null || raw === undefined) return []

    const value = normalizeSpreadsheetText(raw)
    if (value.length < MINIMUM_TEXT_LENGTH) return []

    return [
      {
        key: field.key,
        value,
        numericValue: field.numeric ? normalizeSpreadsheetNumericValue(raw) : null,
        allowSubstring: field.allowSubstring,
        weight: field.weight,
      },
    ]
  })
}
