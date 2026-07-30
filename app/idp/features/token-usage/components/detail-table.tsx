"use client"

import { buildDetailCsv, buildDetailJson, buildExportFileName } from "@/lib/token-usage/csv"
import {
  Button,
  DataTable,
  EmptyState,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import { Download, Inbox } from "lucide-react"
import { useMemo, useState } from "react"
import {
  ALL_OPTION,
  NO_FILTERS,
  availableModels,
  availableScopes,
  filterRows,
  reconcileFilters,
  type DetailFilters,
} from "../cascade"
import { downloadTextFile } from "../download"
import { formatNumber } from "../format"
import type { UsageDateRange, UsageDetailRow, UsageReport } from "../types"

interface DetailTableProps {
  report: UsageReport
  range: UsageDateRange
}

const columns: ColumnDef<UsageDetailRow, unknown>[] = [
  { accessorKey: "user", header: "Użytkownik" },
  { accessorKey: "app", header: "Aplikacja" },
  { accessorKey: "scope", header: "Zakres" },
  { accessorKey: "model", header: "Model" },
  {
    accessorKey: "totalTokens",
    header: "Tokeny",
    cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.totalTokens)}</span>,
  },
  {
    accessorKey: "reasoningTokens",
    header: "Rozumowanie",
    cell: ({ row }) => (
      <span className="tabular-nums text-muted-foreground">
        {formatNumber(row.original.reasoningTokens)}
      </span>
    ),
  },
  {
    accessorKey: "requestCount",
    header: "Żądania",
    cell: ({ row }) => (
      <span className="tabular-nums">{formatNumber(row.original.requestCount)}</span>
    ),
  },
]

export function DetailTable({ report, range }: DetailTableProps) {
  const [filters, setFilters] = useState<DetailFilters>(NO_FILTERS)

  const models = useMemo(() => availableModels(report.rows, filters.scope), [report.rows, filters.scope])
  const scopes = useMemo(() => availableScopes(report.rows, filters.model), [report.rows, filters.model])
  const rows = useMemo(() => filterRows(report.rows, filters), [report.rows, filters])

  function update(changed: keyof DetailFilters, value: string) {
    // Po zmianie jednego wymiaru drugi bywa nieosiągalny — reconcile zwalnia
    // osierocony filtr, zachowując ten właśnie wybrany.
    setFilters((current) =>
      reconcileFilters(report.rows, { ...current, [changed]: value }, changed),
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="token-usage-model">Model</Label>
            <Select value={filters.model} onValueChange={(model) => update("model", model)}>
              <SelectTrigger id="token-usage-model" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>Wszystkie modele</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-usage-scope">Zakres</Label>
            <Select value={filters.scope} onValueChange={(scope) => update("scope", scope)}>
              <SelectTrigger id="token-usage-scope" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>Wszystkie zakresy</SelectItem>
                {scopes.map((scope) => (
                  <SelectItem key={scope} value={scope}>
                    {scope}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadTextFile(
                buildDetailCsv(rows),
                buildExportFileName("szczegoly", range, "csv"),
                "text/csv",
              )
            }
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            Pobierz CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadTextFile(
                buildDetailJson(report, range),
                buildExportFileName("raport", range, "json"),
                "application/json",
              )
            }
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            Pobierz JSON
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        bordered
        emptyState={
          <EmptyState
            icon={Inbox}
            title="Brak danych dla wybranych filtrów"
            description="Zmień model lub zakres, albo poszerz przedział dat."
          />
        }
      />
    </section>
  )
}
