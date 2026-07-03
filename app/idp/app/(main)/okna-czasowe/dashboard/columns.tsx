"use client"

import { formatDate } from "@/features/okna-czasowe/helpers"
import type { DashboardRow } from "@/features/okna-czasowe/types"
import { Badge } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import { CheckCircle2, XCircle } from "lucide-react"

export const dashboardColumns: ColumnDef<DashboardRow, unknown>[] = [
  {
    id: "film",
    header: "Film",
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.film.title}</p>
        <p className="text-xs text-muted-foreground">{row.original.film.year}</p>
      </div>
    ),
  },
  {
    id: "available",
    header: "Rakuten PL teraz?",
    cell: ({ row }) => {
      const available = row.original.latestSnapshot?.available ?? false
      return available ? (
        <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Dostępny
        </Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          <XCircle className="mr-1 h-3 w-3" />
          Brak
        </Badge>
      )
    },
  },
  {
    id: "offerType",
    header: "Typ oferty",
    cell: ({ row }) => row.original.latestSnapshot?.offerType ?? "—",
  },
  {
    id: "price",
    header: "Cena",
    cell: ({ row }) => row.original.latestSnapshot?.price ?? "—",
  },
  {
    id: "firstSeenAvailable",
    header: "Od kiedy",
    cell: ({ row }) => formatDate(row.original.film.firstSeenAvailable),
  },
]
