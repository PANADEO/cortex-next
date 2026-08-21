"use client"

import { buildExportFileName, buildGroupCsv } from "@/lib/token-usage/csv"
import { BarList, Button, CortexDataGrid, EmptyState } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import { Download, Inbox } from "lucide-react"
import { useTranslation } from "react-i18next"
import { downloadTextFile } from "../download"
import { formatNumber, formatShare } from "../format"
import type { UsageDateRange, UsageGroup } from "../types"

interface DimensionPanelProps {
  title: string
  /** Nagłówek kolumny klucza. Dla użytkowników brzmi "Użytkownik", nie "E-mail". */
  dimensionLabel: string
  groups: readonly UsageGroup[]
  range: UsageDateRange
  /** Człon nazwy pliku eksportu, np. "uzytkownicy". */
  exportKind: string
  /** Ile pozycji pokazać na liście słupkowej. Tabela pokazuje komplet. */
  chartLimit?: number
  /** Kolumna "Użytkownicy" nie ma sensu w wymiarze użytkownika. */
  showUserCount?: boolean
}

export function DimensionPanel({
  title,
  dimensionLabel,
  groups,
  range,
  exportKind,
  chartLimit = 15,
  showUserCount = true,
}: DimensionPanelProps) {
  const { t } = useTranslation("token-usage")

  const columns: ColumnDef<UsageGroup, unknown>[] = [
    { accessorKey: "key", header: dimensionLabel, enableSorting: true },
    {
      accessorKey: "totalTokens",
      header: t("columns.totalTokens"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.totalTokens)}</span>
      ),
    },
    {
      accessorKey: "requestCount",
      header: t("columns.requestCount"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.requestCount)}</span>
      ),
    },
    ...(showUserCount
      ? [
          {
            accessorKey: "userCount",
            header: t("columns.userCount"),
            enableSorting: true,
            cell: ({ row }) => (
              <span className="tabular-nums">{formatNumber(row.original.userCount)}</span>
            ),
          } as ColumnDef<UsageGroup, unknown>,
        ]
      : []),
    {
      accessorKey: "share",
      header: t("columns.share"),
      enableSorting: true,
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatShare(row.original.share)}
        </span>
      ),
    },
  ]

  if (groups.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <EmptyState icon={Inbox} title={t("empty.noDataTitle")} />
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadTextFile(
              buildGroupCsv(groups, dimensionLabel),
              buildExportFileName(exportKind, range, "csv"),
              "text/csv",
            )
          }
        >
          <Download className="mr-2 h-3.5 w-3.5" />
          {t("actions.downloadCsv")}
        </Button>
      </div>

      <BarList
        items={groups.slice(0, chartLimit).map((group) => ({
          label: group.key,
          value: group.totalTokens,
          share: group.share,
          meta: t("panel.barMeta", { requests: formatNumber(group.requestCount) }),
        }))}
        formatValue={formatNumber}
      />

      {groups.length > chartLimit ? (
        <p className="text-xs text-muted-foreground">
          {t("panel.truncated", { shown: chartLimit, total: groups.length })}
        </p>
      ) : null}

      <CortexDataGrid columns={columns} data={[...groups]} bordered getRowId={(row) => row.key} />
    </section>
  )
}
