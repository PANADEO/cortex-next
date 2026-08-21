"use client"

import { INVOICE, PIPELINE } from "@/features/store-pit/dataset"
import { count } from "@/features/store-pit/helpers"
import type { AuditEntry, PipelineStep } from "@/features/store-pit/types"
import { Badge, Card, CardContent, DataCard, PageHeader } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { CheckCircle2, Layers, Package, TrendingUp } from "lucide-react"

type Layer = PipelineStep["layer"]

const LAYER_BADGE: Record<Layer, string> = {
  input: "border-slate-500/30 bg-slate-500/15 text-slate-700 dark:text-slate-300",
  idp: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  engine: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  output: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300",
}

const LAYER_LABEL: Record<Layer, string> = {
  input: "Input",
  idp: "IDP",
  engine: "Engine",
  output: "Output",
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
  return (
    <>
      <PageHeader
        title="Audit log"
        description={`Processing run for GLS invoice ${INVOICE.glsInvoiceNo}.`}
        actions={
          <Badge variant="outline" className="font-mono text-xs">
            8 steps · completed
          </Badge>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <DataCard label="Run status" value="Completed" tone="success" icon={CheckCircle2} />
          <DataCard label="Steps" value="8 / 8" icon={Layers} />
          <DataCard label="Rows processed" value={count(3299)} icon={Package} />
          <DataCard label="Variance" value="0.00" tone="success" icon={TrendingUp} />
        </section>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Step</th>
                    <th className="px-3 py-2.5 font-medium">Detail</th>
                    <th className="px-3 py-2.5 font-medium">Layer</th>
                    <th className="px-3 py-2.5 text-right font-medium">Rows</th>
                    <th className="px-3 py-2.5 text-right font-medium">Duration</th>
                    <th className="px-3 py-2.5 font-medium">Finished at</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ENTRIES.map((entry) => (
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
                          {LAYER_LABEL[entry.layer]}
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
                          OK
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground">
          This log is an immutable record of each processing stage - the neutral decision-trail
          Store-Pit keeps per invoice.
        </p>
      </div>
    </>
  )
}
