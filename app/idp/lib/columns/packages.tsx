"use client"

import type { PackageReadModel } from "@cortex/types"
import { Checkbox, PackageStatusBadges } from "@cortex/ui"
import { formatRelative } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"
import type { useTranslation } from "react-i18next"

export interface PackageColumnsOptions {
  /** `t` wędruje parametrem — to nie jest komponent, więc hooka tu wołać nie wolno. */
  t: ReturnType<typeof useTranslation>["t"]
  selection?: {
    selected: Set<string>
    allSelectedOnPage: boolean
    toggleRow: (id: string) => void
    toggleAll: () => void
  }
}

export function packageColumns(
  options: PackageColumnsOptions,
): ColumnDef<PackageReadModel, unknown>[] {
  const { selection, t } = options
  const cols: ColumnDef<PackageReadModel, unknown>[] = []

  if (selection) {
    cols.push({
      id: "__select__",
      size: 36,
      header: () => (
        <Checkbox
          checked={selection.allSelectedOnPage}
          onCheckedChange={() => selection.toggleAll()}
          aria-label={t("packages.columns.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selection.selected.has(row.original.id)}
          onCheckedChange={() => selection.toggleRow(row.original.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("packages.columns.selectRow", {
            name: row.original.package_name ?? row.original.file_name,
          })}
        />
      ),
    })
  }

  cols.push({
    accessorKey: "file_name",
    header: t("packages.columns.file"),
    cell: ({ row }) => (
      <Link href={`/idp/packages/${row.original.id}`} className="block min-w-0 hover:underline">
        <span className="block truncate text-xs font-medium">
          {row.original.package_name ?? row.original.file_name}
        </span>
        {row.original.package_name ? (
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {row.original.file_name}
          </span>
        ) : null}
      </Link>
    ),
  })

  cols.push({
    accessorKey: "uploaded_by",
    header: t("packages.columns.uploader"),
    size: 140,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{row.original.uploaded_by ?? "—"}</span>
    ),
  })

  cols.push(
    {
      accessorKey: "created_date",
      header: t("packages.columns.created"),
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatRelative(row.original.created_date)}
        </span>
      ),
    },
    {
      accessorKey: "processing_state",
      header: t("packages.columns.status"),
      size: 260,
      cell: ({ row }) => (
        <PackageStatusBadges
          processingState={row.original.processing_state}
          verificationState={row.original.verification_state}
        />
      ),
    },
    {
      accessorKey: "assignee",
      header: t("packages.columns.assignee"),
      size: 180,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.assignee ?? "—"}</span>
      ),
    },
  )

  return cols
}
