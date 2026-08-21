"use client"

import { invoiceSupervisorClientColumns } from "@/components/invoice-supervisor/client-columns"
import { InvoiceSupervisorClientFormDialog } from "@/components/invoice-supervisor/client-form-dialog"
import { useInvoiceSupervisorClientsWithExposure } from "@/lib/invoice-supervisor/hooks"
import { DataTable, EmptyState, ErrorState, PageHeader } from "@cortex/ui"
import { Users } from "lucide-react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

export default function InvoiceSupervisorClientsPage() {
  const { t } = useTranslation(["invoice-supervisor", "common"])
  const { data: clients, isLoading, isError, refetch } = useInvoiceSupervisorClientsWithExposure()
  const columns = useMemo(() => invoiceSupervisorClientColumns(t), [t])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={t("clients.title")}
        description={t("clients.description")}
        actions={<InvoiceSupervisorClientFormDialog />}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-8 py-6">
        <p className="shrink-0 text-xs text-muted-foreground">
          {isLoading ? t("common:state.loading") : t("clients.count", { n: clients?.length ?? 0 })}
        </p>

        {isError ? (
          <ErrorState
            title={t("clients.loadErrorTitle")}
            message={t("errors.backendMessage")}
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
                title={t("clients.emptyTitle")}
                description={t("clients.emptyDescription")}
              />
            }
          />
        )}
      </div>
    </div>
  )
}
