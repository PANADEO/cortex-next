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
import { InvoiceLineColumnsDialog, useVisibleInvoiceLineColumns } from "./invoice-line-columns"
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

const ATR_FIELD_NAMES = new Set<keyof InvoiceLineRow>(["preference_code", "atr_documents"])

function filterAtrFields(fields: readonly FieldSpec<InvoiceLineRow>[], showAtrProcessing: boolean) {
  return showAtrProcessing ? fields : fields.filter((field) => !ATR_FIELD_NAMES.has(field.name))
}

interface Props {
  invoice: Invoice
  canEdit: boolean
  isSaving: boolean
  onSaveLines: (body: UpdateInvoiceLinesRequest) => Promise<void>
  onSelectLine?: (line: InvoiceLine) => void
  useCustomsCode?: boolean
  showAtrProcessing?: boolean
}

function displayCustomsCode(line: InvoiceLine): string {
  return line.cn_code || line.hs || "—"
}

function displayLineValue(line: InvoiceLine, key: keyof InvoiceLineRow): string {
  if (key === "preference_code") return line.sad_override?.preference_code ?? "—"
  if (key === "atr_documents") {
    const documents = line.sad_override?.atr_documents ?? []
    return (
      documents
        .map((document) =>
          [document.document_code || "N018", document.document_number, document.quantity]
            .filter(Boolean)
            .join(" / "),
        )
        .join("; ") || "—"
    )
  }
  return line[key] ?? "—"
}

export function InvoiceLinesGrid({
  invoice,
  canEdit,
  isSaving,
  onSaveLines,
  onSelectLine,
  useCustomsCode = false,
  showAtrProcessing = true,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const editingLine = invoice.lines.find((l) => l.id === editingId) ?? null
  const { columns: visibleLineColumns } = useVisibleInvoiceLineColumns(showAtrProcessing)
  const lineFields = useMemo(
    () =>
      filterAtrFields(useCustomsCode ? CUSTOMS_CODE_LINE_FIELDS : LINE_FIELDS, showAtrProcessing),
    [showAtrProcessing, useCustomsCode],
  )

  const columns = useMemo<ColumnDef<InvoiceLine, unknown>[]>(() => {
    const base = visibleLineColumns.flatMap<ColumnDef<InvoiceLine, unknown>>((column) => {
      if (column.key === "customs_code") {
        if (useCustomsCode) {
          return [
            {
              id: "customs_code",
              header: column.gridLabel,
              size: column.width,
              cell: ({ row }) => (
                <span className="font-mono text-xs">{displayCustomsCode(row.original)}</span>
              ),
            },
          ]
        }
        return [
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
      }
      const key = column.key as keyof InvoiceLineRow
      return [
        {
          id: key,
          header: column.gridLabel,
          size: column.width,
          cell: ({ row }) => {
            const isDescription = key === "description"
            return (
              <span
                className={
                  isDescription ? "block truncate text-xs" : "block truncate font-mono text-xs"
                }
              >
                {displayLineValue(row.original, key)}
              </span>
            )
          },
        },
      ]
    })
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
  }, [canEdit, useCustomsCode, visibleLineColumns])

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
        <InvoiceLineColumnsDialog showAtrColumns={showAtrProcessing} />
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
                fields={lineFields}
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
