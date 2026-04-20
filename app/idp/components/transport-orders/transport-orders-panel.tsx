"use client"

import {
  toastApiError,
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
import type {
  Invoice,
  Party,
  TransportOrder,
  UpdateDeliveryTermsRequest,
  UpdateInvoiceLinesRequest,
  UpdateInvoiceRequest,
  UpdateInvoiceTotalsRequest,
  UpdatePartyRequest,
  UpdateTransportInfoRequest,
} from "@cortex/types"
import { EmptyState, LoadingState } from "@cortex/ui"
import { Truck } from "lucide-react"
import { toast } from "sonner"
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

type PartyRole = "seller" | "buyer" | "consignor" | "consignee"

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

  const saveParty = async (role: PartyRole, body: UpdatePartyRequest) => {
    const mutation = { seller, buyer, consignor, consignee }[role]
    try {
      await mutation.mutateAsync({ packageId, orderId: order.id, body })
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} updated`)
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }

  const saveTransportInfo = async (body: UpdateTransportInfoRequest) => {
    try {
      await transportInfo.mutateAsync({ packageId, orderId: order.id, body })
      toast.success("Transport info updated")
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }

  const saveInvoiceHeader = async (invoiceId: string, body: UpdateInvoiceRequest) => {
    try {
      await invoiceHeader.mutateAsync({ packageId, orderId: order.id, invoiceId, body })
      toast.success("Invoice updated")
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }

  const saveDeliveryTerms = async (invoiceId: string, body: UpdateDeliveryTermsRequest) => {
    try {
      await deliveryTerms.mutateAsync({ packageId, orderId: order.id, invoiceId, body })
      toast.success("Delivery terms updated")
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }

  const saveInvoiceTotals = async (invoiceId: string, body: UpdateInvoiceTotalsRequest) => {
    try {
      await invoiceTotals.mutateAsync({ packageId, orderId: order.id, invoiceId, body })
      toast.success("Totals updated")
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }

  const saveInvoiceLines = async (invoiceId: string, body: UpdateInvoiceLinesRequest) => {
    try {
      await invoiceLines.mutateAsync({ packageId, orderId: order.id, invoiceId, body })
      toast.success("Lines updated")
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }

  const parties: Array<{
    label: string
    role: PartyRole
    value: Party | null
    isSaving: boolean
  }> = [
    { label: "Seller", role: "seller", value: order.seller, isSaving: seller.isPending },
    { label: "Buyer", role: "buyer", value: order.buyer, isSaving: buyer.isPending },
    { label: "Consignor", role: "consignor", value: order.consignor, isSaving: consignor.isPending },
    { label: "Consignee", role: "consignee", value: order.consignee, isSaving: consignee.isPending },
  ]

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
        onSave={saveTransportInfo}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {parties.map(({ label, role, value, isSaving }) => (
          <PartyEditor
            key={role}
            label={label}
            value={value}
            canEdit={canEdit}
            isSaving={isSaving}
            onSave={(body) => saveParty(role, body)}
          />
        ))}
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
          onSaveHeader={(body) => saveInvoiceHeader(invoice.id, body)}
          onSaveDelivery={(body) => saveDeliveryTerms(invoice.id, body)}
          onSaveTotals={(body) => saveInvoiceTotals(invoice.id, body)}
          onSaveLines={(body) => saveInvoiceLines(invoice.id, body)}
          onSelectLine={(line) => selectLineRefs(line.source_references)}
        />
      ))}
    </section>
  )
}
