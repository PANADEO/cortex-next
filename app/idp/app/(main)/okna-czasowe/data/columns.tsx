"use client"

import { formatDateTime } from "@/features/okna-czasowe/helpers"
import type { Film, Snapshot } from "@/features/okna-czasowe/types"
import { Badge } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"

export interface SnapshotRow {
  snapshot: Snapshot
  film: Film | undefined
}

/** Patrz `dashboard/columns.tsx` — `t` idzie parametrem, nie hookiem. */
export function buildSnapshotColumns(
  t: TFunction<"okna-czasowe">,
): ColumnDef<SnapshotRow, unknown>[] {
  return [
    {
      id: "film",
      header: t("data.columns.film"),
      cell: ({ row }) => row.original.film?.title ?? row.original.snapshot.filmId,
    },
    {
      id: "scannedAt",
      header: t("data.columns.scannedAt"),
      cell: ({ row }) => formatDateTime(row.original.snapshot.scannedAt),
    },
    {
      id: "available",
      header: t("data.columns.available"),
      cell: ({ row }) =>
        row.original.snapshot.available ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            {t("data.columns.availableYes")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            {t("data.columns.availableNo")}
          </Badge>
        ),
    },
    {
      id: "offerType",
      header: t("data.columns.offerType"),
      cell: ({ row }) => row.original.snapshot.offerType ?? "—",
    },
    {
      id: "price",
      header: t("data.columns.price"),
      cell: ({ row }) => row.original.snapshot.price ?? "—",
    },
    {
      id: "matchedTitle",
      header: t("data.columns.matchedTitle"),
      cell: ({ row }) =>
        row.original.snapshot.ambiguous ? (
          <span className="text-warning-foreground">
            {t("data.columns.matchedTitleAmbiguous", {
              title: row.original.snapshot.matchedTitle ?? "?",
            })}
          </span>
        ) : (
          (row.original.snapshot.matchedTitle ?? "—")
        ),
    },
  ]
}
