"use client"

import { invoiceSupervisorClientColumns } from "@/components/invoice-supervisor/client-columns"
import { InvoiceSupervisorClientFormDialog } from "@/components/invoice-supervisor/client-form-dialog"
import { useInvoiceSupervisorClientsWithExposure } from "@/lib/invoice-supervisor/hooks"
import { DataTable, EmptyState, ErrorState, PageHeader } from "@cortex/ui"
import { Users } from "lucide-react"
import { useMemo } from "react"

export default function InvoiceSupervisorClientsPage() {
  const { data: clients, isLoading, isError, refetch } = useInvoiceSupervisorClientsWithExposure()
  const columns = useMemo(() => invoiceSupervisorClientColumns(), [])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title="Klienci"
        description="Klienci z bieżącą ekspozycją należności — kliknij nazwę, aby zobaczyć szczegóły."
        actions={<InvoiceSupervisorClientFormDialog />}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-8 py-6">
        <p className="shrink-0 text-xs text-muted-foreground">
          {isLoading ? "Ładowanie…" : `${clients?.length ?? 0} klientów`}
        </p>

        {isError ? (
          <ErrorState
            title="Nie udało się wczytać klientów"
            message="Sprawdź połączenie z backendem i spróbuj ponownie."
            onRetry={() => refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={clients ?? []}
            isLoading={isLoading}
            getRowId={(row) => String(row.id)}
            stickyHeader
            bordered
            emptyState={
              <EmptyState
                icon={Users}
                title="Brak klientów"
                description="Dodaj pierwszego klienta, aby zacząć śledzić jego faktury."
              />
            }
          />
        )}
      </div>
    </div>
  )
}
