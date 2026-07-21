"use client"

import { formatDateTime } from "@/features/okna-czasowe/helpers"
import type { LogEntry } from "@/features/okna-czasowe/types"
import { Badge } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"

export const logColumns: ColumnDef<LogEntry, unknown>[] = [
  {
    id: "startedAt",
    header: "Start",
    cell: ({ row }) => formatDateTime(row.original.startedAt),
  },
  {
    id: "finishedAt",
    header: "Koniec",
    cell: ({ row }) => formatDateTime(row.original.finishedAt),
  },
  {
    id: "filmsScanned",
    header: "Filmy",
    cell: ({ row }) => row.original.filmsScanned,
  },
  {
    id: "newAvailabilities",
    header: "Nowe dostępności",
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
    header: "Zmiany",
    cell: ({ row }) => row.original.changesDetected,
  },
  {
    id: "errors",
    header: "Błędy",
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
