import type { Invoice, InvoiceLine } from "@cortex/types"
import type { useTranslation } from "react-i18next"
import { invoiceLineColumnLabelKey, type InvoiceLineColumnConfig } from "./invoice-line-columns"
import { invoiceLineToRow, type InvoiceLineRow } from "./invoice-line-row"

/** `t` wędruje parametrem — plik nie jest komponentem. */
type Translate = ReturnType<typeof useTranslation>["t"]

type InvoiceLineCsvLabel = "grid" | "spreadsheet"

interface CsvColumn {
  key: keyof InvoiceLineRow
  label: string
}

interface BuildInvoiceLinesCsvOptions {
  t: Translate
  columns: readonly InvoiceLineColumnConfig[]
  useCustomsCode?: boolean
  label?: InvoiceLineCsvLabel
  rowOverrides?: Record<string, InvoiceLineRow>
}

export const INVOICE_LINES_CSV_MIME = "text/csv;charset=utf-8"

export function buildInvoiceLinesCsv(
  lines: readonly InvoiceLine[],
  {
    t,
    columns,
    useCustomsCode = false,
    label = "grid",
    rowOverrides = {},
  }: BuildInvoiceLinesCsvOptions,
): string {
  const csvColumns = buildCsvColumns(t, columns, useCustomsCode, label)
  const rows = [
    csvColumns.map((column) => encodeCsvCell(column.label)).join(","),
    ...lines.map((line) => {
      const row = rowOverrides[line.id] ?? invoiceLineToRow(line, { useCustomsCode })
      const hasOverride = rowOverrides[line.id] !== undefined
      return csvColumns
        .map((column) => encodeCsvCell(getCsvCellValue(line, row, column.key, label, hasOverride)))
        .join(",")
    }),
  ]
  return `\ufeff${rows.join("\r\n")}\r\n`
}

export function buildInvoiceLinesCsvFileName(invoice: Invoice): string {
  const base = sanitizeFileNamePart(invoice.invoice_number || invoice.id)
  return `${base}_invoice_lines.csv`
}

function buildCsvColumns(
  t: Translate,
  columns: readonly InvoiceLineColumnConfig[],
  useCustomsCode: boolean,
  label: InvoiceLineCsvLabel,
): CsvColumn[] {
  const variant = label === "spreadsheet" ? "sheet" : "grid"
  return columns.flatMap<CsvColumn>((column) => {
    const columnLabel = t(invoiceLineColumnLabelKey(column.key, variant))
    if (column.key === "customs_code") {
      return useCustomsCode
        ? [{ key: "cn_code", label: columnLabel }]
        : [
            { key: "cn_code", label: t(invoiceLineColumnLabelKey("cn_code", "grid")) },
            { key: "hs", label: t(invoiceLineColumnLabelKey("hs", "grid")) },
          ]
    }
    return [{ key: column.key as keyof InvoiceLineRow, label: columnLabel }]
  })
}

function encodeCsvCell(value: string): string {
  if (!/[",\r\n]/.test(value)) return value
  return `"${value.replaceAll('"', '""')}"`
}

function getCsvCellValue(
  line: InvoiceLine,
  row: InvoiceLineRow,
  key: keyof InvoiceLineRow,
  label: InvoiceLineCsvLabel,
  hasOverride: boolean,
): string {
  if (label !== "grid" || key !== "atr_documents" || hasOverride) return row[key]
  return (
    line.sad_override?.atr_documents
      ?.map((document) =>
        [document.document_code || "N018", document.document_number, document.quantity]
          .filter(Boolean)
          .join(" / "),
      )
      .join("; ") ?? ""
  )
}

function sanitizeFileNamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "invoice"
  )
}
