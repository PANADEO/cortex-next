"use client"

import type { PackageReadModel } from "@cortex/types"
import { Checkbox, PackageStatusBadges } from "@cortex/ui"
import { formatRelative } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

export interface PackageColumnsOptions {
  includeId?: boolean
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
  const { includeId = false, selection } = options
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
          aria-label={`Select ${row.original.file_name}`}
        />
      ),
    })
  }

  cols.push({
    accessorKey: "file_name",
    header: "File",
    cell: ({ row }) => (
      <Link
        href={`/idp/packages/${row.original.id}`}
        className="font-mono text-xs hover:underline"
      >
        {row.original.file_name}
      </Link>
    ),
  })

  if (includeId) {
    cols.push({
      accessorKey: "id",
      header: "ID",
      size: 140,
      cell: ({ row }) => (
        <span className="font-mono text-[10px] text-muted-foreground">{row.original.id}</span>
      ),
    })
  }

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
        <span className="text-xs text-muted-foreground">
          {row.original.assignee ?? "—"}
        </span>
      ),
    },
  )

  return cols
}
