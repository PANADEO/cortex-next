"use client"

import {
  toastApiError,
  useMe,
  usePackage,
  usePackageTransportOrders,
  useUpdateInvoiceLines,
} from "@cortex/api"
import type { UpdateInvoiceLinesRequest } from "@cortex/types"
import { Button, LoadingState } from "@cortex/ui"
import { emailsMatch } from "@cortex/utils"
import { ArrowLeft, Lock } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { toast } from "sonner"
import { SourceMaterialsPanel } from "@/components/source-materials-panel"
import { InvoiceHeaderPanel } from "@/components/transport-orders/invoice-header-panel"
import { LinesSpreadsheet } from "@/components/transport-orders/lines-spreadsheet"

export default function VerifyWorkspacePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const me = useMe()

  const pkgQuery = usePackage(id, { polling: false })
  const toQuery = usePackageTransportOrders(id, { polling: false })
  const updateLines = useUpdateInvoiceLines()

  const pkg = pkgQuery.data
  const isActiveVerification = pkg?.verification_state === "in_progress"
  const canEdit = isActiveVerification && emailsMatch(me.data?.email, pkg?.assignee)

  const order = toQuery.data?.transport_orders?.[0]
  const invoice = order?.invoices?.[0]

  const handleSaveLines = async (body: UpdateInvoiceLinesRequest) => {
    if (!order || !invoice) return
    try {
      await updateLines.mutateAsync({
        packageId: id,
        orderId: order.id,
        invoiceId: invoice.id,
        body,
      })
      toast.success(`Saved ${body.lines.length} line(s)`)
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/idp/packages/${id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to package
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold">
              {pkg?.file_name ?? "Verification workspace"}
            </h1>
            {!pkg ? (
              <p className="text-[10px] text-muted-foreground">Loading…</p>
            ) : !canEdit ? (
              <p className="text-[10px] text-muted-foreground">Read-only</p>
            ) : null}
          </div>
        </div>
        {pkg && !canEdit ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            {isActiveVerification
              ? `Only ${pkg.assignee ?? "assignee"} can edit`
              : "Start verification to edit"}
          </span>
        ) : null}
      </header>
      <div className="min-h-0 flex-1">
        {pkgQuery.isLoading || toQuery.isLoading ? (
          <LoadingState label="Loading workspace…" />
        ) : !invoice ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No invoice lines extracted for this package.
          </div>
        ) : (
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={55} minSize={30} className="flex min-h-0 flex-col">
              {order ? <InvoiceHeaderPanel order={order} invoice={invoice} /> : null}
              <LinesSpreadsheet
                invoice={invoice}
                canEdit={canEdit}
                isSaving={updateLines.isPending}
                onSave={handleSaveLines}
              />
            </Panel>
            <PanelResizeHandle className="w-1 shrink-0 bg-border transition-colors hover:bg-primary/40 data-[resize-handle-active]:bg-primary/50" />
            <Panel defaultSize={45} minSize={30} className="min-h-0 overflow-hidden p-3">
              <SourceMaterialsPanel packageId={id} />
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  )
}
