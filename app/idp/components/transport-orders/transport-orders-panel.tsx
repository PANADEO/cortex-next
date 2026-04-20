"use client"

import {
  usePackageTransportOrders,
  useUpdateBuyer,
  useUpdateConsignee,
  useUpdateConsignor,
  useUpdateDeliveryTerms,
  useUpdateInvoice,
  useUpdateInvoiceLines,
  useUpdateInvoiceTotals,
  useUpdateSeller,
  useUpdateTransportInfo,
} from "@cortex/api"
import type { Invoice, Party, TransportOrder } from "@cortex/types"
import { EmptyState, LoadingState } from "@cortex/ui"
import { Truck } from "lucide-react"
import { useMemo } from "react"
import { wrapMutation } from "@/lib/hooks/use-toast-mutation"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"
import { InvoiceEditor } from "./invoice-editor"
import { PartyEditor } from "./party-editor"
import { TransportInfoEditor } from "./transport-info-editor"

interface Props {
  packageId: string
  canEdit: boolean
}

export function TransportOrdersPanel({ packageId, canEdit }: Props) {
  const { data, isLoading } = usePackageTransportOrders(packageId, { polling: false })

  if (isLoading) return <LoadingState variant="skeleton" rows={6} />

  const orders = data?.verified_transport_orders ?? data?.transport_orders ?? null
  const order = orders?.[0]

  if (!order) {
    return (
      <EmptyState
        icon={Truck}
        title="No transport orders extracted yet"
        description="Once analysis finishes, extracted transport orders will appear here."
      />
    )
  }

  return (
    <div className="space-y-8">
      <TransportOrderSection order={order} packageId={packageId} canEdit={canEdit} />
    </div>
  )
}

interface SectionProps {
  order: TransportOrder
  packageId: string
  canEdit: boolean
}

interface PartyConfig {
  label: string
  role: "seller" | "buyer" | "consignor" | "consignee"
  value: Party | null
}

function TransportOrderSection({ order, packageId, canEdit }: SectionProps) {
  const seller = useUpdateSeller()
  const buyer = useUpdateBuyer()
  const consignor = useUpdateConsignor()
  const consignee = useUpdateConsignee()
  const transportInfo = useUpdateTransportInfo()
  const invoiceHeader = useUpdateInvoice()
  const deliveryTerms = useUpdateDeliveryTerms()
  const invoiceTotals = useUpdateInvoiceTotals()
  const invoiceLines = useUpdateInvoiceLines()
  const selectLineRefs = useSourceMaterialSelectionStore((s) => s.selectLineRefs)

  const partyMutations = { seller, buyer, consignor, consignee }
  const saveTransportInfo = wrapMutation(transportInfo, "Transport info updated")
  const saveInvoiceHeader = wrapMutation(invoiceHeader, "Invoice updated")
  const saveDeliveryTerms = wrapMutation(deliveryTerms, "Delivery terms updated")
  const saveInvoiceTotals = wrapMutation(invoiceTotals, "Totals updated")
  const saveInvoiceLines = wrapMutation(invoiceLines, "Lines updated")

  const parties: readonly PartyConfig[] = useMemo(
    () => [
      { label: "Seller", role: "seller", value: order.seller },
      { label: "Buyer", role: "buyer", value: order.buyer },
      { label: "Consignor", role: "consignor", value: order.consignor },
      { label: "Consignee", role: "consignee", value: order.consignee },
    ],
    [order.seller, order.buyer, order.consignor, order.consignee],
  )

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-sm font-semibold">
          Transport order {order.transport_order_number ?? order.id}
        </h2>
        <p className="text-xs text-muted-foreground">
          {order.country_of_dispatch ?? "?"} → {order.country_of_destination ?? "?"}
          {order.mode ? ` · ${order.mode}` : ""}
        </p>
      </header>

      <TransportInfoEditor
        order={order}
        canEdit={canEdit}
        isSaving={transportInfo.isPending}
        onSave={(body) => saveTransportInfo({ packageId, orderId: order.id, body })}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {parties.map(({ label, role, value }) => {
          const m = partyMutations[role]
          const save = wrapMutation(m, `${label} updated`)
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
          onSelectLine={(line) => selectLineRefs(line.source_references)}
        />
      ))}
    </section>
  )
}
