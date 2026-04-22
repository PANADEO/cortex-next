"use client"

import type { Invoice, UpdateInvoiceLinesRequest } from "@cortex/types"
import { Button, Input } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"
import {
  invoiceLineRowToRequest,
  invoiceLineToRow,
  type InvoiceLineRow,
} from "./invoice-line-row"

const COLUMNS: Array<{
  key: keyof InvoiceLineRow
  label: string
  width: string
  uppercase?: boolean
}> = [
  { key: "line_number", label: "#", width: "w-12" },
  { key: "po_number", label: "PO", width: "w-28" },
  { key: "product_code", label: "Product", width: "w-28" },
  { key: "description", label: "Description", width: "min-w-[16rem] flex-1" },
  { key: "cn_code", label: "CN", width: "w-28" },
  { key: "hs", label: "HS", width: "w-24" },
  { key: "quantity", label: "Qty", width: "w-20" },
  { key: "unit_of_measure", label: "UoM", width: "w-16" },
  { key: "invoice_value", label: "Value", width: "w-24" },
  { key: "net_weight_kg", label: "Net kg", width: "w-24" },
  { key: "gross_weight_kg", label: "Gross kg", width: "w-24" },
  { key: "packages_quantity", label: "Pkg qty", width: "w-20" },
  { key: "packages_type", label: "Pkg type", width: "w-24" },
  { key: "packages_marking", label: "Pkg mark", width: "w-28" },
  { key: "origin_country", label: "Origin", width: "w-20", uppercase: true },
]

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
  const initialRef = useRef(initial)

  // Reset only when the invoice identity or the set of line ids changes; a
  // polling refetch that returns a new-but-equal array must not clobber edits.
  const lineIdsKey = useMemo(
    () => invoice.lines.map((l) => l.id).join("|"),
    [invoice.lines],
  )
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

  // Captured ref avoids stale-closure issues from the setter.
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
        <table className="w-full border-collapse text-[11px]">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "border-b border-border px-1.5 py-1 text-left text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
                    c.width,
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => {
              const row = values[line.id] ?? invoiceLineToRow(line)
              return (
                <tr key={line.id} className="border-b border-border/50 hover:bg-muted/30">
                  {COLUMNS.map((c) => (
                    <td key={c.key} className={cn("align-top", c.width)}>
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
                        className="h-7 rounded-none border-0 bg-transparent px-1.5 font-mono text-[11px] shadow-none focus-visible:ring-1"
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
