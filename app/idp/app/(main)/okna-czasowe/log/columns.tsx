"use client"

import { formatDateTime } from "@/features/okna-czasowe/helpers"
import type { LogEntry } from "@/features/okna-czasowe/types"
import { Badge } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"

/** Patrz `dashboard/columns.tsx` — `t` idzie parametrem, nie hookiem. */
export function buildLogColumns(t: TFunction<"okna-czasowe">): ColumnDef<LogEntry, unknown>[] {
  return [
    {
      id: "startedAt",
      header: t("log.columns.startedAt"),
      cell: ({ row }) => formatDateTime(row.original.startedAt),
    },
    {
      id: "finishedAt",
      header: t("log.columns.finishedAt"),
      cell: ({ row }) => formatDateTime(row.original.finishedAt),
    },
    {
      id: "filmsScanned",
      header: t("log.columns.filmsScanned"),
      cell: ({ row }) => row.original.filmsScanned,
    },
    {
      id: "newAvailabilities",
      header: t("log.columns.newAvailabilities"),
      cell: ({ row }) =>
        row.original.newAvailabilities > 0 ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            {row.original.newAvailabilities}
          </Badge>
        ) : (
          row.original.newAvailabilities
        ),
    },
    {
      id: "changesDetected",
      header: t("log.columns.changesDetected"),
      cell: ({ row }) => row.original.changesDetected,
    },
    {
      id: "errors",
      header: t("log.columns.errors"),
      cell: ({ row }) =>
        row.original.errors.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <Badge variant="outline" className="border-destructive/40 text-destructive">
            {row.original.errors.length}
          </Badge>
        ),
    },
  ]
}
