"use client"

import { downloadBlob } from "@/lib/download"
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
import { Download, Pencil } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { z } from "zod"
import { FieldsForm, type FieldSpec } from "./fields-form"
import {
  invoiceLineColumnLabelKey,
  InvoiceLineColumnsDialog,
  useVisibleInvoiceLineColumns,
} from "./invoice-line-columns"
import {
  buildInvoiceLinesCsv,
  buildInvoiceLinesCsvFileName,
  INVOICE_LINES_CSV_MIME,
} from "./invoice-line-csv"
import { invoiceLineRowToRequest, invoiceLineToRow, type InvoiceLineRow } from "./invoice-line-row"

const lineSchema = z.object({
  line_number: z.string().max(16),
  po_number: z.string().max(64),
  product_code: z.string().max(64),
  description: z.string().max(500),
  description_pl: z.string().max(500),
  cn_code: z.string().max(16),
  hs: z.string().max(16),
  quantity: numericStringSchema,
  unit_of_measure: z.string().max(16),
  invoice_value: numericStringSchema,
  net_weight_kg: numericStringSchema,
  gross_weight_kg: numericStringSchema,
  estimated_gross_weight_kg: numericStringSchema,
  packages_quantity: numericStringSchema,
  packages_type: z.string().max(32),
  packages_marking: z.string().max(100),
  origin_country: countryCodeSchema,
  preference_code: z.string().max(8),
  atr_documents: z.string().max(2000),
}) satisfies z.ZodType<InvoiceLineRow>

const COMMON_LINE_FIELDS: readonly FieldSpec<InvoiceLineRow>[] = [
  { name: "origin_country", labelKey: "transportOrders.fields.origin", span: 1, uppercase: true },
  { name: "preference_code", labelKey: "transportOrders.fields.pref", span: 1 },
  { name: "description", labelKey: "transportOrders.fields.description", span: 2 },
  { name: "description_pl", labelKey: "transportOrders.fields.polishName", span: 2 },
  { name: "quantity", labelKey: "transportOrders.fields.quantity", span: 1 },
  { name: "unit_of_measure", labelKey: "transportOrders.fields.uom", span: 1 },
  { name: "invoice_value", labelKey: "transportOrders.fields.invoiceValue", span: 1 },
  { name: "net_weight_kg", labelKey: "transportOrders.fields.netWeight", span: 1 },
  { name: "gross_weight_kg", labelKey: "transportOrders.fields.grossWeight", span: 1 },
  {
    name: "estimated_gross_weight_kg",
    labelKey: "transportOrders.fields.estGrossWeight",
    span: 1,
  },
  { name: "packages_quantity", labelKey: "transportOrders.fields.packagesQty", span: 1 },
  { name: "packages_type", labelKey: "transportOrders.fields.packagesType", span: 1 },
  { name: "packages_marking", labelKey: "transportOrders.fields.packagesMarking", span: 2 },
  { name: "atr_documents", labelKey: "transportOrders.fields.prefDocs", span: 2 },
]

const LINE_FIELDS: readonly FieldSpec<InvoiceLineRow>[] = [
  { name: "line_number", labelKey: "transportOrders.fields.lineNumber", span: 1 },
  { name: "po_number", labelKey: "transportOrders.fields.poNumber", span: 1 },
  { name: "product_code", labelKey: "transportOrders.fields.productCode", span: 1 },
  { name: "cn_code", labelKey: "transportOrders.fields.cnCode", span: 1 },
  { name: "hs", labelKey: "transportOrders.fields.hsCode", span: 1 },
  ...COMMON_LINE_FIELDS,
]

const CUSTOMS_CODE_LINE_FIELDS: readonly FieldSpec<InvoiceLineRow>[] = [
  { name: "line_number", labelKey: "transportOrders.fields.lineNumber", span: 1 },
  { name: "po_number", labelKey: "transportOrders.fields.poNumber", span: 1 },
  { name: "product_code", labelKey: "transportOrders.fields.productCode", span: 1 },
  { name: "cn_code", labelKey: "transportOrders.fields.customsCode", span: 1 },
  ...COMMON_LINE_FIELDS,
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
  const { t } = useTranslation("idp")
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
              header: t(invoiceLineColumnLabelKey(column.key, "grid")),
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
            header: t(invoiceLineColumnLabelKey("cn_code", "grid")),
            size: 110,
            cell: ({ row }) => (
              <span className="font-mono text-xs">{row.original.cn_code ?? "—"}</span>
            ),
          },
          {
            id: "hs",
            header: t(invoiceLineColumnLabelKey("hs", "grid")),
            size: 110,
            cell: ({ row }) => <span className="font-mono text-xs">{row.original.hs ?? "—"}</span>,
          },
        ]
      }
      const key = column.key as keyof InvoiceLineRow
      return [
        {
          id: key,
          header: t(invoiceLineColumnLabelKey(column.key, "grid")),
          size: column.width,
          cell: ({ row }) => {
            const isDescription = key === "description" || key === "description_pl"
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
            aria-label={t("transportOrders.grid.editLine")}
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
  }, [canEdit, t, useCustomsCode, visibleLineColumns])

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

  const handleDownloadCsv = () => {
    const csv = buildInvoiceLinesCsv(invoice.lines, {
      t,
      columns: visibleLineColumns,
      useCustomsCode,
      label: "grid",
    })
    downloadBlob(
      new Blob([csv], { type: INVOICE_LINES_CSV_MIME }),
      buildInvoiceLinesCsvFileName(invoice),
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{t("transportOrders.grid.title")}</h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadCsv}
            disabled={invoice.lines.length === 0}
          >
            <Download className="mr-1.5 h-4 w-4" />
            {t("transportOrders.grid.downloadCsv")}
          </Button>
          <InvoiceLineColumnsDialog showAtrColumns={showAtrProcessing} />
        </div>
      </div>
      <DataTable
        columns={columns}
        data={invoice.lines}
        bordered
        className="overflow-x-auto [&_table]:min-w-[1910px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap [&_th]:font-semibold [&_th]:normal-case [&_th]:tracking-normal [&_th]:text-foreground"
        getRowId={(row) => row.id}
        {...(onSelectLine ? { onRowClick: onSelectLine } : {})}
        emptyState={
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            {t("transportOrders.grid.empty")}
          </div>
        }
      />
      <Sheet open={Boolean(editingLine)} onOpenChange={(o) => !o && setEditingId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>
              {t("transportOrders.grid.editLineTitle", { number: editingLine?.line_number ?? "" })}
            </SheetTitle>
            <SheetDescription>{t("transportOrders.grid.editLineDescription")}</SheetDescription>
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
