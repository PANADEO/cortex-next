"use client"

import { useInvoiceSupervisorDashboardSummary } from "@/lib/invoice-supervisor/hooks"
import { formatInvoiceSupervisorMultiCurrency } from "@/lib/invoice-supervisor/types"
import { Skeleton } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { AlertCircle, CalendarClock, Receipt, TrendingDown } from "lucide-react"
import type { ElementType } from "react"

export function InvoiceSupervisorStatsStrip() {
  const { data, isLoading, isError } = useInvoiceSupervisorDashboardSummary()
  const overdueCount =
    (data?.status_counts?.overdue ?? 0) + (data?.status_counts?.partially_paid ?? 0)
  const paidCount = data?.status_counts?.paid ?? 0

  return (
    <div className="grid shrink-0 grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
      <StatItem
        icon={Receipt}
        label="Faktury niezapłacone"
        value={data ? data.total_invoices - paidCount : undefined}
        isLoading={isLoading}
        isError={isError}
      />
      <StatItem
        icon={TrendingDown}
        label="Łączna kwota po terminie"
        value={
          data
            ? formatInvoiceSupervisorMultiCurrency(
                data.total_overdue,
                data.overdue_currency_breakdown,
              )
            : undefined
        }
        isLoading={isLoading}
        isError={isError}
        tone="destructive"
      />
      <StatItem
        icon={AlertCircle}
        label="Po terminie"
        value={overdueCount}
        isLoading={isLoading}
        isError={isError}
        tone="destructive"
      />
      <StatItem
        icon={CalendarClock}
        label="Termin dzisiaj"
        value={data?.due_today.length}
        isLoading={isLoading}
        isError={isError}
        tone="warning"
      />
    </div>
  )
}

function StatItem({
  icon: Icon,
  label,
  value,
  isLoading,
  isError,
  tone,
}: {
  icon: ElementType
  label: string
  value: string | number | undefined
  isLoading?: boolean
  isError?: boolean
  tone?: "destructive" | "warning"
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5">
      <Icon
        className={cn(
          "size-4 shrink-0",
          tone === "destructive"
            ? "text-destructive"
            : tone === "warning"
              ? "text-warning"
              : "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <div className="truncate text-[11px] text-muted-foreground">{label}</div>
        {isLoading ? (
          <Skeleton className="mt-0.5 h-4 w-12" />
        ) : isError ? (
          <div
            className="truncate text-sm font-semibold text-destructive"
            title="Nie udało się wczytać"
          >
            —
          </div>
        ) : (
          <div className="truncate text-sm font-semibold">{value}</div>
        )}
      </div>
    </div>
  )
}
