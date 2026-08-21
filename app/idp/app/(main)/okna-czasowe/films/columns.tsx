"use client"

import type { Film } from "@/features/okna-czasowe/types"
import { Badge, Button } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import { Pencil, Trash2 } from "lucide-react"

interface FilmActionsProps {
  t: TFunction<"okna-czasowe">
  onEdit: (film: Film) => void
  onDelete: (film: Film) => void
}

export function buildFilmsColumns({
  t,
  onEdit,
  onDelete,
}: FilmActionsProps): ColumnDef<Film, unknown>[] {
  return [
    {
      id: "title",
      header: t("films.columns.title"),
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.title}</p>
          <p className="text-xs text-muted-foreground">{row.original.year}</p>
        </div>
      ),
    },
    {
      id: "tmdbId",
      header: "TMDB ID",
      cell: ({ row }) => row.original.tmdbId ?? "—",
    },
    {
      id: "foreignTitles",
      header: t("films.columns.foreignTitles"),
      cell: ({ row }) =>
        row.original.foreignTitles.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.original.foreignTitles.map((title) => (
              <Badge key={title} variant="outline" className="text-xs font-normal">
                {title}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("films.columns.edit")}
            onClick={() => onEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("films.columns.delete")}
            onClick={() => onDelete(row.original)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]
}
