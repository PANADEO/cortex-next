"use client"

import { cn } from "@cortex/utils"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Skeleton } from "./ui/skeleton"

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  isLoading?: boolean
  emptyState?: ReactNode
  /**
   * @deprecated Robi cały `<tr>` klikalny — łamie regułę "Listy: row-actions,
   * nie klik-w-wiersz" z `.claude/skills/code-ui/SKILL.md`. Zachowane wyłącznie
   * dla dzisiejszych konsumentów tego propa; nie używaj w nowym kodzie —
   * zamiast tego dedykowana kolumna akcji (ostatnia, `text-right`,
   * `Button size="icon" variant="ghost"`). Nowe listy z akcjami w wierszu
   * powinny w ogóle używać `CortexDataGrid`, nie `DataTable`.
   */
  onRowClick?: (row: TData) => void
  getRowClassName?: (row: TData) => string | undefined
  className?: string
  tableClassName?: string
  getRowId?: (row: TData, index: number) => string
  skeletonRows?: number
  stickyHeader?: boolean
  /** Wrap the table in a bordered card. Default false — table bleeds into surrounding page. */
  bordered?: boolean
}

export function DataTable<TData>({
  columns,
  data,
  isLoading,
  emptyState,
  onRowClick,
  getRowClassName,
  className,
  tableClassName,
  getRowId,
  skeletonRows = 5,
  stickyHeader = false,
  bordered = false,
}: DataTableProps<TData>) {
  const { t } = useTranslation("common")
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...(getRowId ? { getRowId } : {}),
  })

  return (
    <div
      className={cn(
        "overflow-x-auto [contain:layout_paint]",
        bordered && "rounded-lg border border-border bg-card",
        className,
      )}
    >
      <table className={cn("w-full text-sm", tableClassName)}>
        <thead
          className={cn(stickyHeader ? "sticky top-0 z-10 bg-muted shadow-sm" : "bg-muted/40")}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="h-10 whitespace-nowrap px-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  style={{ width: header.column.columnDef.size }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <tr key={`sk-${i}`} className="border-b border-border last:border-b-0">
                {columns.map((_col, j) => (
                  <td key={`sk-cell-${i}-${j}`} className="h-12 px-4">
                    <Skeleton className="h-4 w-3/4" />
                  </td>
                ))}
              </tr>
            ))
          ) : table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row: Row<TData>) => (
              <tr
                key={row.id}
                className={cn(
                  "border-b border-border transition-colors last:border-b-0",
                  onRowClick && "cursor-pointer hover:bg-muted/50",
                  getRowClassName?.(row.original),
                )}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="p-0">
                {emptyState ?? (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    {t("state.empty")}
                  </div>
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
