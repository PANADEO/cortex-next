"use client"

import { usePackageTransportOrders } from "@cortex/api"
import { Skeleton } from "@cortex/ui"
import { formatRoute } from "@cortex/utils"
import { useTranslation } from "react-i18next"

interface Props {
  packageId: string
}

export function PackageTransportSummary({ packageId }: Props) {
  const { t } = useTranslation("idp")
  const { data, isLoading } = usePackageTransportOrders(packageId, { polling: false })

  if (isLoading) return <Skeleton className="h-24 w-full" />

  const orders = data?.verified_transport_orders ?? data?.transport_orders ?? []
  if (orders.length === 0) return null

  const totalInvoices = orders.reduce((sum, o) => sum + o.invoices.length, 0)

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">
              {t("packages.transportSummary.order")}
            </th>
            <th className="px-3 py-2 text-left font-semibold">
              {t("packages.transportSummary.route")}
            </th>
            <th className="px-3 py-2 text-left font-semibold">
              {t("packages.transportSummary.mode")}
            </th>
            <th className="px-3 py-2 text-right font-semibold">
              {t("packages.transportSummary.invoices")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {orders.map((order) => {
            const route = formatRoute(order.country_of_dispatch, order.country_of_destination)
            return (
              <tr key={order.id}>
                <td className="px-3 py-2 font-mono text-xs">
                  {order.transport_order_number ?? order.id}
                </td>
                <td className="px-3 py-2">
                  {route ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-cortex/30 bg-cortex/10 px-1.5 py-0.5 font-mono text-[11px] text-cortex-dark dark:text-cortex-light">
                      {route}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 capitalize text-muted-foreground">{order.mode ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums">{order.invoices.length}</td>
              </tr>
            )
          })}
          {orders.length > 1 ? (
            <tr className="bg-muted/30 text-[12px]">
              <td colSpan={3} className="px-3 py-1.5 font-semibold text-muted-foreground">
                {t("packages.transportSummary.total")}
              </td>
              <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{totalInvoices}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
