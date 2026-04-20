export interface PackageTransportOrdersResponse {
  package_id: string
  transport_orders: unknown[] | null
  verified_transport_orders: unknown[] | null
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
  product_code?: string | null
  description?: string | null
  cn_code?: string | null
  quantity?: string | null
  unit_of_measure?: string | null
  invoice_value?: string | null
  net_weight_kg?: string | null
  gross_weight_kg?: string | null
  packages_quantity?: string | null
  packages_type?: string | null
  packages_marking?: string | null
  origin_country?: string | null
}

export interface UpdateInvoiceLinesRequest {
  lines: InvoiceLineUpdateRequest[]
}
