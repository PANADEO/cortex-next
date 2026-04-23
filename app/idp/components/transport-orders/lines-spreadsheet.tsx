"use client"

import type { Invoice, UpdateInvoiceLinesRequest } from "@cortex/types"
import { Button, Input } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { LucideIcon } from "lucide-react"
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, RotateCcw, Save } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"
import {
  invoiceLineRowToRequest,
  invoiceLineToRow,
  type InvoiceLineRow,
} from "./invoice-line-row"

interface ColumnDef {
  key: keyof InvoiceLineRow
  label: string
  width: number
  uppercase?: boolean
  numeric?: boolean
}

const COLUMNS: ColumnDef[] = [
  { key: "line_number", label: "#", width: 48, numeric: true },
  { key: "po_number", label: "PO", width: 112 },
  { key: "product_code", label: "Product", width: 112 },
  { key: "description", label: "Description", width: 320 },
  { key: "cn_code", label: "CN", width: 112 },
  { key: "hs", label: "HS", width: 96 },
  { key: "quantity", label: "Qty", width: 80, numeric: true },
  { key: "unit_of_measure", label: "UoM", width: 64 },
  { key: "invoice_value", label: "Value", width: 96, numeric: true },
  { key: "net_weight_kg", label: "Net kg", width: 96, numeric: true },
  { key: "gross_weight_kg", label: "Gross kg", width: 96, numeric: true },
  { key: "packages_quantity", label: "Pkg qty", width: 80, numeric: true },
  { key: "packages_type", label: "Pkg type", width: 96 },
  { key: "packages_marking", label: "Pkg mark", width: 112 },
  { key: "origin_country", label: "Origin", width: 80, uppercase: true },
]

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
}

export function LinesSpreadsheet({ invoice, canEdit, isSaving, onSave }: Props) {
  const initial = useMemo(() => {
    const map: Record<string, InvoiceLineRow> = {}
    for (const l of invoice.lines) map[l.id] = invoiceLineToRow(l)
    return map
  }, [invoice.lines])

  const [values, setValues] = useState<Record<string, InvoiceLineRow>>(initial)
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set())
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map((c) => [c.key, c.width])),
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

  const lineIdsKey = useMemo(
    () => invoice.lines.map((l) => l.id).join("|"),
    [invoice.lines],
  )
  // Reset only when invoice identity or its line set changes — a polling
  // refetch that returns equal-but-new arrays must not clobber user edits.
  useEffect(() => {
    initialRef.current = initial
    setValues(initial)
    setDirtyIds(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id, lineIdsKey])

  const selectLineRefs = useSourceMaterialSelectionStore((s) => s.selectLineRefs)

  const dirty = dirtyIds.size > 0

  const setCell = useCallback(
    (rowId: string, key: keyof InvoiceLineRow, value: string) => {
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
    },
    [],
  )

  // Ref keeps rowHasOtherDirtyFields out of setCell's dep array.
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
    for (const col of COLUMNS) {
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
        const row = values[l.id] ?? invoiceLineToRow(l)
        return invoiceLineRowToRequest(l.id, row)
      }),
    }
    await onSave(body)
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

  const sortedLines = useMemo(() => {
    if (!sort) return invoice.lines
    const col = COLUMNS.find((c) => c.key === sort.key)
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
  }, [invoice.lines, values, initial, sort])

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
        {canEdit ? (
          <div className="flex gap-2">
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
          </div>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-[9px]" style={{ tableLayout: "fixed" }}>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} style={{ width: `${widths[c.key] ?? c.width}px` }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr>
              {COLUMNS.map((c) => {
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
                        className={cn(
                          "h-3 w-3 shrink-0",
                          sortActive ? "opacity-80" : "opacity-30",
                        )}
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
              const row = values[line.id] ?? invoiceLineToRow(line)
              return (
                <tr key={line.id} className="border-b border-border/50 hover:bg-muted/30">
                  {COLUMNS.map((c) => (
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
