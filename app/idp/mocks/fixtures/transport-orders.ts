import type {
  DeliveryTerms,
  Invoice,
  InvoiceLine,
  InvoiceLineSourceReference,
  InvoiceTotals,
  PackageReadModel,
  PackageTransportOrdersResponse,
  Party,
  TransportOrder,
} from "@cortex/types"

function tailNumber(id: string): number {
  const match = id.match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

function pkgSeed(id: string): number {
  return (tailNumber(id) * 9301 + 49297) % 233280
}

function seller(id: string): Party {
  return {
    id: `${id}-seller`,
    name: "Acme Logistics Sp. z o.o.",
    street: "ul. Spedycyjna 12",
    postal_code: "00-001",
    city: "Warszawa",
    country_code: "PL",
    vat_id: "PL1234567890",
    eori: "PL1234567890000",
    partner_id: "ACME-PL",
  }
}

function buyer(id: string, correctedVat: boolean): Party {
  return {
    id: `${id}-buyer`,
    name: "Deutsche Importers GmbH",
    street: "Hafenstraße 45",
    postal_code: "20457",
    city: "Hamburg",
    country_code: "DE",
    vat_id: correctedVat ? "DE987654321" : "DE98765432",
    eori: "DE987654321000",
    partner_id: "DEUIMP-DE",
  }
}

function consignor(id: string): Party {
  return { ...seller(id), id: `${id}-consignor`, partner_id: "ACME-PL-CONS" }
}

function consignee(id: string): Party {
  return { ...buyer(id, true), id: `${id}-consignee`, partner_id: "DEUIMP-DE-CONS" }
}

function deliveryTerms(id: string): DeliveryTerms {
  return {
    id: `${id}-delivery`,
    incoterms_code: "CIP",
    incoterms_place: "Hamburg",
    delivery_area: "EU",
    base_of_delivery: "road",
  }
}

function sourceRefs(path: string, lineIndex: number): InvoiceLineSourceReference[] {
  // Mock PDF has 2 pages — wrap line index so highlight lands on a real page.
  const page = ((lineIndex - 1) % 2) + 1
  const baseY = 0.14 + (lineIndex - 1) * 0.08
  return [
    {
      path,
      relation_type: "line_item",
      page_number: page,
      highlight_boxes: [{ x: 0.1, y: baseY, width: 0.8, height: 0.05 }],
      label: `Page ${page}`,
    },
  ]
}

function line(
  id: string,
  n: number,
  description: string,
  cn: string,
  qty: string,
  weight: string,
  value: string,
): InvoiceLine {
  return {
    id: `${id}-line-${n}`,
    line_number: String(n),
    po_number: `PO-${id.slice(-4)}-${n}`,
    product_code: `PROD-${cn.slice(0, 4)}`,
    description,
    description_pl: null,
    cn_code: cn,
    hs: cn.slice(0, 6),
    quantity: qty,
    unit_of_measure: "pcs",
    unit_price: null,
    invoice_value: value,
    net_weight_kg: weight,
    gross_weight_kg: String((Number(weight) * 1.08).toFixed(2)),
    estimated_gross_weight_kg: String((Number(weight) * 1.08).toFixed(2)),
    packages_quantity: String(Math.max(1, Math.round(Number(qty) / 25))),
    packages_type: "box",
    packages_marking: `MARK-${n}`,
    origin_country: "PL",
    source_references: sourceRefs("invoice.pdf", 1 + n),
    notes: [],
  }
}

function totals(id: string): InvoiceTotals {
  return {
    id: `${id}-totals`,
    total_invoice_value: "12450.75",
    goods_total_amount: "12450.75",
    bank_fee_amount: "0.00",
    invoice_total_amount: "12450.75",
    total_qty: "835",
    total_qty_uom: "pcs",
    total_cbm: "4.210",
    total_net_weight_kg: "203.90",
    total_gross_weight_kg: "220.21",
    total_packages_quantity: "36",
  }
}

type Template = string | ((seed: number) => string)

const WARNING_TEMPLATES: ReadonlyArray<Template> = [
  (s) => `Net weight (${(s % 50) + 1} kg) exceeds gross weight (${(s % 30) + 1} kg) on line 2.`,
  (s) =>
    `Sum of line items (${12000 + (s % 500)}.00 EUR) differs from invoice total (${12450 + (s % 200)}.00 EUR).`,
  (s) =>
    `Packing list declares ${250 + (s % 5)} units but invoice reports 250 — verify with shipper.`,
  "Buyer postal code missing — customs declaration requires a 5-digit code for DE importers.",
  "Certificate of origin lists a different shipper legal form than the invoice.",
  (s) =>
    `Unusual weight-per-unit on line 2: ${(1 + (s % 3)).toFixed(2)} kg/pc — outside historical range.`,
]

const NOTE_TEMPLATES: ReadonlyArray<Template> = [
  "Currency inferred from line item column headers (no explicit invoice-level value).",
  "Incoterm defaulted to DAP based on prior shipments from this seller.",
  (s) =>
    `Delivery date 04/05/${2025 + (s % 3)} parsed as EU format (4 May) based on consignor country.`,
  "HS sub-heading inferred from CN code prefix; please confirm before declaration.",
]

function renderTemplate(template: Template, seed: number): string {
  return typeof template === "string" ? template : template(seed)
}

function sampleObservations(pkg: PackageReadModel): {
  warnings: string[]
  notes: string[]
} {
  const seed = pkgSeed(pkg.id)
  // Every 5th package stays empty so the empty-state UI is reachable in dev.
  if (seed % 5 === 0) return { warnings: [], notes: [] }
  const warningCount = (seed % 3) + 1
  const noteCount = ((seed >> 3) % 3) + 1
  const warnings = Array.from({ length: warningCount }, (_, i) =>
    renderTemplate(WARNING_TEMPLATES[(seed + i * 7) % WARNING_TEMPLATES.length]!, seed + i),
  )
  const notes = Array.from({ length: noteCount }, (_, i) =>
    renderTemplate(NOTE_TEMPLATES[(seed + i * 11) % NOTE_TEMPLATES.length]!, seed + i),
  )
  return { warnings, notes }
}

function invoice(pkg: PackageReadModel): Invoice {
  const id = `${pkg.id}-inv-1`
  const { warnings, notes } = sampleObservations(pkg)
  return {
    id,
    invoice_number: `INV-${pkg.id.slice(-4)}`,
    invoice_date: pkg.created_date.slice(0, 10),
    invoice_currency: "EUR",
    country_of_dispatch: "PL",
    country_of_destination: "DE",
    delivery_terms: deliveryTerms(id),
    lines: [
      line(id, 1, "Electronic components — CN 8541", "8541100000", "250", "18.5", "4820.00"),
      line(id, 2, "Steel fittings — CN 7307", "7307990090", "85", "142.3", "2910.50"),
      line(id, 3, "Plastic housings — CN 3926", "3926909790", "500", "43.1", "4720.25"),
    ],
    invoice_totals: totals(id),
    warnings,
    notes,
  }
}

function order(pkg: PackageReadModel, correctedVat: boolean): TransportOrder {
  const oid = `${pkg.id}-order-1`
  const seed = pkgSeed(pkg.id)
  return {
    id: oid,
    transport_order_number: `TO-${pkg.id.slice(-4)}`,
    mode: "road",
    truck_plate: `WX ${String(seed % 100_000).padStart(5, "0")}`,
    trailer_plate: `WX ${String((seed * 2) % 100_000).padStart(5, "0")}T`,
    country_of_dispatch: "PL",
    country_of_destination: "DE",
    seller: seller(oid),
    buyer: buyer(oid, correctedVat),
    consignor: consignor(oid),
    consignee: consignee(oid),
    invoices: [invoice(pkg)],
    sad_context: null,
    invoice_processing: null,
  }
}

export function buildTransportOrders(
  pkg: PackageReadModel,
): Pick<PackageTransportOrdersResponse, "transport_orders" | "verified_transport_orders"> {
  if (pkg.processing_state !== "ready") {
    return { transport_orders: null, verified_transport_orders: null }
  }
  const raw = [order(pkg, false)]
  const verified = pkg.verification_state === "completed" ? [order(pkg, true)] : null
  return { transport_orders: raw, verified_transport_orders: verified }
}
