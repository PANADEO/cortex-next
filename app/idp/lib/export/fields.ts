// Etykiety trzymane są jako KLUCZE przestrzeni `idp` — ten plik nie jest
// komponentem i nie ma własnego `t()`. Napis powstaje w miejscu renderu.

export interface ExportFieldGroup {
  id: string
  labelKey: string
  fields: ExportField[]
}

export interface ExportField {
  id: string
  labelKey: string
  defaultOn: boolean
}

export const EXPORT_FIELD_GROUPS: readonly ExportFieldGroup[] = [
  {
    id: "header",
    labelKey: "export.groups.header",
    fields: [
      { id: "package_id", labelKey: "export.fields.package_id", defaultOn: true },
      { id: "file_name", labelKey: "export.fields.file_name", defaultOn: true },
      { id: "created_date", labelKey: "export.fields.created_date", defaultOn: true },
      { id: "assignee", labelKey: "export.fields.assignee", defaultOn: false },
    ],
  },
  {
    id: "invoice",
    labelKey: "export.groups.invoice",
    fields: [
      { id: "invoice_number", labelKey: "export.fields.invoice_number", defaultOn: true },
      { id: "invoice_date", labelKey: "export.fields.invoice_date", defaultOn: true },
      { id: "currency", labelKey: "export.fields.currency", defaultOn: true },
      { id: "net_total", labelKey: "export.fields.net_total", defaultOn: true },
      { id: "vat_total", labelKey: "export.fields.vat_total", defaultOn: true },
      { id: "gross_total", labelKey: "export.fields.gross_total", defaultOn: true },
    ],
  },
  {
    id: "parties",
    labelKey: "export.groups.parties",
    fields: [
      { id: "seller_name", labelKey: "export.fields.seller_name", defaultOn: true },
      { id: "seller_vat", labelKey: "export.fields.seller_vat", defaultOn: false },
      { id: "buyer_name", labelKey: "export.fields.buyer_name", defaultOn: true },
      { id: "buyer_vat", labelKey: "export.fields.buyer_vat", defaultOn: false },
      { id: "consignor_name", labelKey: "export.fields.consignor_name", defaultOn: false },
      { id: "consignee_name", labelKey: "export.fields.consignee_name", defaultOn: false },
    ],
  },
  {
    id: "transport",
    labelKey: "export.groups.transport",
    fields: [
      { id: "carrier", labelKey: "export.fields.carrier", defaultOn: false },
      { id: "transport_mode", labelKey: "export.fields.transport_mode", defaultOn: false },
      { id: "container_no", labelKey: "export.fields.container_no", defaultOn: false },
      { id: "incoterm", labelKey: "export.fields.incoterm", defaultOn: true },
      { id: "place_of_delivery", labelKey: "export.fields.place_of_delivery", defaultOn: false },
    ],
  },
  {
    id: "lines",
    labelKey: "export.groups.lines",
    fields: [
      { id: "line_description", labelKey: "export.fields.line_description", defaultOn: true },
      { id: "hs_code", labelKey: "export.fields.hs_code", defaultOn: true },
      { id: "line_qty", labelKey: "export.fields.line_qty", defaultOn: true },
      { id: "line_unit", labelKey: "export.fields.line_unit", defaultOn: false },
      { id: "line_unit_price", labelKey: "export.fields.line_unit_price", defaultOn: false },
      { id: "line_net", labelKey: "export.fields.line_net", defaultOn: true },
      { id: "line_vat", labelKey: "export.fields.line_vat", defaultOn: false },
      { id: "line_gross", labelKey: "export.fields.line_gross", defaultOn: false },
      { id: "line_weight_kg", labelKey: "export.fields.line_weight_kg", defaultOn: false },
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
  {
    id: "csv",
    labelKey: "export.formats.csv.label",
    descriptionKey: "export.formats.csv.description",
    ext: "csv",
  },
  {
    id: "xml",
    labelKey: "export.formats.xml.label",
    descriptionKey: "export.formats.xml.description",
    ext: "xml",
  },
  {
    id: "json",
    labelKey: "export.formats.json.label",
    descriptionKey: "export.formats.json.description",
    ext: "json",
  },
  {
    id: "xlsx",
    labelKey: "export.formats.xlsx.label",
    descriptionKey: "export.formats.xlsx.description",
    ext: "xlsx",
  },
] as const

export type ExportFormat = (typeof EXPORT_FORMATS)[number]["id"]
