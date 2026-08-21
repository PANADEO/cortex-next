"use client"

import {
  formatInvoiceSupervisorMultiCurrency,
  INVOICE_SUPERVISOR_CLIENT_TYPE_LABEL_KEYS,
  type InvoiceSupervisorClientType,
  type InvoiceSupervisorClientWithExposure,
} from "@/lib/invoice-supervisor/types"
import { Badge, Button } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import type { TFunction } from "i18next"
import { Eye } from "lucide-react"
import Link from "next/link"
import { useTranslation } from "react-i18next"

export function InvoiceSupervisorClientTypeBadge({ type }: { type: InvoiceSupervisorClientType }) {
  const { t } = useTranslation("invoice-supervisor")
  return (
    <Badge variant={type === "vip" ? "default" : "secondary"}>
      {t(INVOICE_SUPERVISOR_CLIENT_TYPE_LABEL_KEYS[type] ?? type)}
    </Badge>
  )
}

export function invoiceSupervisorClientColumns(
  t: TFunction<"invoice-supervisor">,
): ColumnDef<InvoiceSupervisorClientWithExposure, unknown>[] {
  return [
    {
      accessorKey: "name",
      header: t("columns.clientName"),
      cell: ({ row }) => (
        <Link
          href={`/invoice-supervisor/clients/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "type",
      header: t("columns.clientType"),
      size: 100,
      cell: ({ row }) => <InvoiceSupervisorClientTypeBadge type={row.original.type} />,
    },
    {
      accessorKey: "email",
      header: t("columns.email"),
      cell: ({ row }) => row.original.email ?? "—",
    },
    {
      accessorKey: "total_outstanding",
      header: t("columns.outstanding"),
      size: 140,
      cell: ({ row }) => (
        <span
          className={
            row.original.total_outstanding > 0 ? "font-medium text-destructive" : undefined
          }
        >
          {formatInvoiceSupervisorMultiCurrency(
            row.original.total_outstanding,
            row.original.currency_breakdown,
          )}
        </span>
      ),
    },
    {
      accessorKey: "invoice_count",
      header: t("columns.invoiceCount"),
      size: 90,
      cell: ({ row }) => row.original.invoice_count,
    },
    {
      id: "actions",
      header: "",
      size: 60,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          asChild
          onClick={(event) => event.stopPropagation()}
          aria-label={t("columns.viewClientAria", { name: row.original.name })}
        >
          <Link href={`/invoice-supervisor/clients/${row.original.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ]
}
