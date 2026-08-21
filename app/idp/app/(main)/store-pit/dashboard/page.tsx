"use client"

import { GRAND_TOTAL, INVOICE, MARGIN, PIPELINE } from "@/features/store-pit/dataset"
import { count, eur, signedEur } from "@/features/store-pit/helpers"
import { Badge, Card, CardContent, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, CheckCircle2, History, SlidersHorizontal } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

interface LayerStyle {
  labelKey: string
  badge: string
  circle: string
}

const LAYER: Record<string, LayerStyle> = {
  input: {
    labelKey: "layers.input",
    badge: "border-slate-400/40 bg-slate-400/15 text-slate-600 dark:text-slate-300",
    circle: "bg-slate-400",
  },
  idp: {
    labelKey: "layers.ocr",
    badge: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    circle: "bg-emerald-500",
  },
  engine: {
    labelKey: "layers.engine",
    badge: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    circle: "bg-amber-500",
  },
  output: {
    labelKey: "layers.output",
    badge: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    circle: "bg-sky-500",
  },
}

interface StepLink {
  href: string
  blurbKey: string
}

const STEP_LINKS: Record<string, StepLink> = {
  "source-files": {
    href: "/store-pit/source-files",
    blurbKey: "overview.steps.sourceFiles",
  },
  extraction: {
    href: "/store-pit/extraction",
    blurbKey: "overview.steps.extraction",
  },
  reconciliation: {
    href: "/store-pit/reconciliation",
    blurbKey: "overview.steps.reconciliation",
  },
  classification: {
    href: "/store-pit/extraction",
    blurbKey: "overview.steps.classification",
  },
  netting: {
    href: "/store-pit/netting",
    blurbKey: "overview.steps.netting",
  },
  "re-rating": {
    href: "/store-pit/re-rating",
    blurbKey: "overview.steps.reRating",
  },
  aggregation: {
    href: "/store-pit/re-rating",
    blurbKey: "overview.steps.aggregation",
  },
  export: {
    href: "/store-pit/clients",
    blurbKey: "overview.steps.export",
  },
}

interface StateStat {
  label: string
  value: string
  tone?: "success"
}

interface ReferenceLink {
  href: string
  titleKey: string
  blurbKey: string
  icon: LucideIcon
}

const REFERENCES: ReferenceLink[] = [
  {
    href: "/store-pit/pricing",
    titleKey: "pricing.title",
    blurbKey: "overview.references.pricingBlurb",
    icon: SlidersHorizontal,
  },
  {
    href: "/store-pit/audit-log",
    titleKey: "auditLog.title",
    blurbKey: "overview.references.auditLogBlurb",
    icon: History,
  },
]

export default function StorePitOverviewPage() {
  const { t } = useTranslation("store-pit")

  const state: StateStat[] = useMemo(
    () => [
      { label: t("fields.status"), value: t("status.completed"), tone: "success" },
      { label: t("fields.parcels"), value: count(INVOICE.parcelCount) },
      { label: t("overview.state.glsInvoiceNet"), value: eur(INVOICE.pdfNetTotal) },
      { label: t("overview.state.spBilled"), value: eur(GRAND_TOTAL.spTotal) },
      { label: t("overview.state.spMargin"), value: signedEur(MARGIN.total), tone: "success" },
      { label: t("fields.variance"), value: "0.00", tone: "success" },
    ],
    [t],
  )

  return (
    <>
      <PageHeader
        title={t("overview.title")}
        description={t("overview.description")}
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
              {t("overview.runCompleted")}
            </Badge>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <Card className="border-border/70 bg-muted/30">
          <CardContent className="space-y-2 p-5">
            <p className="text-sm leading-relaxed">
              <span className="font-medium">{t("overview.introLead")}</span>{" "}
              {t("overview.introBody")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("overview.period", {
                week: INVOICE.week,
                from: INVOICE.periodFrom,
                to: INVOICE.periodTo,
                invoice: INVOICE.spInvoiceNo,
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-wrap items-stretch gap-x-8 gap-y-4 p-5">
            {state.map((s) => (
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
            <h2 className="text-sm font-semibold">{t("overview.stepsTitle")}</h2>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400" /> {t("layers.input")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {t("layers.ocr")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> {t("layers.engine")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500" /> {t("layers.output")}
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
                            {t(layer.labelKey)}
                          </Badge>
                          <span className="ml-auto flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {step.stat}
                            </span>
                            <CheckCircle2 className="h-3.5 w-3.5 text-success-foreground" />
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {t(link.blurbKey)}
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
          <h2 className="text-sm font-semibold">{t("overview.referenceTitle")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {REFERENCES.map((r) => (
              <Link key={r.href} href={r.href} className="group block">
                <Card className="transition-colors group-hover:border-primary/40">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                      <r.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{t(r.titleKey)}</h3>
                      <p className="text-xs text-muted-foreground">{t(r.blurbKey)}</p>
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
