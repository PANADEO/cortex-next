"use client"

import type {
  Invoice,
  InvoiceLine,
  UpdateDeliveryTermsRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
} from "@cortex/types"
import { Button } from "@cortex/ui"
import { formatRoute } from "@cortex/utils"
import { ChevronDown, ChevronRight, FileText } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { countryCodeSchema, mapTrimToNull, numericStringSchema } from "@/lib/form-helpers"
import { FieldsForm, type FieldSpec } from "./fields-form"
import { InvoiceLinesGrid } from "./invoice-lines-grid"

const currencySchema = z
  .string()
  .max(4)
  .regex(/^[A-Za-z]{0,3}$/, "ISO currency code")

const headerSchema = z.object({
  invoice_number: z.string().max(64),
  invoice_date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  invoice_currency: currencySchema,
  country_of_dispatch: countryCodeSchema,
  country_of_destination: countryCodeSchema,
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
  total_invoice_value: numericStringSchema,
  total_net_weight_kg: numericStringSchema,
  total_gross_weight_kg: numericStringSchema,
  total_packages_quantity: numericStringSchema,
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
  const [open, setOpen] = useState(true)
  const Chevron = open ? ChevronDown : ChevronRight
  const route = formatRoute(invoice.country_of_dispatch, invoice.country_of_destination)
  const summaryBits = [
    invoice.invoice_number ? `Invoice ${invoice.invoice_number}` : null,
    invoice.invoice_date,
    invoice.invoice_currency,
    route,
  ].filter(Boolean) as string[]
  const contentId = `invoice-editor-content-${invoice.id}`

  return (
    <section className="space-y-3">
      <div className="overflow-hidden rounded-md border border-border bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="h-auto w-full justify-start gap-2 rounded-none px-3 py-2 text-left hover:bg-muted/40"
          aria-expanded={open}
          aria-controls={contentId}
        >
          <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-semibold">
            Invoice {invoice.invoice_number ?? invoice.id}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {summaryBits.length > 0 ? summaryBits.join(" · ") : "No invoice data"}
          </span>
        </Button>
      </div>
      {invoice.warnings.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-destructive">
          {invoice.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
      {open ? (
        <div id={contentId} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldsForm
              label="Header"
              fields={HEADER_FIELDS}
              defaults={headerDefaults(invoice)}
              schema={headerSchema}
              canEdit={canEdit}
              isSaving={isSavingHeader}
              resetKey={invoice.id}
              onSave={(v) => onSaveHeader(mapTrimToNull(v))}
            />
            <FieldsForm
              label="Delivery terms"
              fields={DELIVERY_FIELDS}
              defaults={deliveryDefaults(invoice)}
              schema={deliverySchema}
              canEdit={canEdit}
              isSaving={isSavingDelivery}
              resetKey={invoice.id}
              onSave={(v) => onSaveDelivery(mapTrimToNull(v))}
            />
            <FieldsForm
              label="Totals"
              fields={TOTALS_FIELDS}
              defaults={totalsDefaults(invoice)}
              schema={totalsSchema}
              canEdit={canEdit}
              isSaving={isSavingTotals}
              resetKey={invoice.id}
              onSave={(v) => onSaveTotals(mapTrimToNull(v))}
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
        </div>
      ) : null}
    </section>
  )
}
