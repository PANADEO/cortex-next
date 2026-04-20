"use client"

import type {
  Invoice,
  InvoiceLine,
  InvoiceLineUpdateRequest,
  UpdateInvoiceLinesRequest,
} from "@cortex/types"
import {
  Button,
  DataTable,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@cortex/ui"
import { formatMoney } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"

const numericString = z
  .string()
  .regex(/^$|^-?\d+(\.\d+)?$/, "Must be numeric (decimal with dot)")

const lineSchema = z.object({
  line_number: z.string().max(16),
  po_number: z.string().max(64),
  product_code: z.string().max(64),
  description: z.string().max(500),
  cn_code: z.string().max(16),
  hs: z.string().max(16),
  quantity: numericString,
  unit_of_measure: z.string().max(16),
  invoice_value: numericString,
  net_weight_kg: numericString,
  gross_weight_kg: numericString,
  packages_quantity: numericString,
  packages_type: z.string().max(32),
  packages_marking: z.string().max(100),
  origin_country: z
    .string()
    .max(3)
    .regex(/^[A-Za-z]{0,3}$/, "ISO country code"),
})

type LineValues = z.infer<typeof lineSchema>

const LINE_FIELDS: readonly FieldSpec<LineValues>[] = [
  { name: "line_number", label: "Line #", span: 1 },
  { name: "po_number", label: "PO number", span: 1 },
  { name: "product_code", label: "Product code", span: 1 },
  { name: "cn_code", label: "CN code", span: 1 },
  { name: "hs", label: "HS code", span: 1 },
  { name: "origin_country", label: "Origin", span: 1, uppercase: true },
  { name: "description", label: "Description", span: 2 },
  { name: "quantity", label: "Quantity", span: 1 },
  { name: "unit_of_measure", label: "UoM", span: 1 },
  { name: "invoice_value", label: "Invoice value", span: 1 },
  { name: "net_weight_kg", label: "Net weight (kg)", span: 1 },
  { name: "gross_weight_kg", label: "Gross weight (kg)", span: 1 },
  { name: "packages_quantity", label: "Packages qty", span: 1 },
  { name: "packages_type", label: "Packages type", span: 1 },
  { name: "packages_marking", label: "Packages marking", span: 2 },
]

function lineDefaults(line: InvoiceLine): LineValues {
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

function valuesToRequest(id: string, values: LineValues): InvoiceLineUpdateRequest {
  const entries = Object.entries(values).map(([k, v]) => [k, v.trim() ? v.trim() : null])
  const base = Object.fromEntries(entries) as Omit<InvoiceLineUpdateRequest, "line_id" | "hs">
  return { line_id: id, ...base }
}

interface Props {
  invoice: Invoice
  currency: string | null
  canEdit: boolean
  isSaving: boolean
  onSaveLines: (body: UpdateInvoiceLinesRequest) => Promise<void>
  onSelectLine?: (line: InvoiceLine) => void
}

export function InvoiceLinesGrid({
  invoice,
  currency,
  canEdit,
  isSaving,
  onSaveLines,
  onSelectLine,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editingLine = invoice.lines.find((l) => l.id === editingId) ?? null

  const columns: ColumnDef<InvoiceLine, unknown>[] = [
    {
      id: "line_number",
      header: "#",
      size: 56,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.line_number ?? "—"}</span>
      ),
    },
    {
      id: "product",
      header: "Product",
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <div className="truncate font-medium">{row.original.description ?? "—"}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {row.original.product_code ?? ""}
          </div>
        </div>
      ),
    },
    {
      id: "cn_code",
      header: "CN",
      size: 110,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.cn_code ?? "—"}</span>
      ),
    },
    {
      id: "quantity",
      header: "Qty",
      size: 100,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {row.original.quantity ?? "—"}
          {row.original.unit_of_measure ? ` ${row.original.unit_of_measure}` : ""}
        </span>
      ),
    },
    {
      id: "net_weight_kg",
      header: "Net kg",
      size: 90,
      cell: ({ row }) => (
        <span className="font-mono text-xs">{row.original.net_weight_kg ?? "—"}</span>
      ),
    },
    {
      id: "invoice_value",
      header: "Value",
      size: 120,
      cell: ({ row }) => (
        <span className="font-mono text-xs">
          {formatMoney(row.original.invoice_value, currency ? { currency } : {})}
        </span>
      ),
    },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            size: 56,
            cell: ({ row }: { row: { original: InvoiceLine } }) => (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit line"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingId(row.original.id)
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            ),
          } satisfies ColumnDef<InvoiceLine, unknown>,
        ]
      : []),
  ]

  const handleSaveLine = async (values: LineValues): Promise<void> => {
    if (!editingLine) return
    const updatedLine: InvoiceLineUpdateRequest = valuesToRequest(editingLine.id, values)
    const lines: InvoiceLineUpdateRequest[] = invoice.lines.map((l) =>
      l.id === editingLine.id ? updatedLine : valuesToRequest(l.id, lineDefaults(l)),
    )
    await onSaveLines({ lines })
    setEditingId(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Lines ({invoice.lines.length})</h4>
      </div>
      <DataTable
        columns={columns}
        data={invoice.lines}
        bordered
        getRowId={(row) => row.id}
        {...(onSelectLine ? { onRowClick: onSelectLine } : {})}
        emptyState={
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            No invoice lines extracted.
          </div>
        }
      />
      <Sheet open={Boolean(editingLine)} onOpenChange={(o) => !o && setEditingId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Edit line {editingLine?.line_number ?? ""}</SheetTitle>
            <SheetDescription>
              Changes are submitted with the entire invoice line list.
            </SheetDescription>
          </SheetHeader>
          {editingLine ? (
            <div className="mt-4">
              <FieldsForm
                label=""
                fields={LINE_FIELDS}
                defaults={lineDefaults(editingLine)}
                schema={lineSchema}
                canEdit={canEdit}
                isSaving={isSaving}
                onSave={handleSaveLine}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
