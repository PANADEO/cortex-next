"use client"

import { INVOICE, PIPELINE } from "@/features/store-pit/dataset"
import { count } from "@/features/store-pit/helpers"
import type { AuditEntry, PipelineStep } from "@/features/store-pit/types"
import { Badge, Card, CardContent, DataCard, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { CheckCircle2, Layers, Package, TrendingUp } from "lucide-react"
import { useTranslation } from "react-i18next"

type Layer = PipelineStep["layer"]

const LAYER_BADGE: Record<Layer, string> = {
  input: "border-slate-500/30 bg-slate-500/15 text-slate-700 dark:text-slate-300",
  idp: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  engine: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  output: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
}

const LAYER_LABEL_KEY: Record<Layer, string> = {
  input: "layers.input",
  idp: "layers.idp",
  engine: "layers.engine",
  output: "layers.output",
}

const TIMESTAMPS = [
  "2026-06-12 08:14:02",
  "2026-06-12 08:14:31",
  "2026-06-12 08:15:48",
  "2026-06-12 08:15:59",
  "2026-06-12 08:18:11",
  "2026-06-12 08:18:25",
  "2026-06-12 08:18:34",
  "2026-06-12 08:19:07",
]

const DURATIONS = ["0.8s", "12.4s", "3.1s", "0.4s", "22.7s", "1.5s", "0.6s", "4.3s"]

interface EnrichedEntry extends AuditEntry {
  layer: Layer
}

const ENTRIES: EnrichedEntry[] = PIPELINE.map((step, i) => ({
  step: `${step.index}. ${step.name}`,
  detail: step.detail,
  rows: step.rows,
  status: "ok" as const,
  layer: step.layer,
  duration: DURATIONS[i] ?? "0.0s",
  finishedAt: TIMESTAMPS[i] ?? "",
}))

export default function AuditLogPage() {
  const { t } = useTranslation("store-pit")

  return (
    <>
      <PageHeader
        title={t("auditLog.title")}
        description={t("auditLog.description", { invoice: INVOICE.glsInvoiceNo })}
        actions={
          <Badge variant="outline" className="font-mono text-xs">
            {t("auditLog.stepsBadge", { n: ENTRIES.length })}
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DataCard
            label={t("auditLog.cards.runStatus")}
            value={t("status.completed")}
            tone="success"
            icon={CheckCircle2}
          />
          <DataCard label={t("auditLog.cards.steps")} value="8 / 8" icon={Layers} />
          <DataCard label={t("auditLog.cards.rowsProcessed")} value={count(3299)} icon={Package} />
          <DataCard label={t("fields.variance")} value="0.00" tone="success" icon={TrendingUp} />
        </section>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">{t("auditLog.columns.step")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("auditLog.columns.detail")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("auditLog.columns.layer")}</th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("auditLog.columns.rows")}
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      {t("auditLog.columns.duration")}
                    </th>
                    <th className="px-3 py-2.5 font-medium">{t("auditLog.columns.finishedAt")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("fields.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {ENTRIES.map((entry) => {
                    const layerLabelKey = LAYER_LABEL_KEY[entry.layer]
                    return (
                      <tr
                        key={entry.step}
                        className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                      >
                        <td className="px-4 py-3 text-xs font-medium">{entry.step}</td>
                        <td className="max-w-[240px] px-3 py-3 text-xs text-muted-foreground">
                          {entry.detail}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className={cn("text-xs", LAYER_BADGE[entry.layer])}
                          >
                            {layerLabelKey ? t(layerLabelKey) : null}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums">
                          {count(entry.rows)}
                        </td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums">
                          {entry.duration}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                          {entry.finishedAt}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className="border-emerald-500/30 bg-emerald-500/15 text-xs text-emerald-700 dark:text-emerald-300"
                          >
                            {t("status.ok")}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">{t("auditLog.footnote")}</p>
      </div>
    </>
  )
}
