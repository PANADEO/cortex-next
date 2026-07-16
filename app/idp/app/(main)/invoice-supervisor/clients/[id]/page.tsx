"use client"

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@cortex/ui"
import { cn } from "@cortex/utils"
import type { ColumnDef } from "@tanstack/react-table"
import { AlertTriangle, ArrowLeft, Eye, Receipt, Wallet } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo } from "react"
import { InvoiceSupervisorClientTypeBadge } from "@/components/invoice-supervisor/client-columns"
import { InvoiceSupervisorClientEscalationSection } from "@/components/invoice-supervisor/client-escalation-section"
import { InvoiceSupervisorClientFormDialog } from "@/components/invoice-supervisor/client-form-dialog"
import {
  useInvoiceSupervisorClient,
  useInvoiceSupervisorClientExposure,
  useInvoiceSupervisorInvoices,
} from "@/lib/invoice-supervisor/hooks"
import {
  formatInvoiceSupervisorCurrency,
  formatInvoiceSupervisorMultiCurrency,
  formatInvoiceSupervisorDate,
  INVOICE_SUPERVISOR_INVOICE_STATUS_COLORS,
  INVOICE_SUPERVISOR_INVOICE_STATUS_LABELS,
  type InvoiceSupervisorInvoice,
} from "@/lib/invoice-supervisor/types"

// Mirrors the escalation section's definition of "open" — statuses that still represent
// money owed, as opposed to paid/disputed which are settled or on hold.
const OPEN_INVOICE_STATUSES = new Set(["pending", "upcoming", "due_today", "overdue", "partially_paid"])

function clientInvoiceColumns(): ColumnDef<InvoiceSupervisorInvoice, unknown>[] {
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
    {
      accessorKey: "amount",
      header: "Kwota",
      size: 140,
      cell: ({ row }) => formatInvoiceSupervisorCurrency(row.original.amount, row.original.currency),
    },
    {
      accessorKey: "due_date",
      header: "Termin",
      size: 120,
      cell: ({ row }) => formatInvoiceSupervisorDate(row.original.due_date),
    },
    {
      accessorKey: "status",
      header: "Status",
      size: 170,
      cell: ({ row }) => (
        <Badge
          variant="secondary"
          className={cn("border-0", INVOICE_SUPERVISOR_INVOICE_STATUS_COLORS[row.original.status])}
        >
          {INVOICE_SUPERVISOR_INVOICE_STATUS_LABELS[row.original.status] ?? row.original.status}
        </Badge>
      ),
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
          aria-label={`Zobacz szczegóły faktury ${row.original.invoice_number}`}
        >
          <Link href={`/invoice-supervisor/invoices/${row.original.id}`}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      ),
    },
  ]
}

export default function InvoiceSupervisorClientDetailPage() {
  const params = useParams<{ id: string }>()
  const clientId = Number(params?.id ?? "")

  const client = useInvoiceSupervisorClient(clientId)
  const exposure = useInvoiceSupervisorClientExposure(clientId)
  const invoices = useInvoiceSupervisorInvoices({ client_id: clientId })

  const openInvoiceCount = useMemo(
    () => invoices.data?.filter((invoice) => OPEN_INVOICE_STATUSES.has(invoice.status)).length ?? 0,
    [invoices.data],
  )
  const invoiceColumns = useMemo(() => clientInvoiceColumns(), [])

  if (client.isPending && !client.data) return <LoadingState label="Ładowanie klienta…" />
  if (client.error || !client.data) {
    return (
      <ErrorState
        title="Nie znaleziono klienta"
        message="Wybrany klient nie istnieje lub nie udało się go wczytać."
      />
    )
  }

  const data = client.data

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={data.name}
        description="Ekspozycja należności, eskalacja i historia faktur klienta."
        actions={
          <>
            <InvoiceSupervisorClientFormDialog client={data} />
            <Button variant="outline" size="sm" asChild>
              <Link href="/invoice-supervisor/clients">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Wróć do listy
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-8 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceSupervisorClientTypeBadge type={data.type} />
          <span className="text-sm text-muted-foreground">
            {data.email ?? "brak e-maila"} · {data.phone ?? "brak telefonu"}
            {data.assigned_to ? ` · opiekun: ${data.assigned_to}` : ""}
          </span>
        </div>

        {exposure.isError ? (
          <ErrorState
            title="Nie udało się wczytać ekspozycji klienta"
            message="Sprawdź połączenie z backendem i spróbuj ponownie."
            onRetry={() => exposure.refetch()}
          />
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <DataCard
            label="Należność łączna"
            value={
              exposure.isError
                ? "—"
                : formatInvoiceSupervisorMultiCurrency(
                    exposure.data?.total_outstanding ?? 0,
                    exposure.data?.currency_breakdown,
                  )
            }
            icon={Wallet}
            tone={exposure.data && exposure.data.total_outstanding > 0 ? "destructive" : "default"}
            isLoading={exposure.isLoading}
          />
          <DataCard
            label="Niezapłacone faktury"
            value={exposure.isError ? "—" : (exposure.data?.invoice_count ?? 0)}
            icon={Receipt}
            isLoading={exposure.isLoading}
          />
          <DataCard
            label="Po terminie"
            value={exposure.isError ? "—" : (exposure.data?.overdue_count ?? 0)}
            icon={AlertTriangle}
            tone={exposure.data && exposure.data.overdue_count > 0 ? "warning" : "default"}
            isLoading={exposure.isLoading}
          />
        </section>

        <InvoiceSupervisorClientEscalationSection
          clientId={clientId}
          clientName={data.name}
          openInvoiceCount={openInvoiceCount}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Faktury</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.isError ? (
              <ErrorState
                title="Nie udało się wczytać faktur"
                message="Sprawdź połączenie z backendem i spróbuj ponownie."
                onRetry={() => invoices.refetch()}
                className="border-none"
              />
            ) : (
              <DataTable
                columns={invoiceColumns}
                data={invoices.data ?? []}
                isLoading={invoices.isLoading}
                getRowId={(row) => String(row.id)}
                emptyState={
                  <EmptyState
                    icon={Receipt}
                    title="Brak faktur"
                    description="Ten klient nie ma jeszcze żadnych faktur."
                  />
                }
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
