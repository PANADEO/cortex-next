"use client"

import { ExportConfig } from "@/components/export/export-config"
import { PackagePicker } from "@/components/export/package-picker"
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/export/fields"
import { useExportBuilder } from "@/lib/export/use-export-builder"
import { Button, PageHeader } from "@cortex/ui"
import { FileDown, Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

/** `t` wędruje parametrem — te dwie pomocnicze nie są komponentami. */
type Translate = ReturnType<typeof useTranslation>["t"]

function formatLabel(t: Translate, id: ExportFormat): string {
  const format = EXPORT_FORMATS.find((f) => f.id === id)
  return format ? t(format.labelKey) : id
}

function destinationLabel(t: Translate, state: ReturnType<typeof useExportBuilder>): string {
  if (state.destination === "download") return t("export.page.destinationDownload")
  return state.networkPath || t("export.page.destinationNetwork")
}

export default function ExportPage() {
  const { t } = useTranslation("idp")
  const state = useExportBuilder()
  const [running, setRunning] = useState(false)

  const canRun = state.selectedPackageIds.size > 0 && state.selectedFields.size > 0 && !running

  const handleRun = async () => {
    setRunning(true)
    // Prototype: no real backend call — acknowledge intent.
    await new Promise((resolve) => setTimeout(resolve, 900))
    toast.success(
      t("export.page.done", {
        count: state.selectedPackageIds.size,
        format: formatLabel(t, state.format),
        destination: destinationLabel(t, state),
      }),
    )
    setRunning(false)
  }

  return (
    <>
      <PageHeader title={t("export.page.title")} description={t("export.page.description")} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-8 py-6">
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
          <PackagePicker state={state} />
          <ExportConfig state={state} />
        </div>

        <SummaryBar state={state} running={running} canRun={canRun} onRun={handleRun} />
      </div>
    </>
  )
}

function SummaryBar({
  state,
  running,
  canRun,
  onRun,
}: {
  state: ReturnType<typeof useExportBuilder>
  running: boolean
  canRun: boolean
  onRun: () => void
}) {
  const { t } = useTranslation("idp")
  const pkgCount = state.selectedPackageIds.size
  const fieldCount = state.selectedFields.size

  return (
    <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <SummaryChip label={t("export.summary.packages")} value={pkgCount} />
        <SummaryChip
          label={t("export.summary.format")}
          value={formatLabel(t, state.format).toUpperCase()}
        />
        <SummaryChip label={t("export.summary.columns")} value={fieldCount} />
        <SummaryChip
          label={t("export.summary.packaging")}
          value={
            state.packaging === "zip"
              ? t("export.summary.packagingZip")
              : t("export.summary.packagingIndividual")
          }
        />
        {state.includeSources ? (
          <SummaryChip label={t("export.summary.sources")} value={t("export.summary.sourcesOn")} />
        ) : null}
        <SummaryChip
          label={t("export.summary.destination")}
          value={
            state.destination === "download"
              ? t("export.summary.destinationDownload")
              : t("export.summary.destinationNetwork")
          }
        />
      </div>
      <Button type="button" onClick={onRun} disabled={!canRun}>
        {running ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="mr-1.5 h-4 w-4" />
        )}
        {t("export.page.run")}
      </Button>
    </div>
  )
}

function SummaryChip({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold text-foreground">{value}</span>
    </span>
  )
}
