"use client"

import { downloadBlob } from "@/lib/download"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"
import type { Invoice, UpdateInvoiceLinesRequest } from "@cortex/types"
import { Button, Input } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { ArrowDown, ArrowUp, ArrowUpDown, Download, Loader2, RotateCcw, Save } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  getAvailableInvoiceLineColumns,
  InvoiceLineColumnsDialog,
  useVisibleInvoiceLineColumns,
  type InvoiceLineColumnConfig,
} from "./invoice-line-columns"
import {
  buildInvoiceLinesCsv,
  buildInvoiceLinesCsvFileName,
  INVOICE_LINES_CSV_MIME,
} from "./invoice-line-csv"
import { invoiceLineRowToRequest, invoiceLineToRow, type InvoiceLineRow } from "./invoice-line-row"

interface SpreadsheetColumnDef {
  key: keyof InvoiceLineRow
  label: string
  width: number
  uppercase?: boolean
  numeric?: boolean
}

function buildSpreadsheetColumns(
  columns: readonly InvoiceLineColumnConfig[],
  useCustomsCode: boolean,
): SpreadsheetColumnDef[] {
  return columns.flatMap<SpreadsheetColumnDef>((column) => {
    if (column.key === "customs_code") {
      return useCustomsCode
        ? [
            {
              key: "cn_code",
              label: column.spreadsheetLabel,
              width: column.width,
            },
          ]
        : [
            { key: "cn_code", label: "CN", width: 112 },
            { key: "hs", label: "HS", width: 96 },
          ]
    }
    const key = column.key as keyof InvoiceLineRow
    const next: SpreadsheetColumnDef = {
      key,
      label: column.spreadsheetLabel,
      width: column.width,
    }
    if (column.uppercase !== undefined) next.uppercase = column.uppercase
    if (column.numeric !== undefined) next.numeric = column.numeric
    return [next]
  })
}

const MIN_COLUMN_WIDTH = 48

type SortDirection = "asc" | "desc"

interface SortState {
  key: keyof InvoiceLineRow
  direction: SortDirection
}

const SORT_ICONS: Record<SortDirection | "none", LucideIcon> = {
  none: ArrowUpDown,
  asc: ArrowUp,
  desc: ArrowDown,
}

interface Props {
  invoice: Invoice
  canEdit: boolean
  isSaving: boolean
  onSave: (body: UpdateInvoiceLinesRequest) => Promise<void>
  useCustomsCode?: boolean
  showAtrProcessing?: boolean
}

export function LinesSpreadsheet({
  invoice,
  canEdit,
  isSaving,
  onSave,
  useCustomsCode = false,
  showAtrProcessing = true,
}: Props) {
  const { columns: visibleLineColumns } = useVisibleInvoiceLineColumns(showAtrProcessing)
  const availableLineColumns = useMemo(
    () => getAvailableInvoiceLineColumns(showAtrProcessing),
    [showAtrProcessing],
  )
  const allColumns = useMemo(
    () => buildSpreadsheetColumns(availableLineColumns, useCustomsCode),
    [availableLineColumns, useCustomsCode],
  )
  const columns = useMemo(
    () => buildSpreadsheetColumns(visibleLineColumns, useCustomsCode),
    [useCustomsCode, visibleLineColumns],
  )
  const initial = useMemo(() => {
    const map: Record<string, InvoiceLineRow> = {}
    for (const l of invoice.lines) map[l.id] = invoiceLineToRow(l, { useCustomsCode })
    return map
  }, [invoice.lines, useCustomsCode])

  const [values, setValues] = useState<Record<string, InvoiceLineRow>>(initial)
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set())
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.map((c) => [c.key, c.width])),
  )
  const [sort, setSort] = useState<SortState | null>(null)
  const [resizingKey, setResizingKey] = useState<keyof InvoiceLineRow | null>(null)
  const initialRef = useRef(initial)
  const resizeRef = useRef<{
    key: keyof InvoiceLineRow
    startX: number
    startWidth: number
  } | null>(null)
  // Holds teardown for active drag so we can reverse body styles and remove
  // document listeners if the component unmounts mid-drag.
  const resizeDisposerRef = useRef<(() => void) | null>(null)

  useEffect(() => () => resizeDisposerRef.current?.(), [])

  useEffect(() => {
    setWidths((prev) => ({
      ...Object.fromEntries(columns.map((c) => [c.key, c.width])),
      ...prev,
    }))
  }, [columns])

  useEffect(() => {
    if (sort && !columns.some((c) => c.key === sort.key)) setSort(null)
  }, [columns, sort])

  const lineIdsKey = useMemo(() => invoice.lines.map((l) => l.id).join("|"), [invoice.lines])
  // Reset only when invoice identity, its line set, or the visible code mode changes —
  // a polling refetch that returns equal-but-new arrays must not clobber user edits.
  useEffect(() => {
    initialRef.current = initial
    setValues(initial)
    setDirtyIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id, lineIdsKey, useCustomsCode, showAtrProcessing])

  const selectLineRefs = useSourceMaterialSelectionStore((s) => s.selectLineRefs)

  const dirty = dirtyIds.size > 0

  const setCell = (rowId: string, key: keyof InvoiceLineRow, value: string) => {
    setValues((prev) => {
      const row = prev[rowId]
      if (!row || row[key] === value) return prev
      return { ...prev, [rowId]: { ...row, [key]: value } }
    })
    setDirtyIds((prev) => {
      const originRow = initialRef.current[rowId]
      if (!originRow) return prev
      const rowNowDirty = value !== originRow[key] || rowHasOtherDirtyFields(rowId, key, value)
      if (rowNowDirty && prev.has(rowId)) return prev
      if (!rowNowDirty && !prev.has(rowId)) return prev
      const next = new Set(prev)
      if (rowNowDirty) next.add(rowId)
      else next.delete(rowId)
      return next
    })
  }

  const valuesRef = useRef(values)
  valuesRef.current = values
  function rowHasOtherDirtyFields(
    rowId: string,
    changedKey: keyof InvoiceLineRow,
    changedValue: string,
  ): boolean {
    const current = valuesRef.current[rowId]
    const origin = initialRef.current[rowId]
    if (!current || !origin) return false
    for (const col of allColumns) {
      if (col.key === changedKey) {
        if (changedValue !== origin[col.key]) return true
      } else if (current[col.key] !== origin[col.key]) {
        return true
      }
    }
    return false
  }

  const handleSave = async () => {
    const body: UpdateInvoiceLinesRequest = {
      lines: invoice.lines.map((l) => {
        const row = values[l.id] ?? invoiceLineToRow(l, { useCustomsCode })
        return invoiceLineRowToRequest(l.id, row, l, { useCustomsCode })
      }),
    }
    await onSave(body)
    const snapshot: Record<string, InvoiceLineRow> = {}
    for (const [id, row] of Object.entries(values)) snapshot[id] = { ...row }
    initialRef.current = snapshot
    setDirtyIds(new Set())
  }

  const handleReset = () => {
    setValues(initialRef.current)
    setDirtyIds(new Set())
  }

  const toggleSort = (key: keyof InvoiceLineRow) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" }
      if (prev.direction === "asc") return { key, direction: "desc" }
      return null
    })
  }

  const startResize = (event: React.MouseEvent, key: keyof InvoiceLineRow) => {
    event.preventDefault()
    event.stopPropagation()
    resizeRef.current = {
      key,
      startX: event.clientX,
      startWidth: widths[key] ?? MIN_COLUMN_WIDTH,
    }
    setResizingKey(key)
    const onMove = (e: MouseEvent) => {
      const state = resizeRef.current
      if (!state) return
      const next = Math.max(MIN_COLUMN_WIDTH, state.startWidth + (e.clientX - state.startX))
      setWidths((prev) => (prev[state.key] === next ? prev : { ...prev, [state.key]: next }))
    }
    const dispose = () => {
      resizeRef.current = null
      resizeDisposerRef.current = null
      setResizingKey(null)
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", dispose)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
    resizeDisposerRef.current = dispose
    document.body.style.userSelect = "none"
    document.body.style.cursor = "col-resize"
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", dispose)
  }

  const totalWidth = useMemo(
    () => columns.reduce((sum, c) => sum + (widths[c.key] ?? c.width), 0),
    [columns, widths],
  )

  const sortedLines = useMemo(() => {
    if (!sort) return invoice.lines
    const col = columns.find((c) => c.key === sort.key)
    const copy = [...invoice.lines]
    copy.sort((a, b) => {
      const av = (values[a.id] ?? initial[a.id])?.[sort.key] ?? ""
      const bv = (values[b.id] ?? initial[b.id])?.[sort.key] ?? ""
      let cmp: number
      if (col?.numeric) {
        const an = parseFloat(av)
        const bn = parseFloat(bv)
        const af = Number.isFinite(an) ? an : Number.POSITIVE_INFINITY
        const bf = Number.isFinite(bn) ? bn : Number.POSITIVE_INFINITY
        cmp = af - bf
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true })
      }
      return sort.direction === "asc" ? cmp : -cmp
    })
    return copy
  }, [invoice.lines, values, initial, columns, sort])

  const handleDownloadCsv = () => {
    const csv = buildInvoiceLinesCsv(sortedLines, {
      columns: visibleLineColumns,
      useCustomsCode,
      label: "spreadsheet",
      rowOverrides: values,
    })
    downloadBlob(
      new Blob([csv], { type: INVOICE_LINES_CSV_MIME }),
      buildInvoiceLinesCsvFileName(invoice),
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">
            Invoice {invoice.invoice_number ?? invoice.id} — {invoice.lines.length} lines
          </h2>
          {dirty ? (
            <p className="text-[10px] uppercase tracking-wide text-warning-foreground">
              Unsaved changes
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={invoice.lines.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            Download CSV
          </Button>
          <InvoiceLineColumnsDialog showAtrColumns={showAtrProcessing} />
          {canEdit ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!dirty || isSaving}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || isSaving}>
                {isSaving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                Save lines
              </Button>
            </>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="border-collapse text-[9px]"
          style={{ tableLayout: "fixed", width: `${totalWidth}px`, minWidth: "100%" }}
        >
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} style={{ width: `${widths[c.key] ?? c.width}px` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr>
              {columns.map((c) => {
                const sortActive = sort?.key === c.key
                const SortIcon = SORT_ICONS[sortActive ? sort!.direction : "none"]
                const isResizing = resizingKey === c.key
                return (
                  <th
                    key={c.key}
                    className="relative border-b border-border p-0 text-left align-middle text-[8px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className={cn(
                        "flex h-full w-full items-center gap-1 truncate py-1 pl-1.5 pr-3 text-left hover:text-foreground",
                        sortActive && "text-foreground",
                      )}
                    >
                      <span className="truncate">{c.label}</span>
                      <SortIcon
                        className={cn("h-3 w-3 shrink-0", sortActive ? "opacity-80" : "opacity-30")}
                      />
                    </button>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(e) => startResize(e, c.key)}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "absolute right-0 top-0 z-20 flex h-full w-2 cursor-col-resize select-none items-center justify-center",
                        "before:block before:h-4 before:w-px before:bg-border before:transition-colors",
                        "hover:before:h-full hover:before:w-0.5 hover:before:bg-primary",
                        isResizing && "before:h-full before:w-0.5 before:bg-primary",
                      )}
                    />
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedLines.map((line) => {
              const row = values[line.id] ?? invoiceLineToRow(line, { useCustomsCode })
              return (
                <tr key={line.id} className="border-b border-border/50 hover:bg-muted/30">
                  {columns.map((c) => (
                    <td key={c.key} className="align-top">
                      <Input
                        value={row[c.key]}
                        onChange={(e) =>
                          setCell(
                            line.id,
                            c.key,
                            c.uppercase ? e.target.value.toUpperCase() : e.target.value,
                          )
                        }
                        onFocus={() => selectLineRefs(line.source_references)}
                        readOnly={!canEdit}
                        disabled={!canEdit}
                        className="h-6 rounded-none border-0 bg-transparent px-1.5 font-mono text-[9px] shadow-none focus-visible:ring-1"
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
