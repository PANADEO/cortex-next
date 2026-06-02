"use client"

import { countryCodeSchema, numericStringSchema } from "@/lib/form-helpers"
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
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil } from "lucide-react"
import { useMemo, useState } from "react"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"
import { invoiceLineRowToRequest, invoiceLineToRow, type InvoiceLineRow } from "./invoice-line-row"

const lineSchema = z.object({
  line_number: z.string().max(16),
  po_number: z.string().max(64),
  product_code: z.string().max(64),
  description: z.string().max(500),
  cn_code: z.string().max(16),
  hs: z.string().max(16),
  quantity: numericStringSchema,
  unit_of_measure: z.string().max(16),
  invoice_value: numericStringSchema,
  net_weight_kg: numericStringSchema,
  gross_weight_kg: numericStringSchema,
  packages_quantity: numericStringSchema,
  packages_type: z.string().max(32),
  packages_marking: z.string().max(100),
  origin_country: countryCodeSchema,
  preference_code: z.string().max(8),
  atr_documents: z.string().max(2000),
}) satisfies z.ZodType<InvoiceLineRow>

const LINE_FIELDS: readonly FieldSpec<InvoiceLineRow>[] = [
  { name: "line_number", label: "Line #", span: 1 },
  { name: "po_number", label: "PO number", span: 1 },
  { name: "product_code", label: "Product code", span: 1 },
  { name: "cn_code", label: "CN code", span: 1 },
  { name: "hs", label: "HS code", span: 1 },
  { name: "origin_country", label: "Origin", span: 1, uppercase: true },
  { name: "preference_code", label: "Pref.", span: 1 },
  { name: "description", label: "Description", span: 2 },
  { name: "quantity", label: "Quantity", span: 1 },
  { name: "unit_of_measure", label: "UoM", span: 1 },
  { name: "invoice_value", label: "Invoice value", span: 1 },
  { name: "net_weight_kg", label: "Net weight (kg)", span: 1 },
  { name: "gross_weight_kg", label: "Gross weight (kg)", span: 1 },
  { name: "packages_quantity", label: "Packages qty", span: 1 },
  { name: "packages_type", label: "Packages type", span: 1 },
  { name: "packages_marking", label: "Packages marking", span: 2 },
  { name: "atr_documents", label: "ATR documents", span: 2 },
]

const CUSTOMS_CODE_LINE_FIELDS: readonly FieldSpec<InvoiceLineRow>[] = [
  { name: "line_number", label: "Line #", span: 1 },
  { name: "po_number", label: "PO number", span: 1 },
  { name: "product_code", label: "Product code", span: 1 },
  { name: "cn_code", label: "Customs Code", span: 1 },
  { name: "origin_country", label: "Origin", span: 1, uppercase: true },
  { name: "preference_code", label: "Pref.", span: 1 },
  { name: "description", label: "Description", span: 2 },
  { name: "quantity", label: "Quantity", span: 1 },
  { name: "unit_of_measure", label: "UoM", span: 1 },
  { name: "invoice_value", label: "Invoice value", span: 1 },
  { name: "net_weight_kg", label: "Net weight (kg)", span: 1 },
  { name: "gross_weight_kg", label: "Gross weight (kg)", span: 1 },
  { name: "packages_quantity", label: "Packages qty", span: 1 },
  { name: "packages_type", label: "Packages type", span: 1 },
  { name: "packages_marking", label: "Packages marking", span: 2 },
  { name: "atr_documents", label: "ATR documents", span: 2 },
]

interface Props {
  invoice: Invoice
  canEdit: boolean
  isSaving: boolean
  onSaveLines: (body: UpdateInvoiceLinesRequest) => Promise<void>
  onSelectLine?: (line: InvoiceLine) => void
  useCustomsCode?: boolean
}

function displayCustomsCode(line: InvoiceLine): string {
  return line.cn_code || line.hs || "—"
}

export function InvoiceLinesGrid({
  invoice,
  canEdit,
  isSaving,
  onSaveLines,
  onSelectLine,
  useCustomsCode = false,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editingLine = invoice.lines.find((l) => l.id === editingId) ?? null

  const columns = useMemo<ColumnDef<InvoiceLine, unknown>[]>(() => {
    const codeColumns: ColumnDef<InvoiceLine, unknown>[] = useCustomsCode
      ? [
          {
            id: "customs_code",
            header: "Customs Code",
            size: 132,
            cell: ({ row }) => (
              <span className="font-mono text-xs">{displayCustomsCode(row.original)}</span>
            ),
          },
        ]
      : [
          {
            id: "cn_code",
            header: "CN Code",
            size: 110,
            cell: ({ row }) => (
              <span className="font-mono text-xs">{row.original.cn_code ?? "—"}</span>
            ),
          },
          {
            id: "hs",
            header: "HS Code",
            size: 110,
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.hs ?? "—"}</span>,
          },
        ]
    const base: ColumnDef<InvoiceLine, unknown>[] = [
      {
        id: "line_number",
        header: "#",
        size: 56,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.line_number ?? "—"}</span>
        ),
      },
      {
        id: "po_number",
        header: "PO Number",
        size: 150,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.po_number ?? "—"}</span>
        ),
      },
      {
        id: "product_code",
        header: "Product Code",
        size: 160,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.product_code ?? "—"}</span>
        ),
      },
      {
        id: "description",
        header: "Description",
        size: 240,
        cell: ({ row }) => (
          <span className="block truncate text-xs">{row.original.description ?? "—"}</span>
        ),
      },
      ...codeColumns,
      {
        id: "preference_code",
        header: "Pref.",
        size: 72,
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.sad_override?.preference_code ?? "—"}
          </span>
        ),
      },
      {
        id: "atr_documents",
        header: "ATR",
        size: 220,
        cell: ({ row }) => {
          const documents = row.original.sad_override?.atr_documents ?? []
          const label = documents
            .map((document) =>
              [document.document_code || "N018", document.document_number, document.quantity]
                .filter(Boolean)
                .join(" / "),
            )
            .join("; ")
          return <span className="block truncate font-mono text-xs">{label || "—"}</span>
        },
      },
      {
        id: "quantity",
        header: "Qty",
        size: 90,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.quantity ?? "—"}</span>
        ),
      },
      {
        id: "unit_of_measure",
        header: "UoM",
        size: 80,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.unit_of_measure ?? "—"}</span>
        ),
      },
      {
        id: "invoice_value",
        header: "Value",
        size: 120,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.invoice_value ?? "—"}</span>
        ),
      },
      {
        id: "net_weight_kg",
        header: "Net Wt (kg)",
        size: 130,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.net_weight_kg ?? "—"}</span>
        ),
      },
      {
        id: "gross_weight_kg",
        header: "Gross Wt (kg)",
        size: 140,
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.gross_weight_kg ?? "—"}</span>
        ),
      },
      {
        id: "origin_country",
        header: "Origin",
        size: 90,
        cell: ({ row }) => (
          <span className="font-mono text-xs uppercase">{row.original.origin_country ?? "—"}</span>
        ),
      },
    ]
    if (!canEdit) return base
    return [
      ...base,
      {
        id: "actions",
        header: "",
        size: 56,
        cell: ({ row }) => (
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
      },
    ]
  }, [canEdit, useCustomsCode])

  const handleSaveLine = async (values: InvoiceLineRow): Promise<void> => {
    if (!editingLine) return
    const lines: InvoiceLineUpdateRequest[] = invoice.lines.map((l) =>
      l.id === editingLine.id
        ? invoiceLineRowToRequest(l.id, values, l, { useCustomsCode })
        : invoiceLineRowToRequest(l.id, invoiceLineToRow(l, { useCustomsCode }), l, {
            useCustomsCode,
          }),
    )
    await onSaveLines({ lines })
    setEditingId(null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Invoice Lines</h4>
      </div>
      <DataTable
        columns={columns}
        data={invoice.lines}
        bordered
        className="overflow-x-auto [&_table]:min-w-[1760px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-normal [&_th]:text-foreground"
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
                fields={useCustomsCode ? CUSTOMS_CODE_LINE_FIELDS : LINE_FIELDS}
                defaults={invoiceLineToRow(editingLine, { useCustomsCode })}
                schema={lineSchema}
                canEdit={canEdit}
                isSaving={isSaving}
                resetKey={editingLine.id}
                onSave={handleSaveLine}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
