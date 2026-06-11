export interface Party {
  id: string
  name: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  country_code: string | null
  vat_id: string | null
  eori: string | null
  partner_id: string | null
}

export interface DeliveryTerms {
  id: string
  incoterms_code: string | null
  incoterms_place: string | null
  delivery_area: string | null
  base_of_delivery: string | null
}

export interface NormalizedHighlightBox {
  x: number
  y: number
  width: number
  height: number
}

export interface InvoiceLineSourceReference {
  path: string
  relation_type: string
  page_number: number | null
  highlight_boxes: NormalizedHighlightBox[]
  label: string
}

export interface AtrDocument {
  product_code: string
  document_code: string
  document_number: string
  quantity: string
  origin_country?: string | null
  source_references?: InvoiceLineSourceReference[]
}

export interface InvoiceLineSadOverride {
  tariff_code?: string | null
  taric_code?: string | null
  coo?: string | null
  gross_weight_kg?: string | null
  net_weight_kg?: string | null
  value?: string | null
  item_description?: string | null
  preference_code?: string | null
  atr_documents?: AtrDocument[]
  atr_split?: Record<string, string | null>
  packages?: Record<string, unknown> | null
}

export interface SadPreviousDocument {
  doc_type?: string | null
  doc_code?: string | null
  doc_additional_code?: string | null
  doc_no?: string | null
  doc_date?: string | null
}

export interface SadAttachedDocument {
  document_type?: string | null
  document_no?: string | null
  document_date?: string | null
  remarks?: string | null
}

export interface SadContextHeader {
  hs_decl_type?: string | null
  _type?: string | null
  decl_code1?: string | null
  decl_code2?: string | null
  decl_code3?: string | null
  sub_type?: string | null
  trans_type?: string | null
  proc_code?: string | null
  representation_type?: string | null
  decl_customs_off_no?: string | null
  border_office?: string | null
  decl_date?: string | null
  currency?: string | null
  internal_currency_unit?: string | null
  issued_by_name?: string | null
  issued_by_place?: string | null
  issued_by_position?: string | null
  issued_by_phone?: string | null
}

export interface SadContextTransport {
  transp_disp_arr_mode?: string | null
  transp_bord_mode?: string | null
  transp_bord_ctry?: string | null
  transp_disp_arr_marks?: string | null
  transport_doc_no?: string | null
}

export interface SadContextDocuments {
  invoice_doc_type?: string | null
  previous_documents?: SadPreviousDocument[] | null
  attached_documents?: SadAttachedDocument[] | null
}

export interface SadContextDefaults {
  taric_default?: string | null
  add_codes_nat?: string[] | null
  packages?: {
    total_pack?: string | null
  } | null
}

export interface SadAgentParty {
  name?: string | null
  street?: string | null
  city?: string | null
  postal_code?: string | null
  country_code?: string | null
  eori?: string | null
  tin?: string | null
  regon?: string | null
  type_of_person?: string | null
}

export interface SadContext {
  header?: SadContextHeader | null
  transport?: SadContextTransport | null
  documents?: SadContextDocuments | null
  defaults?: SadContextDefaults | null
  agent_party?: SadAgentParty | null
  [key: string]: unknown
}

export interface InvoiceLine {
  id: string
  line_number: string | null
  po_number: string | null
  product_code: string | null
  description: string | null
  description_pl: string | null
  cn_code: string | null
  hs: string | null
  quantity: string | null
  unit_of_measure: string | null
  unit_price: string | null
  invoice_value: string | null
  net_weight_kg: string | null
  gross_weight_kg: string | null
  estimated_gross_weight_kg: string | null
  packages_quantity: string | null
  packages_type: string | null
  packages_marking: string | null
  origin_country: string | null
  source_references: InvoiceLineSourceReference[]
  notes: string[]
  sad_override?: InvoiceLineSadOverride | null
}

export interface InvoiceTotals {
  id: string
  total_invoice_value: string | null
  goods_total_amount: string | null
  bank_fee_amount: string | null
  invoice_total_amount: string | null
  total_qty: string | null
  total_qty_uom: string | null
  total_cbm: string | null
  total_net_weight_kg: string | null
  total_gross_weight_kg: string | null
  total_packages_quantity: string | null
}

export interface Invoice {
  id: string
  invoice_number: string | null
  invoice_date: string | null
  invoice_currency: string | null
  country_of_dispatch: string | null
  country_of_destination: string | null
  delivery_terms: DeliveryTerms | null
  lines: InvoiceLine[]
  invoice_totals: InvoiceTotals | null
  warnings: string[]
  notes: string[]
}

export interface TransportOrder {
  id: string
  transport_order_number: string | null
  mode: string | null
  truck_plate: string | null
  trailer_plate: string | null
  country_of_dispatch: string | null
  country_of_destination: string | null
  seller: Party | null
  buyer: Party | null
  consignor: Party | null
  consignee: Party | null
  invoices: Invoice[]
  sad_context: SadContext | null
  invoice_processing: Record<string, unknown> | null
}

export interface PackageTransportOrdersResponse {
  package_id: string
  transport_orders: TransportOrder[] | null
  verified_transport_orders: TransportOrder[] | null
}

export interface UpdatePartyRequest {
  name?: string | null
  street?: string | null
  postal_code?: string | null
  city?: string | null
  country_code?: string | null
  vat_id?: string | null
  eori?: string | null
  partner_id?: string | null
}

export interface UpdateTransportInfoRequest {
  transport_order_number?: string | null
  mode?: string | null
  truck_plate?: string | null
  trailer_plate?: string | null
  country_of_dispatch?: string | null
  country_of_destination?: string | null
}

export interface UpdateSadContextRequest {
  sad_context?: SadContext | null
}

export interface UpdateInvoiceRequest {
  invoice_number?: string | null
  invoice_date?: string | null
  invoice_currency?: string | null
  country_of_dispatch?: string | null
  country_of_destination?: string | null
}

export interface UpdateInvoiceTotalsRequest {
  total_invoice_value?: string | null
  total_net_weight_kg?: string | null
  total_gross_weight_kg?: string | null
  total_packages_quantity?: string | null
}

export interface UpdateDeliveryTermsRequest {
  incoterms_code?: string | null
  incoterms_place?: string | null
  delivery_area?: string | null
  base_of_delivery?: string | null
}

export interface InvoiceLineUpdateRequest {
  line_id: string
  line_number?: string | null
  po_number?: string | null
  product_code?: string | null
  description?: string | null
  cn_code?: string | null
  hs?: string | null
  quantity?: string | null
  unit_of_measure?: string | null
  invoice_value?: string | null
  net_weight_kg?: string | null
  gross_weight_kg?: string | null
  estimated_gross_weight_kg?: string | null
  packages_quantity?: string | null
  packages_type?: string | null
  packages_marking?: string | null
  origin_country?: string | null
  sad_override?: InvoiceLineSadOverride | null
}

export interface UpdateInvoiceLinesRequest {
  lines: InvoiceLineUpdateRequest[]
}
