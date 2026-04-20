"use client"

import type {
  Invoice,
  InvoiceLine,
  UpdateDeliveryTermsRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
} from "@cortex/types"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"
import { InvoiceLinesGrid } from "./invoice-lines-grid"

const numericString = z
  .string()
  .regex(/^$|^-?\d+(\.\d+)?$/, "Must be numeric (decimal with dot)")

const headerSchema = z.object({
  invoice_number: z.string().max(64),
  invoice_date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  invoice_currency: z
    .string()
    .max(4)
    .regex(/^[A-Za-z]{0,3}$/, "ISO currency code"),
  country_of_dispatch: z
    .string()
    .max(3)
    .regex(/^[A-Za-z]{0,3}$/, "ISO country code"),
  country_of_destination: z
    .string()
    .max(3)
    .regex(/^[A-Za-z]{0,3}$/, "ISO country code"),
})

type HeaderValues = z.infer<typeof headerSchema>

const HEADER_FIELDS: readonly FieldSpec<HeaderValues>[] = [
  { name: "invoice_number", label: "Invoice number", span: 2 },
  { name: "invoice_date", label: "Invoice date", span: 1 },
  { name: "invoice_currency", label: "Currency", span: 1, uppercase: true },
  { name: "country_of_dispatch", label: "From", span: 1, uppercase: true },
  { name: "country_of_destination", label: "To", span: 1, uppercase: true },
]

const deliverySchema = z.object({
  incoterms_code: z.string().max(8).regex(/^[A-Za-z]{0,4}$/, "e.g. CIP, DAP"),
  incoterms_place: z.string().max(100),
  delivery_area: z.string().max(100),
  base_of_delivery: z.string().max(100),
})

type DeliveryValues = z.infer<typeof deliverySchema>

const DELIVERY_FIELDS: readonly FieldSpec<DeliveryValues>[] = [
  { name: "incoterms_code", label: "Incoterms code", span: 1, uppercase: true },
  { name: "incoterms_place", label: "Incoterms place", span: 1 },
  { name: "delivery_area", label: "Delivery area", span: 1 },
  { name: "base_of_delivery", label: "Base of delivery", span: 1 },
]

const totalsSchema = z.object({
  total_invoice_value: numericString,
  total_net_weight_kg: numericString,
  total_gross_weight_kg: numericString,
  total_packages_quantity: numericString,
})

type TotalsValues = z.infer<typeof totalsSchema>

const TOTALS_FIELDS: readonly FieldSpec<TotalsValues>[] = [
  { name: "total_invoice_value", label: "Total invoice value", span: 1 },
  { name: "total_packages_quantity", label: "Total packages qty", span: 1 },
  { name: "total_net_weight_kg", label: "Total net weight (kg)", span: 1 },
  { name: "total_gross_weight_kg", label: "Total gross weight (kg)", span: 1 },
]

function headerDefaults(invoice: Invoice): HeaderValues {
  return {
    invoice_number: invoice.invoice_number ?? "",
    invoice_date: invoice.invoice_date ?? "",
    invoice_currency: invoice.invoice_currency ?? "",
    country_of_dispatch: invoice.country_of_dispatch ?? "",
    country_of_destination: invoice.country_of_destination ?? "",
  }
}

function deliveryDefaults(invoice: Invoice): DeliveryValues {
  const dt = invoice.delivery_terms
  return {
    incoterms_code: dt?.incoterms_code ?? "",
    incoterms_place: dt?.incoterms_place ?? "",
    delivery_area: dt?.delivery_area ?? "",
    base_of_delivery: dt?.base_of_delivery ?? "",
  }
}

function totalsDefaults(invoice: Invoice): TotalsValues {
  const t = invoice.invoice_totals
  return {
    total_invoice_value: t?.total_invoice_value ?? "",
    total_net_weight_kg: t?.total_net_weight_kg ?? "",
    total_gross_weight_kg: t?.total_gross_weight_kg ?? "",
    total_packages_quantity: t?.total_packages_quantity ?? "",
  }
}

function emptyToNull<T extends Record<string, string>>(values: T): Record<keyof T, string | null> {
  const entries = Object.entries(values).map(([k, v]) => [k, v.trim() ? v.trim() : null])
  return Object.fromEntries(entries) as Record<keyof T, string | null>
}

interface Props {
  invoice: Invoice
  canEdit: boolean
  isSavingHeader?: boolean | undefined
  isSavingDelivery?: boolean | undefined
  isSavingTotals?: boolean | undefined
  isSavingLines?: boolean | undefined
  onSaveHeader: (body: UpdateInvoiceRequest) => Promise<void>
  onSaveDelivery: (body: UpdateDeliveryTermsRequest) => Promise<void>
  onSaveTotals: (body: UpdateInvoiceTotalsRequest) => Promise<void>
  onSaveLines: (body: UpdateInvoiceLinesRequest) => Promise<void>
  onSelectLine?: ((line: InvoiceLine) => void) | undefined
}

export function InvoiceEditor({
  invoice,
  canEdit,
  isSavingHeader,
  isSavingDelivery,
  isSavingTotals,
  isSavingLines = false,
  onSaveHeader,
  onSaveDelivery,
  onSaveTotals,
  onSaveLines,
  onSelectLine,
}: Props) {
  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-sm font-semibold">
          Invoice {invoice.invoice_number ?? invoice.id}
        </h3>
        {invoice.warnings.length > 0 ? (
          <ul className="mt-2 list-inside list-disc text-xs text-destructive">
            {invoice.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : null}
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <FieldsForm
          label="Header"
          fields={HEADER_FIELDS}
          defaults={headerDefaults(invoice)}
          schema={headerSchema}
          canEdit={canEdit}
          isSaving={isSavingHeader}
          onSave={(v) => onSaveHeader(emptyToNull(v))}
        />
        <FieldsForm
          label="Delivery terms"
          fields={DELIVERY_FIELDS}
          defaults={deliveryDefaults(invoice)}
          schema={deliverySchema}
          canEdit={canEdit}
          isSaving={isSavingDelivery}
          onSave={(v) => onSaveDelivery(emptyToNull(v))}
        />
        <FieldsForm
          label="Totals"
          fields={TOTALS_FIELDS}
          defaults={totalsDefaults(invoice)}
          schema={totalsSchema}
          canEdit={canEdit}
          isSaving={isSavingTotals}
          onSave={(v) => onSaveTotals(emptyToNull(v))}
        />
      </div>
      <InvoiceLinesGrid
        invoice={invoice}
        currency={invoice.invoice_currency}
        canEdit={canEdit}
        isSaving={isSavingLines}
        onSaveLines={onSaveLines}
        {...(onSelectLine ? { onSelectLine } : {})}
      />
    </section>
  )
}
