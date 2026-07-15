"use client"

import {
  formatInvoiceSupervisorCurrency,
  formatInvoiceSupervisorDate,
  INVOICE_SUPERVISOR_INVOICE_STATUS_COLORS,
  INVOICE_SUPERVISOR_INVOICE_STATUS_LABELS,
  type InvoiceSupervisorInvoice,
} from "@/lib/invoice-supervisor/types"
import { Badge, Button } from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye } from "lucide-react"
import Link from "next/link"

// Row-action eye icon instead of whole-row-click navigation — deliberate UX
// choice ported from the approved prototype, do not regress to onRowClick.
export function invoiceSupervisorColumns(): ColumnDef<InvoiceSupervisorInvoice, unknown>[] {
  return [
    {
      accessorKey: "invoice_number",
      header: "Numer faktury",
      cell: ({ row }) => (
        <Link
          href={`/invoice-supervisor/invoices/${row.original.id}`}
          className="font-medium hover:underline"
        >
          {row.original.invoice_number}
        </Link>
      ),
    },
    { accessorKey: "client_name", header: "Klient" },
    {
      accessorKey: "amount",
      header: "Kwota",
      cell: ({ row }) => formatInvoiceSupervisorCurrency(row.original.amount, row.original.currency),
    },
    {
      accessorKey: "due_date",
      header: "Termin",
      cell: ({ row }) => formatInvoiceSupervisorDate(row.original.due_date),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status
        return (
          <Badge
            variant="secondary"
            className={cn("border-0", INVOICE_SUPERVISOR_INVOICE_STATUS_COLORS[status])}
          >
            {INVOICE_SUPERVISOR_INVOICE_STATUS_LABELS[status] ?? status}
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "",
      size: 60,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            asChild
            aria-label={`Zobacz szczegóły faktury ${row.original.invoice_number}`}
          >
            <Link href={`/invoice-supervisor/invoices/${row.original.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ]
}
