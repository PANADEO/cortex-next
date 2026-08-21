"use client"

import { wrapMutation } from "@/lib/hooks/use-toast-mutation"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"
import {
  useExportTemplates,
  usePackageTransportOrders,
  useUpdateBuyer,
  useUpdateConsignee,
  useUpdateConsignor,
  useUpdateDeliveryTerms,
  useUpdateInvoice,
  useUpdateInvoiceLines,
  useUpdateInvoiceTotals,
  useUpdateSadContext,
  useUpdateSeller,
  useUpdateTransportInfo,
} from "@cortex/api"
import type { Invoice, Party, TransportOrder } from "@cortex/types"
import { EmptyState, LoadingState, Tabs, TabsContent, TabsList, TabsTrigger } from "@cortex/ui"
import { useFeatureFlag } from "@cortex/utils"
import { Truck } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { InvoiceEditor } from "./invoice-editor"
import { PartyEditor } from "./party-editor"
import { SadContextEditor } from "./sad-context-editor"
import { TransportInfoEditor } from "./transport-info-editor"

interface Props {
  packageId: string
  canEdit: boolean
}

const SAD_CONTEXT_EXPORT_TEMPLATES = new Set([
  "sad_xml",
  "huzar_connector_xml",
  "rusałka_connector_xml",
  "zc415_xml",
])

function usesSadContextExportTemplate(templateName: string): boolean {
  return SAD_CONTEXT_EXPORT_TEMPLATES.has(templateName) || templateName.startsWith("huzar_xml")
}

export function TransportOrdersPanel({ packageId, canEdit }: Props) {
  const { t } = useTranslation("idp")
  const { data, isLoading } = usePackageTransportOrders(packageId, { polling: false })
  const exportTemplates = useExportTemplates()
  const useCustomsCode = useFeatureFlag("idp.customs-code")
  const showAtrProcessing = useFeatureFlag("idp.atr-processing")
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)

  const orders = useMemo(
    () => data?.verified_transport_orders ?? data?.transport_orders ?? [],
    [data?.verified_transport_orders, data?.transport_orders],
  )

  useEffect(() => {
    setActiveOrderId((current) => {
      if (orders.length === 0) return current === null ? current : null
      if (current && orders.some((order) => order.id === current)) return current
      return orders[0]?.id ?? null
    })
  }, [orders])

  const hasSadContextExport =
    exportTemplates.data?.some((template) => usesSadContextExportTemplate(template.name)) ?? false

  if (isLoading) return <LoadingState variant="skeleton" rows={6} />

  if (!orders.length) {
    return (
      <EmptyState
        icon={Truck}
        title={t("transportOrders.panel.emptyTitle")}
        description={t("transportOrders.panel.emptyDescription")}
      />
    )
  }

  const firstOrder = orders[0]
  if (!firstOrder) return null

  const selectedOrder = orders.find((order) => order.id === activeOrderId) ?? firstOrder
  const selectedOrderId = selectedOrder.id
  const hasOrderTabs = orders.length > 1

  return (
    <Tabs value={selectedOrderId} onValueChange={setActiveOrderId} className="space-y-6">
      {hasOrderTabs ? (
        <TabsList className="flex h-auto max-w-full justify-start overflow-x-auto rounded-lg p-1">
          {orders.map((order) => (
            <TabsTrigger
              key={order.id}
              value={order.id}
              title={transportOrderMeta(order)}
              className="min-w-28 shrink-0 flex-col items-start gap-0.5 px-3 py-2 text-left"
            >
              <span className="max-w-40 truncate text-sm">{transportOrderLabel(order)}</span>
              <span className="text-[10px] font-normal text-muted-foreground">
                {transportOrderMeta(order)}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      ) : null}
      {orders.map((order) => (
        <TabsContent key={order.id} value={order.id} className="mt-0">
          <TransportOrderSection
            order={order}
            packageId={packageId}
            canEdit={canEdit}
            showSadContext={hasSadContextExport}
            useCustomsCode={useCustomsCode}
            showAtrProcessing={showAtrProcessing}
            showHeader={!hasOrderTabs}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function transportOrderLabel(order: TransportOrder): string {
  return order.transport_order_number?.trim() || order.id
}

function transportOrderMeta(order: TransportOrder): string {
  const route = `${order.country_of_dispatch ?? "?"} → ${order.country_of_destination ?? "?"}`
  return order.mode ? `${route} · ${order.mode}` : route
}

interface SectionProps {
  order: TransportOrder
  packageId: string
  canEdit: boolean
  showSadContext: boolean
  useCustomsCode: boolean
  showAtrProcessing: boolean
  showHeader: boolean
}

interface PartyConfig {
  labelKey: string
  role: "seller" | "buyer" | "consignor" | "consignee"
  value: Party | null
}

function TransportOrderSection({
  order,
  packageId,
  canEdit,
  showSadContext,
  useCustomsCode,
  showAtrProcessing,
  showHeader,
}: SectionProps) {
  const { t } = useTranslation("idp")
  const seller = useUpdateSeller()
  const buyer = useUpdateBuyer()
  const consignor = useUpdateConsignor()
  const consignee = useUpdateConsignee()
  const transportInfo = useUpdateTransportInfo()
  const sadContext = useUpdateSadContext()
  const invoiceHeader = useUpdateInvoice()
  const deliveryTerms = useUpdateDeliveryTerms()
  const invoiceTotals = useUpdateInvoiceTotals()
  const invoiceLines = useUpdateInvoiceLines()
  const selectLine = useSourceMaterialSelectionStore((s) => s.selectLine)

  const partyMutations = { seller, buyer, consignor, consignee }
  const saveTransportInfo = wrapMutation(transportInfo, t("transportOrders.toasts.transportInfo"))
  const saveSadContext = wrapMutation(sadContext, t("transportOrders.toasts.sadContext"))
  const saveInvoiceHeader = wrapMutation(invoiceHeader, t("transportOrders.toasts.invoice"))
  const saveDeliveryTerms = wrapMutation(deliveryTerms, t("transportOrders.toasts.deliveryTerms"))
  const saveInvoiceTotals = wrapMutation(invoiceTotals, t("transportOrders.toasts.totals"))
  const saveInvoiceLines = wrapMutation(invoiceLines, t("transportOrders.toasts.lines"))

  const parties: readonly PartyConfig[] = useMemo(
    () => [
      { labelKey: "transportOrders.parties.seller", role: "seller", value: order.seller },
      { labelKey: "transportOrders.parties.buyer", role: "buyer", value: order.buyer },
      { labelKey: "transportOrders.parties.consignor", role: "consignor", value: order.consignor },
      { labelKey: "transportOrders.parties.consignee", role: "consignee", value: order.consignee },
    ],
    [order.seller, order.buyer, order.consignor, order.consignee],
  )

  return (
    <section className="space-y-6">
      {showHeader ? (
        <header>
          <h2 className="text-sm font-semibold">
            {t("transportOrders.panel.orderHeading", {
              label: order.transport_order_number ?? order.id,
            })}
          </h2>
          <p className="text-xs text-muted-foreground">{transportOrderMeta(order)}</p>
        </header>
      ) : null}

      <TransportInfoEditor
        order={order}
        canEdit={canEdit}
        isSaving={transportInfo.isPending}
        onSave={(body) => saveTransportInfo({ packageId, orderId: order.id, body })}
      />

      {showSadContext ? (
        <SadContextEditor
          order={order}
          canEdit={canEdit}
          isSaving={sadContext.isPending}
          onSave={(body) => saveSadContext({ packageId, orderId: order.id, body })}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {parties.map(({ labelKey, role, value }) => {
          const m = partyMutations[role]
          const label = t(labelKey)
          const save = wrapMutation(m, t("transportOrders.toasts.party", { label }))
          return (
            <PartyEditor
              key={role}
              label={label}
              value={value}
              canEdit={canEdit}
              isSaving={m.isPending}
              onSave={(body) => save({ packageId, orderId: order.id, body })}
            />
          )
        })}
      </div>

      {order.invoices.map((invoice: Invoice) => (
        <InvoiceEditor
          key={invoice.id}
          invoice={invoice}
          canEdit={canEdit}
          isSavingHeader={invoiceHeader.isPending}
          isSavingDelivery={deliveryTerms.isPending}
          isSavingTotals={invoiceTotals.isPending}
          isSavingLines={invoiceLines.isPending}
          onSaveHeader={(body) =>
            saveInvoiceHeader({ packageId, orderId: order.id, invoiceId: invoice.id, body })
          }
          onSaveDelivery={(body) =>
            saveDeliveryTerms({ packageId, orderId: order.id, invoiceId: invoice.id, body })
          }
          onSaveTotals={(body) =>
            saveInvoiceTotals({ packageId, orderId: order.id, invoiceId: invoice.id, body })
          }
          onSaveLines={(body) =>
            saveInvoiceLines({ packageId, orderId: order.id, invoiceId: invoice.id, body })
          }
          onSelectLine={selectLine}
          useCustomsCode={useCustomsCode}
          showAtrProcessing={showAtrProcessing}
        />
      ))}
    </section>
  )
}
