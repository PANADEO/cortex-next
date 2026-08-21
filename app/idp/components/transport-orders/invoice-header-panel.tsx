"use client"

import type { Invoice, Party, TransportOrder } from "@cortex/types"
import { Button } from "@cortex/ui"
import { cn, formatRoute } from "@cortex/utils"
import { Building2, ChevronDown, ChevronRight, FileText, Truck, User } from "lucide-react"
import { Fragment, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

interface Props {
  order: TransportOrder
  invoice: Invoice
}

export function InvoiceHeaderPanel({ order, invoice }: Props) {
  const { t } = useTranslation("idp")
  const [open, setOpen] = useState(false)

  const dispatchToDestination = formatRoute(
    invoice.country_of_dispatch ?? order.country_of_dispatch,
    invoice.country_of_destination ?? order.country_of_destination,
  )
  const summaryBits = [
    invoice.invoice_number
      ? t("transportOrders.invoiceLabel", { number: invoice.invoice_number })
      : null,
    invoice.invoice_date,
    invoice.invoice_currency,
    dispatchToDestination,
  ].filter(Boolean) as string[]

  const consignorDiffers = isDistinctParty(order.consignor, order.seller)
  const consigneeDiffers = isDistinctParty(order.consignee, order.buyer)
  const showConsignorConsignee = consignorDiffers || consigneeDiffers

  const Chevron = open ? ChevronDown : ChevronRight

  return (
    <div className="shrink-0 border-b border-border bg-muted/20">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        className="h-auto w-full justify-start gap-2 rounded-none px-3 py-2 text-left hover:bg-muted/40"
        aria-expanded={open}
        aria-controls="invoice-header-panel-content"
      >
        <Chevron className="h-4 w-4 shrink-0 text-muted-foreground" />
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-xs font-semibold">{t("transportOrders.header.title")}</span>
        <span className="truncate text-xs font-normal text-muted-foreground">
          {summaryBits.length > 0 ? summaryBits.join(" · ") : t("transportOrders.header.noData")}
        </span>
      </Button>
      {open ? (
        <div id="invoice-header-panel-content" className="grid gap-3 px-3 pb-3 pt-1 md:grid-cols-2">
          <PartySection
            icon={Building2}
            label={t("transportOrders.parties.seller")}
            party={order.seller}
          />
          <PartySection
            icon={User}
            label={t("transportOrders.parties.buyer")}
            party={order.buyer}
          />
          <InvoiceMetaSection invoice={invoice} dispatchToDestination={dispatchToDestination} />
          {showConsignorConsignee ? (
            <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
              {consignorDiffers ? (
                <PartySection
                  icon={Truck}
                  label={t("transportOrders.parties.consignor")}
                  party={order.consignor}
                />
              ) : null}
              {consigneeDiffers ? (
                <PartySection
                  icon={Truck}
                  label={t("transportOrders.parties.consignee")}
                  party={order.consignee}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

interface PartySectionProps {
  icon: typeof Building2
  label: string
  party: Party | null
}

function PartySection({ icon: Icon, label, party }: PartySectionProps) {
  const { t } = useTranslation("idp")
  return (
    <section className="rounded-md border border-border bg-background p-3">
      <header className="mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide">{label}</h3>
      </header>
      {party ? (
        <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-0.5 text-xs">
          <Row label={t("transportOrders.fields.name")} value={party.name} />
          <Row label={t("transportOrders.fields.vatId")} value={party.vat_id} emphasize />
          <Row label={t("transportOrders.fields.street")} value={party.street} />
          <Row
            label={t("transportOrders.fields.city")}
            value={formatCity(party.postal_code, party.city, party.country_code)}
          />
        </dl>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          {t("transportOrders.header.notProvided")}
        </p>
      )}
    </section>
  )
}

interface InvoiceMetaSectionProps {
  invoice: Invoice
  dispatchToDestination: string | null
}

function InvoiceMetaSection({ invoice, dispatchToDestination }: InvoiceMetaSectionProps) {
  const { t } = useTranslation("idp")
  return (
    <section className="rounded-md border border-border bg-background p-3 md:col-span-2">
      <header className="mb-2 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wide">
          {t("transportOrders.header.invoiceSection")}
        </h3>
      </header>
      <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[6rem_1fr_6rem_1fr]">
        <Row label={t("transportOrders.header.rowNumber")} value={invoice.invoice_number} />
        <Row label={t("transportOrders.header.rowDate")} value={invoice.invoice_date} />
        <Row label={t("transportOrders.fields.currency")} value={invoice.invoice_currency} />
        <Row label={t("transportOrders.header.rowRoute")} value={dispatchToDestination} />
        <Row label="Incoterms" value={formatIncoterms(invoice.delivery_terms)} />
      </dl>
    </section>
  )
}

interface RowProps {
  label: string
  value: string | null | undefined
  emphasize?: boolean
}

function Row({ label, value, emphasize }: RowProps): ReactNode {
  return (
    <Fragment>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "truncate font-mono text-[11px]",
          emphasize && "font-semibold text-foreground",
        )}
      >
        {value && value.trim() !== "" ? value : "—"}
      </dd>
    </Fragment>
  )
}

function formatCity(
  postalCode: string | null,
  city: string | null,
  countryCode: string | null,
): string | null {
  const parts = [[postalCode, city].filter(Boolean).join(" ").trim() || null, countryCode].filter(
    Boolean,
  ) as string[]
  if (parts.length === 0) return null
  return parts.join(", ")
}

function formatIncoterms(
  terms: { incoterms_code: string | null; incoterms_place: string | null } | null,
): string | null {
  if (!terms) return null
  const parts = [terms.incoterms_code, terms.incoterms_place].filter(Boolean) as string[]
  return parts.length > 0 ? parts.join(" ") : null
}

function isDistinctParty(a: Party | null, b: Party | null): boolean {
  if (!a) return false
  if (!b) return true
  return a.id !== b.id
}
