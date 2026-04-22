export interface ExportFieldGroup {
  id: string
  label: string
  fields: ExportField[]
}

export interface ExportField {
  id: string
  label: string
  description?: string
  defaultOn: boolean
}

export const EXPORT_FIELD_GROUPS: readonly ExportFieldGroup[] = [
  {
    id: "header",
    label: "Document header",
    fields: [
      { id: "package_id", label: "Package ID", defaultOn: true },
      { id: "file_name", label: "File name", defaultOn: true },
      { id: "created_date", label: "Created date", defaultOn: true },
      { id: "assignee", label: "Assignee", defaultOn: false },
    ],
  },
  {
    id: "invoice",
    label: "Invoice",
    fields: [
      { id: "invoice_number", label: "Invoice number", defaultOn: true },
      { id: "invoice_date", label: "Invoice date", defaultOn: true },
      { id: "currency", label: "Currency", defaultOn: true },
      { id: "net_total", label: "Net total", defaultOn: true },
      { id: "vat_total", label: "VAT total", defaultOn: true },
      { id: "gross_total", label: "Gross total", defaultOn: true },
    ],
  },
  {
    id: "parties",
    label: "Parties",
    fields: [
      { id: "seller_name", label: "Seller name", defaultOn: true },
      { id: "seller_vat", label: "Seller VAT", defaultOn: false },
      { id: "buyer_name", label: "Buyer name", defaultOn: true },
      { id: "buyer_vat", label: "Buyer VAT", defaultOn: false },
      { id: "consignor_name", label: "Consignor", defaultOn: false },
      { id: "consignee_name", label: "Consignee", defaultOn: false },
    ],
  },
  {
    id: "transport",
    label: "Transport & delivery",
    fields: [
      { id: "carrier", label: "Carrier", defaultOn: false },
      { id: "transport_mode", label: "Transport mode", defaultOn: false },
      { id: "container_no", label: "Container no.", defaultOn: false },
      { id: "incoterm", label: "Incoterm", defaultOn: true },
      { id: "place_of_delivery", label: "Place of delivery", defaultOn: false },
    ],
  },
  {
    id: "lines",
    label: "Invoice lines",
    fields: [
      { id: "line_description", label: "Description", defaultOn: true },
      { id: "hs_code", label: "HS code", defaultOn: true },
      { id: "line_qty", label: "Quantity", defaultOn: true },
      { id: "line_unit", label: "Unit", defaultOn: false },
      { id: "line_unit_price", label: "Unit price", defaultOn: false },
      { id: "line_net", label: "Line net", defaultOn: true },
      { id: "line_vat", label: "Line VAT", defaultOn: false },
      { id: "line_gross", label: "Line gross", defaultOn: false },
      { id: "line_weight_kg", label: "Weight (kg)", defaultOn: false },
    ],
  },
] as const

export function defaultSelectedFieldIds(): Set<string> {
  const set = new Set<string>()
  for (const group of EXPORT_FIELD_GROUPS) {
    for (const field of group.fields) {
      if (field.defaultOn) set.add(field.id)
    }
  }
  return set
}

export function allFieldIds(): string[] {
  const ids: string[] = []
  for (const group of EXPORT_FIELD_GROUPS) {
    for (const field of group.fields) ids.push(field.id)
  }
  return ids
}

export const EXPORT_FORMATS = [
  { id: "csv", label: "CSV", description: "One row per invoice line", ext: "csv" },
  { id: "xml", label: "XML", description: "Customs-ready schema", ext: "xml" },
  { id: "json", label: "JSON", description: "Raw structured payload", ext: "json" },
  { id: "xlsx", label: "Excel (XLSX)", description: "Spreadsheet with tabs", ext: "xlsx" },
] as const

export type ExportFormat = (typeof EXPORT_FORMATS)[number]["id"]
