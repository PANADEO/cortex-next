"use client"

import { GRAND_TOTAL, INVOICE, MARGIN, PIPELINE } from "@/features/store-pit/dataset"
import { count, eur, signedEur } from "@/features/store-pit/helpers"
import { Badge, Card, CardContent, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, CheckCircle2, History, SlidersHorizontal } from "lucide-react"
import Link from "next/link"

interface LayerStyle {
  label: string
  badge: string
  circle: string
}

const LAYER: Record<string, LayerStyle> = {
  input: {
    label: "Input",
    badge: "border-slate-400/40 bg-slate-400/15 text-slate-600 dark:text-slate-300",
    circle: "bg-slate-400",
  },
  idp: {
    label: "OCR",
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    circle: "bg-emerald-500",
  },
  engine: {
    label: "Engine",
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    circle: "bg-amber-500",
  },
  output: {
    label: "Output",
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    circle: "bg-sky-500",
  },
}

interface StepLink {
  href: string
  blurb: string
}

const STEP_LINKS: Record<string, StepLink> = {
  "source-files": {
    href: "/store-pit/source-files",
    blurb:
      "GLS sends two files each week - a CSV with every parcel and a PDF with the rate summary. Everything starts here.",
  },
  extraction: {
    href: "/store-pit/extraction",
    blurb:
      "Read those files into clean shipment lines. This is the only step that is OCR - everything after it is calculation.",
  },
  reconciliation: {
    href: "/store-pit/reconciliation",
    blurb:
      "Check the numbers tie out: the CSV total equals the PDF total and parcel counts match. Bad data is caught before any billing.",
  },
  classification: {
    href: "/store-pit/extraction",
    blurb:
      "Work out which client each parcel belongs to, from the reference code on it (FP- is FlatPay, NV is Nordvio, and so on).",
  },
  netting: {
    href: "/store-pit/netting",
    blurb:
      "Match GLS discounts to the right parcels and subtract them first, so the saving is passed to the client before any margin.",
  },
  "re-rating": {
    href: "/store-pit/re-rating",
    blurb:
      "Apply each client's own price deal - FlatPay x1.1, Braintimizer's contract, Drywear and Nordvio off a price list. This is the heart of it, not a flat markup.",
  },
  aggregation: {
    href: "/store-pit/re-rating",
    blurb:
      "Roll everything up per client and country, then add the surcharges - energy, road tolls and pre-financing.",
  },
  export: {
    href: "/store-pit/clients",
    blurb:
      "Each client gets a clean statement: their parcels, their countries, the amount to settle. Store-Pit sees its margin.",
  },
}

interface StateStat {
  label: string
  value: string
  tone?: "success"
}

const STATE: StateStat[] = [
  { label: "Status", value: "Completed", tone: "success" },
  { label: "Parcels", value: count(INVOICE.parcelCount) },
  { label: "GLS invoice (net)", value: eur(INVOICE.pdfNetTotal) },
  { label: "Store-Pit billed", value: eur(GRAND_TOTAL.spTotal) },
  { label: "Store-Pit margin", value: signedEur(MARGIN.total), tone: "success" },
  { label: "Variance", value: "0.00", tone: "success" },
]

interface ReferenceLink {
  href: string
  title: string
  blurb: string
  icon: LucideIcon
}

const REFERENCES: ReferenceLink[] = [
  {
    href: "/store-pit/pricing",
    title: "Pricing rules",
    blurb: "The reference price lists and settings the engine looks up while re-rating.",
    icon: SlidersHorizontal,
  },
  {
    href: "/store-pit/audit-log",
    title: "Audit log",
    blurb: "The immutable, step-by-step record of this processing run.",
    icon: History,
  },
]

export default function StorePitOverviewPage() {
  return (
    <>
      <PageHeader
        title="Process overview"
        description="What this invoice is, where it is, and the data behind every step."
        actions={
          <>
            <Badge variant="outline" className="font-mono text-xs">
              {INVOICE.carrier} · {INVOICE.glsInvoiceNo}
            </Badge>
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Run completed
            </Badge>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <Card className="border-border/70 bg-muted/30">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm leading-relaxed">
              <span className="font-medium">Store-Pit buys parcels in bulk from GLS</span> and
              re-bills them to each of its clients with a margin. This screen follows one weekly GLS
              invoice through the eight steps that turn a single mixed bill into a clean, per-client
              settlement. Click any step to open the data behind it.
            </p>
            <p className="text-xs text-muted-foreground">
              Week {INVOICE.week} · period {INVOICE.periodFrom} to {INVOICE.periodTo} · invoice{" "}
              {INVOICE.spInvoiceNo}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-stretch gap-x-8 gap-y-4 p-5">
            {STATE.map((s) => (
              <div key={s.label} className="space-y-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p
                  className={cn(
                    "text-lg font-semibold tabular-nums",
                    s.tone === "success" && "text-success-foreground",
                  )}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">This invoice, step by step</h2>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> Input
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> OCR
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Engine
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> Output
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {PIPELINE.map((step) => {
              const layer = LAYER[step.layer] ?? LAYER.engine
              const link = STEP_LINKS[step.id]
              if (!layer || !link) return null
              return (
                <Link key={step.id} href={link.href} className="group block">
                  <Card className="transition-colors group-hover:border-primary/40">
                    <CardContent className="flex items-start gap-4 p-4">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white",
                          layer.circle,
                        )}
                      >
                        {step.index}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold">{step.name}</h3>
                          <Badge variant="outline" className={cn("text-[10px]", layer.badge)}>
                            {layer.label}
                          </Badge>
                          <span className="ml-auto flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {step.stat}
                            </span>
                            <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground" />
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {link.blurb}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Reference and controls</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {REFERENCES.map((r) => (
              <Link key={r.href} href={r.href} className="group block">
                <Card className="transition-colors group-hover:border-primary/40">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <r.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{r.title}</h3>
                      <p className="text-xs text-muted-foreground">{r.blurb}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
