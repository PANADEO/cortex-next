"use client"

import { useLocaleStore } from "@/lib/i18n/locale-store"
import { buildDetailCsv, buildDetailJson, buildExportFileName } from "@/lib/token-usage/csv"
import {
  Button,
  CortexDataGrid,
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
import { useTranslation } from "react-i18next"
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

export function DetailTable({ report, range }: DetailTableProps) {
  const { t } = useTranslation("token-usage")
  const locale = useLocaleStore((s) => s.locale)
  const [filters, setFilters] = useState<DetailFilters>(NO_FILTERS)

  // Nagłówki idą przez `t`, a separator tysięcy przez `locale`, więc definicja
  // kolumn nie może już być stałą modułu. `useMemo` po obu zachowuje jej
  // dotychczasową stabilność między renderami — inaczej grid dostawałby nową
  // tablicę przy każdym z nich. `locale` MUSI być w zależnościach: bez niego
  // przełączenie języka odświeża nagłówki, a liczby w komórkach zostają
  // sformatowane po staremu, bo `t` przy zmianie języka i tak jest nowe.
  const columns: ColumnDef<UsageDetailRow, unknown>[] = useMemo(
    () => [
      { accessorKey: "user", header: t("columns.user"), enableSorting: true },
      { accessorKey: "app", header: t("columns.app"), enableSorting: true },
      { accessorKey: "scope", header: t("columns.scope"), enableSorting: true },
      { accessorKey: "model", header: t("columns.model"), enableSorting: true },
      {
        accessorKey: "totalTokens",
        header: t("columns.totalTokens"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.totalTokens, locale)}</span>
        ),
      },
      {
        accessorKey: "reasoningTokens",
        header: t("columns.reasoningTokens"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatNumber(row.original.reasoningTokens, locale)}
          </span>
        ),
      },
      {
        accessorKey: "requestCount",
        header: t("columns.requestCount"),
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.requestCount, locale)}</span>
        ),
      },
    ],
    [t, locale],
  )

  const models = useMemo(
    () => availableModels(report.rows, filters.scope),
    [report.rows, filters.scope],
  )
  const scopes = useMemo(
    () => availableScopes(report.rows, filters.model),
    [report.rows, filters.model],
  )
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
            <Label htmlFor="token-usage-model">{t("detail.modelLabel")}</Label>
            <Select value={filters.model} onValueChange={(model) => update("model", model)}>
              <SelectTrigger id="token-usage-model" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>{t("detail.allModels")}</SelectItem>
                {models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-usage-scope">{t("detail.scopeLabel")}</Label>
            <Select value={filters.scope} onValueChange={(scope) => update("scope", scope)}>
              <SelectTrigger id="token-usage-scope" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_OPTION}>{t("detail.allScopes")}</SelectItem>
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
                buildDetailCsv(rows, t),
                buildExportFileName("szczegoly", range, "csv"),
                "text/csv",
              )
            }
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            {t("actions.downloadCsv")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadTextFile(
                buildDetailJson(report, range, t),
                buildExportFileName("raport", range, "json"),
                "application/json",
              )
            }
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            {t("actions.downloadJson")}
          </Button>
        </div>
      </div>

      <CortexDataGrid
        columns={columns}
        data={rows}
        bordered
        searchable
        searchPlaceholder={t("detail.searchPlaceholder")}
        emptyState={
          <EmptyState
            icon={Inbox}
            title={t("empty.noMatchTitle")}
            description={t("empty.noMatchDescription")}
          />
        }
      />
    </section>
  )
}
