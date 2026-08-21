"use client"

import { invoiceSupervisorColumns } from "@/components/invoice-supervisor/invoice-columns"
import { InvoiceSupervisorFormDialog } from "@/components/invoice-supervisor/invoice-form-dialog"
import { InvoiceSupervisorImportDialog } from "@/components/invoice-supervisor/invoice-import-dialog"
import { useInvoiceSupervisorInvoices } from "@/lib/invoice-supervisor/hooks"
import { INVOICE_SUPERVISOR_INVOICE_STATUS_LABEL_KEYS } from "@/lib/invoice-supervisor/types"
import {
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cortex/ui"
import { Receipt, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

export default function InvoiceSupervisorInvoicesPage() {
  const { t } = useTranslation("invoice-supervisor")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<string>("all")

  const invoices = useInvoiceSupervisorInvoices({
    ...(query ? { query } : {}),
    ...(status !== "all" ? { status } : {}),
  })
  const columns = useMemo(() => invoiceSupervisorColumns(t), [t])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PageHeader
        title={t("invoices.title")}
        description={t("invoices.description")}
        actions={
          <div className="flex items-center gap-2">
            <InvoiceSupervisorImportDialog />
            <InvoiceSupervisorFormDialog />
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-8 py-6">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("invoices.searchPlaceholder")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 w-80 pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder={t("invoices.statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("invoices.allStatuses")}</SelectItem>
              {Object.entries(INVOICE_SUPERVISOR_INVOICE_STATUS_LABEL_KEYS).map(
                ([value, labelKey]) => (
                  <SelectItem key={value} value={value}>
                    {t(labelKey)}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {invoices.isFetching
              ? t("invoices.refreshing")
              : t("invoices.count", { n: invoices.data?.length ?? 0 })}
          </div>
        </div>

        {invoices.isError ? (
          <ErrorState
            title={t("invoices.loadErrorTitle")}
            message={t("errors.backendMessage")}
            onRetry={() => invoices.refetch()}
          />
        ) : (
          <DataTable
            columns={columns}
            data={invoices.data ?? []}
            isLoading={invoices.isPending}
            getRowId={(row) => String(row.id)}
            stickyHeader
            bordered
            emptyState={
              <EmptyState
                icon={Receipt}
                title={t("invoices.emptyTitle")}
                description={t("invoices.emptyDescription")}
              />
            }
          />
        )}
      </div>
    </div>
  )
}
