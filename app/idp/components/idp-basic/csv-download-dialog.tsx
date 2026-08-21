"use client"

import { formatIdpBasicError } from "@/lib/idp-basic/api"
import { useIdpBasicCsvColumns, useIdpBasicExportCsv } from "@/lib/idp-basic/hooks"
import type { IdpBasicCsvExportFilters, IdpBasicCsvExportSource } from "@/lib/idp-basic/types"
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { Download, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

interface IdpBasicCsvDownloadButtonProps {
  source: IdpBasicCsvExportSource
  filters: IdpBasicCsvExportFilters
  packageIds?: string[] | undefined
  contextLabel?: string | undefined
  disabled?: boolean | undefined
}

type CsvExportRange = "table" | "custom"
type CsvCustomStatus = NonNullable<IdpBasicCsvExportFilters["status"]>

const STATUS_OPTIONS: Array<{ value: CsvCustomStatus; labelKey: string }> = [
  { value: "all", labelKey: "status.all" },
  { value: "queued", labelKey: "status.queued" },
  { value: "processing", labelKey: "status.processing" },
  { value: "ready", labelKey: "status.ready" },
  { value: "needs_review", labelKey: "status.needsReview" },
  { value: "failed", labelKey: "status.failed" },
]

export function IdpBasicCsvDownloadButton({
  source,
  filters,
  packageIds,
  contextLabel,
  disabled,
}: IdpBasicCsvDownloadButtonProps) {
  const { t } = useTranslation(["idp-basic", "common"])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [range, setRange] = useState<CsvExportRange>("table")
  const [customStatus, setCustomStatus] = useState<CsvCustomStatus>("all")
  const [customDateFrom, setCustomDateFrom] = useState("")
  const [customDateTo, setCustomDateTo] = useState("")
  const columns = useIdpBasicCsvColumns()
  const exportCsv = useIdpBasicExportCsv()
  const availableColumns = columns.data?.columns ?? []
  const selectedIds = useMemo(() => [...selected], [selected])
  const customScopeLabel = t(source === "files" ? "csv.customFileRange" : "csv.customPackageRange")
  const tableScopeLabel =
    contextLabel ?? t(source === "files" ? "csv.filesMatchingTable" : "csv.packagesMatchingTable")

  useEffect(() => {
    if (!open || !columns.data) return
    setSelected(new Set(columns.data.selected_columns))
    setRange("table")
    setCustomStatus(filters.status ?? "all")
    setCustomDateFrom(filters.date_from ?? "")
    setCustomDateTo(filters.date_to ?? "")
  }, [open, columns.data, filters.status, filters.date_from, filters.date_to])

  const toggleColumn = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(availableColumns.map((column) => column.id)))

  const runDownload = async () => {
    try {
      const effectiveFilters =
        range === "table"
          ? filters
          : {
              status: customStatus,
              date_from: customDateFrom,
              date_to: customDateTo,
            }
      const result = await exportCsv.mutateAsync({
        source,
        columns: selectedIds,
        ...effectiveFilters,
        ...(range === "table" && packageIds ? { package_ids: packageIds } : {}),
      })
      downloadBlob(result.blob, result.filename)
      toast.success(t("toast.csvDownloaded"))
      setOpen(false)
    } catch (error) {
      toast.error(formatIdpBasicError(error, t("errors.csvDownloadFailed")))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        {t("csv.trigger")}
      </Button>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("csv.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("csv.dialogDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("csv.scopeLabel")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={range === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setRange("table")}
                aria-pressed={range === "table"}
              >
                {t("csv.tableScope")}
              </Button>
              <Button
                type="button"
                variant={range === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setRange("custom")}
                aria-pressed={range === "custom"}
              >
                {t("csv.customRange")}
              </Button>
            </div>
          </div>

          {range === "custom" ? (
            <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_1.25fr]">
              <div className="space-y-1.5">
                <Label
                  htmlFor="idp-basic-csv-date-from"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  {t("csv.from")}
                </Label>
                <Input
                  id="idp-basic-csv-date-from"
                  type="date"
                  value={customDateFrom}
                  onChange={(event) => setCustomDateFrom(event.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="idp-basic-csv-date-to"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  {t("csv.to")}
                </Label>
                <Input
                  id="idp-basic-csv-date-to"
                  type="date"
                  value={customDateTo}
                  onChange={(event) => setCustomDateTo(event.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="idp-basic-csv-status"
                  className="text-[10px] uppercase tracking-wide text-muted-foreground"
                >
                  {t("filters.status")}
                </Label>
                <Select
                  value={customStatus}
                  onValueChange={(value) => setCustomStatus(value as CsvCustomStatus)}
                >
                  <SelectTrigger id="idp-basic-csv-status" className="h-9">
                    <SelectValue placeholder={t("filters.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{range === "table" ? tableScopeLabel : customScopeLabel}</span>
            <span>
              {t("csv.columnsSelected", {
                selected: selected.size,
                total: availableColumns.length,
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
              {t("csv.selectAll")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              {t("csv.clear")}
            </Button>
          </div>

          <div className="max-h-[360px] overflow-y-auto rounded-md border border-border">
            {columns.isPending ? (
              <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                {t("csv.loadingColumns")}
              </div>
            ) : (
              <div className="grid gap-1 p-2 sm:grid-cols-2">
                {availableColumns.map((column) => (
                  <label
                    key={column.id}
                    className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <Checkbox
                      checked={selected.has(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                      aria-label={column.label}
                    />
                    <span>{column.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exportCsv.isPending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={runDownload} disabled={selected.size === 0 || exportCsv.isPending}>
            {exportCsv.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            {t("csv.download")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
