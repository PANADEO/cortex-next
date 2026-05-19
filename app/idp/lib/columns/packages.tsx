"use client"

import type { PackageReadModel } from "@cortex/types"
import { Checkbox, PackageStatusBadges } from "@cortex/ui"
import { formatRelative } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

export interface PackageColumnsOptions {
  selection?: {
    selected: Set<string>
    allSelectedOnPage: boolean
    toggleRow: (id: string) => void
    toggleAll: () => void
  }
}

export function packageColumns(
  options: PackageColumnsOptions = {},
): ColumnDef<PackageReadModel, unknown>[] {
  const { selection } = options
  const cols: ColumnDef<PackageReadModel, unknown>[] = []

  if (selection) {
    cols.push({
      id: "__select__",
      size: 36,
      header: () => (
        <Checkbox
          checked={selection.allSelectedOnPage}
          onCheckedChange={() => selection.toggleAll()}
          aria-label="Select all on page"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selection.selected.has(row.original.id)}
          onCheckedChange={() => selection.toggleRow(row.original.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.original.package_name ?? row.original.file_name}`}
        />
      ),
    })
  }

  cols.push({
    accessorKey: "file_name",
    header: "File",
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
    header: "Uploader",
    size: 140,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">{row.original.uploaded_by ?? "—"}</span>
    ),
  })

  cols.push(
    {
      accessorKey: "created_date",
      header: "Created",
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatRelative(row.original.created_date)}
        </span>
      ),
    },
    {
      accessorKey: "processing_state",
      header: "Status",
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
      header: "Assignee",
      size: 180,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.assignee ?? "—"}</span>
      ),
    },
  )

  return cols
}
