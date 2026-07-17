"use client"

import {
  formatInvoiceSupervisorMultiCurrency,
  INVOICE_SUPERVISOR_CLIENT_TYPE_LABELS,
  type InvoiceSupervisorClientType,
  type InvoiceSupervisorClientWithExposure,
} from "@/lib/invoice-supervisor/types"
import { Badge, Button } from "@cortex/ui"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye } from "lucide-react"
import Link from "next/link"

export function InvoiceSupervisorClientTypeBadge({ type }: { type: InvoiceSupervisorClientType }) {
  return (
    <Badge variant={type === "vip" ? "default" : "secondary"}>
      {INVOICE_SUPERVISOR_CLIENT_TYPE_LABELS[type] ?? type}
    </Badge>
  )
}

export function invoiceSupervisorClientColumns(): ColumnDef<
  InvoiceSupervisorClientWithExposure,
  unknown
>[] {
  return [
    {
      accessorKey: "name",
      header: "Nazwa",
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
      header: "Typ",
      size: 100,
      cell: ({ row }) => <InvoiceSupervisorClientTypeBadge type={row.original.type} />,
    },
    {
      accessorKey: "email",
      header: "E-mail",
      cell: ({ row }) => row.original.email ?? "—",
    },
    {
      accessorKey: "total_outstanding",
      header: "Należność",
      size: 140,
      cell: ({ row }) => (
        <span className={row.original.total_outstanding > 0 ? "font-medium text-destructive" : undefined}>
          {formatInvoiceSupervisorMultiCurrency(row.original.total_outstanding, row.original.currency_breakdown)}
        </span>
      ),
    },
    {
      accessorKey: "invoice_count",
      header: "Faktur",
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
          aria-label={`Zobacz szczegóły klienta ${row.original.name}`}
        >
          <Link href={`/invoice-supervisor/clients/${row.original.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ]
}
