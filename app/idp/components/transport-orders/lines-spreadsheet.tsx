"use client"

import type {
  Invoice,
  InvoiceLine,
  InvoiceLineUpdateRequest,
  UpdateInvoiceLinesRequest,
} from "@cortex/types"
import { Button, Input } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { Loader2, RotateCcw, Save } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"

type RowValues = {
  line_number: string
  po_number: string
  product_code: string
  description: string
  cn_code: string
  hs: string
  quantity: string
  unit_of_measure: string
  invoice_value: string
  net_weight_kg: string
  gross_weight_kg: string
  packages_quantity: string
  packages_type: string
  packages_marking: string
  origin_country: string
}

const COLUMNS: Array<{ key: keyof RowValues; label: string; width: string; uppercase?: boolean }> = [
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

function lineToRow(line: InvoiceLine): RowValues {
  return {
    line_number: line.line_number ?? "",
    po_number: line.po_number ?? "",
    product_code: line.product_code ?? "",
    description: line.description ?? "",
    cn_code: line.cn_code ?? "",
    hs: line.hs ?? "",
    quantity: line.quantity ?? "",
    unit_of_measure: line.unit_of_measure ?? "",
    invoice_value: line.invoice_value ?? "",
    net_weight_kg: line.net_weight_kg ?? "",
    gross_weight_kg: line.gross_weight_kg ?? "",
    packages_quantity: line.packages_quantity ?? "",
    packages_type: line.packages_type ?? "",
    packages_marking: line.packages_marking ?? "",
    origin_country: line.origin_country ?? "",
  }
}

function rowToRequest(id: string, v: RowValues): InvoiceLineUpdateRequest {
  const pick = (s: string): string | null => (s.trim() ? s.trim() : null)
  return {
    line_id: id,
    line_number: pick(v.line_number),
    po_number: pick(v.po_number),
    product_code: pick(v.product_code),
    description: pick(v.description),
    cn_code: pick(v.cn_code),
    hs: pick(v.hs),
    quantity: pick(v.quantity),
    unit_of_measure: pick(v.unit_of_measure),
    invoice_value: pick(v.invoice_value),
    net_weight_kg: pick(v.net_weight_kg),
    gross_weight_kg: pick(v.gross_weight_kg),
    packages_quantity: pick(v.packages_quantity),
    packages_type: pick(v.packages_type),
    packages_marking: pick(v.packages_marking),
    origin_country: pick(v.origin_country),
  }
}

interface Props {
  invoice: Invoice
  canEdit: boolean
  isSaving: boolean
  onSave: (body: UpdateInvoiceLinesRequest) => Promise<void>
}

export function LinesSpreadsheet({ invoice, canEdit, isSaving, onSave }: Props) {
  const initial = useMemo(() => {
    const map: Record<string, RowValues> = {}
    for (const l of invoice.lines) map[l.id] = lineToRow(l)
    return map
  }, [invoice.lines])

  const [values, setValues] = useState<Record<string, RowValues>>(initial)
  useEffect(() => setValues(initial), [initial])

  const selectLineRefs = useSourceMaterialSelectionStore((s) => s.selectLineRefs)

  const dirty = useMemo(
    () =>
      invoice.lines.some((l) => {
        const current = values[l.id]
        const origin = initial[l.id]
        if (!current || !origin) return false
        return (Object.keys(origin) as Array<keyof RowValues>).some(
          (k) => current[k] !== origin[k],
        )
      }),
    [values, initial, invoice.lines],
  )

  const setCell = (rowId: string, key: keyof RowValues, value: string) => {
    setValues((prev) => {
      const row = prev[rowId]
      if (!row) return prev
      return { ...prev, [rowId]: { ...row, [key]: value } }
    })
  }

  const handleSave = async () => {
    const body: UpdateInvoiceLinesRequest = {
      lines: invoice.lines.map((l) => {
        const v = values[l.id] ?? lineToRow(l)
        return rowToRequest(l.id, v)
      }),
    }
    await onSave(body)
  }

  const handleReset = () => setValues(initial)

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
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "border-b border-border px-2 py-1.5 text-left font-medium uppercase tracking-wide text-muted-foreground",
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
              const row = values[line.id] ?? lineToRow(line)
              const onFocusRow = () => selectLineRefs(line.source_references)
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
                        onFocus={onFocusRow}
                        readOnly={!canEdit}
                        disabled={!canEdit}
                        className="h-8 rounded-none border-0 bg-transparent px-2 font-mono text-xs shadow-none focus-visible:ring-1"
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
