"use client"

import { countryCodeSchema, mapTrimToNull, numericStringSchema } from "@/lib/form-helpers"
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
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"
import { InvoiceLinesGrid } from "./invoice-lines-grid"

const currencySchema = z
  .string()
  .max(4)
  .regex(/^[A-Za-z]{0,3}$/, "transportOrders.validation.isoCurrency")

const headerSchema = z.object({
  invoice_number: z.string().max(64),
  invoice_date: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, "transportOrders.validation.date"),
  invoice_currency: currencySchema,
  country_of_dispatch: countryCodeSchema,
  country_of_destination: countryCodeSchema,
})

type HeaderValues = z.infer<typeof headerSchema>

const HEADER_FIELDS: readonly FieldSpec<HeaderValues>[] = [
  { name: "invoice_number", labelKey: "transportOrders.fields.invoiceNumber", span: 2 },
  { name: "invoice_date", labelKey: "transportOrders.fields.invoiceDate", span: 1 },
  {
    name: "invoice_currency",
    labelKey: "transportOrders.fields.currency",
    span: 1,
    uppercase: true,
  },
  {
    name: "country_of_dispatch",
    labelKey: "transportOrders.fields.from",
    span: 1,
    uppercase: true,
  },
  {
    name: "country_of_destination",
    labelKey: "transportOrders.fields.to",
    span: 1,
    uppercase: true,
  },
]

const deliverySchema = z.object({
  incoterms_code: z
    .string()
    .max(8)
    .regex(/^[A-Za-z]{0,4}$/, "transportOrders.validation.incoterms"),
  incoterms_place: z.string().max(100),
  delivery_area: z.string().max(100),
  base_of_delivery: z.string().max(100),
})

type DeliveryValues = z.infer<typeof deliverySchema>

const DELIVERY_FIELDS: readonly FieldSpec<DeliveryValues>[] = [
  {
    name: "incoterms_code",
    labelKey: "transportOrders.fields.incotermsCode",
    span: 1,
    uppercase: true,
  },
  { name: "incoterms_place", labelKey: "transportOrders.fields.incotermsPlace", span: 1 },
  { name: "delivery_area", labelKey: "transportOrders.fields.deliveryArea", span: 1 },
  { name: "base_of_delivery", labelKey: "transportOrders.fields.baseOfDelivery", span: 1 },
]

const totalsSchema = z.object({
  total_invoice_value: numericStringSchema,
  total_net_weight_kg: numericStringSchema,
  total_gross_weight_kg: numericStringSchema,
  total_packages_quantity: numericStringSchema,
  total_packages_type: z.string().max(100),
})

type TotalsValues = z.infer<typeof totalsSchema>

const TOTALS_FIELDS: readonly FieldSpec<TotalsValues>[] = [
  { name: "total_invoice_value", labelKey: "transportOrders.fields.totalInvoiceValue", span: 1 },
  {
    name: "total_packages_quantity",
    labelKey: "transportOrders.fields.totalPackagesQty",
    span: 1,
  },
  { name: "total_packages_type", labelKey: "transportOrders.fields.totalPackagesType", span: 1 },
  { name: "total_net_weight_kg", labelKey: "transportOrders.fields.totalNetWeight", span: 1 },
  { name: "total_gross_weight_kg", labelKey: "transportOrders.fields.totalGrossWeight", span: 1 },
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
    total_packages_type: t?.total_packages_type ?? "",
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
  useCustomsCode?: boolean
  showAtrProcessing?: boolean
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
  useCustomsCode = false,
  showAtrProcessing = true,
}: Props) {
  const { t } = useTranslation("idp")
  const [open, setOpen] = useState(true)
  const Chevron = open ? ChevronDown : ChevronRight
  const route = formatRoute(invoice.country_of_dispatch, invoice.country_of_destination)
  const summaryBits = [
    invoice.invoice_number
      ? t("transportOrders.invoiceLabel", { number: invoice.invoice_number })
      : null,
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
            {t("transportOrders.invoiceLabel", { number: invoice.invoice_number ?? invoice.id })}
          </span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {summaryBits.length > 0 ? summaryBits.join(" · ") : t("transportOrders.noInvoiceData")}
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
              label={t("transportOrders.sections.header")}
              fields={HEADER_FIELDS}
              defaults={headerDefaults(invoice)}
              schema={headerSchema}
              canEdit={canEdit}
              isSaving={isSavingHeader}
              resetKey={invoice.id}
              onSave={(v) => onSaveHeader(mapTrimToNull(v))}
            />
            <FieldsForm
              label={t("transportOrders.sections.deliveryTerms")}
              fields={DELIVERY_FIELDS}
              defaults={deliveryDefaults(invoice)}
              schema={deliverySchema}
              canEdit={canEdit}
              isSaving={isSavingDelivery}
              resetKey={invoice.id}
              onSave={(v) => onSaveDelivery(mapTrimToNull(v))}
            />
            <FieldsForm
              label={t("transportOrders.sections.totals")}
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
            canEdit={canEdit}
            isSaving={isSavingLines}
            onSaveLines={onSaveLines}
            useCustomsCode={useCustomsCode}
            showAtrProcessing={showAtrProcessing}
            {...(onSelectLine ? { onSelectLine } : {})}
          />
        </div>
      ) : null}
    </section>
  )
}
