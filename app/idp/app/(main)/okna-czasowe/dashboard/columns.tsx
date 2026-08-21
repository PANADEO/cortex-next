"use client"

import { formatDate } from "@/features/okna-czasowe/helpers"
import type { DashboardRow } from "@/features/okna-czasowe/types"
import { Badge } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import { CheckCircle2, XCircle } from "lucide-react"

/** Kolumny biorą `t` PARAMETREM, a nie z hooka: `header` bywa gołym napisem,
 *  a definicje powstają poza drzewem Reacta — hook nie miałby się gdzie wpiąć. */
export function buildDashboardColumns(
  t: TFunction<"okna-czasowe">,
): ColumnDef<DashboardRow, unknown>[] {
  return [
    {
      id: "film",
      header: t("dashboard.columns.film"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.film.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.film.year}</p>
        </div>
      ),
    },
    {
      id: "available",
      header: t("dashboard.columns.available"),
      cell: ({ row }) => {
        const available = row.original.latestSnapshot?.available ?? false
        return available ? (
          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {t("dashboard.columns.availableYes")}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">
            <XCircle className="mr-1 h-3 w-3" />
            {t("dashboard.columns.availableNo")}
          </Badge>
        )
      },
    },
    {
      id: "offerType",
      header: t("dashboard.columns.offerType"),
      cell: ({ row }) => row.original.latestSnapshot?.offerType ?? "—",
    },
    {
      id: "price",
      header: t("dashboard.columns.price"),
      cell: ({ row }) => row.original.latestSnapshot?.price ?? "—",
    },
    {
      id: "firstSeenAvailable",
      header: t("dashboard.columns.firstSeenAvailable"),
      cell: ({ row }) => formatDate(row.original.film.firstSeenAvailable),
    },
  ]
}
