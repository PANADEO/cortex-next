"use client"

import { formatDateTime } from "@/features/okna-czasowe/helpers"
import type { Film, Snapshot } from "@/features/okna-czasowe/types"
import { Badge } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"

export interface SnapshotRow {
  snapshot: Snapshot
  film: Film | undefined
}

export const snapshotColumns: ColumnDef<SnapshotRow, unknown>[] = [
  {
    id: "film",
    header: "Film",
    cell: ({ row }) => row.original.film?.title ?? row.original.snapshot.filmId,
  },
  {
    id: "scannedAt",
    header: "Data skanu",
    cell: ({ row }) => formatDateTime(row.original.snapshot.scannedAt),
  },
  {
    id: "available",
    header: "Dostępny",
    cell: ({ row }) =>
      row.original.snapshot.available ? (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          Tak
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          Nie
        </Badge>
      ),
  },
  {
    id: "offerType",
    header: "Typ oferty",
    cell: ({ row }) => row.original.snapshot.offerType ?? "—",
  },
  {
    id: "price",
    header: "Cena",
    cell: ({ row }) => row.original.snapshot.price ?? "—",
  },
  {
    id: "matchedTitle",
    header: "Dopasowany tytuł",
    cell: ({ row }) =>
      row.original.snapshot.ambiguous ? (
        <span className="text-warning-foreground">
          {row.original.snapshot.matchedTitle ?? "?"} (niepewne)
        </span>
      ) : (
        (row.original.snapshot.matchedTitle ?? "—")
      ),
  },
]
