"use client"

import { SourceMaterialsPanel } from "@/components/source-materials-panel"
import { InvoiceHeaderPanel } from "@/components/transport-orders/invoice-header-panel"
import { LinesSpreadsheet } from "@/components/transport-orders/lines-spreadsheet"
import {
  toastApiError,
  useMe,
  usePackage,
  usePackageTransitions,
  usePackageTransportOrders,
  useUnlockVerification,
  useUpdateInvoiceLines,
} from "@cortex/api"
import type { Invoice, TransportOrder, UpdateInvoiceLinesRequest } from "@cortex/types"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  LoadingState,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import { cn, emailsMatch } from "@cortex/utils"
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Lock,
  LockOpen,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { toast } from "sonner"

interface InvoiceTabItem {
  key: string
  order: TransportOrder
  invoice: Invoice
  ordinal: number
}

export default function VerifyWorkspacePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const me = useMe()

  const pkgQuery = usePackage(id, { polling: false })
  const transitions = usePackageTransitions(id)
  const toQuery = usePackageTransportOrders(id, { polling: false })
  const updateLines = useUpdateInvoiceLines()
  const unlock = useUnlockVerification(id)
  const [documentPreviewVisible, setDocumentPreviewVisible] = useState(true)
  const [activeInvoiceKey, setActiveInvoiceKey] = useState<string | null>(null)

  const pkg = pkgQuery.data
  const isActiveVerification = pkg?.verification_state === "in_progress"
  const canEdit = isActiveVerification && emailsMatch(me.data?.email, pkg?.assignee)
  const canUnlock = transitions.data?.transitions.includes("unlock_verification") ?? false

  const orders = useMemo(
    () => toQuery.data?.transport_orders ?? toQuery.data?.verified_transport_orders ?? [],
    [toQuery.data?.transport_orders, toQuery.data?.verified_transport_orders],
  )
  const invoiceTabs = useMemo<InvoiceTabItem[]>(() => {
    const tabs: InvoiceTabItem[] = []
    for (const order of orders) {
      for (const invoice of order.invoices) {
        tabs.push({
          key: `${order.id}__${invoice.id}`,
          order,
          invoice,
          ordinal: tabs.length + 1,
        })
      }
    }
    return tabs
  }, [orders])

  useEffect(() => {
    setActiveInvoiceKey((current) => {
      if (invoiceTabs.length === 0) return current === null ? current : null
      if (current && invoiceTabs.some((tab) => tab.key === current)) return current
      return invoiceTabs[0]?.key ?? null
    })
  }, [invoiceTabs])

  const activeInvoiceTab = invoiceTabs.find((tab) => tab.key === activeInvoiceKey) ?? invoiceTabs[0]

  const handleSaveLines = async (body: UpdateInvoiceLinesRequest) => {
    if (!activeInvoiceTab) return
    try {
      await updateLines.mutateAsync({
        packageId: id,
        orderId: activeInvoiceTab.order.id,
        invoiceId: activeInvoiceTab.invoice.id,
        body,
      })
      toast.success(`Saved ${body.lines.length} line(s)`)
    } catch (err) {
      toastApiError(err)
      throw err
    }
  }

  const handleUnlock = async () => {
    try {
      await unlock.mutateAsync()
      toast.success("Package unlocked")
      await Promise.all([pkgQuery.refetch(), transitions.refetch()])
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
              {pkg?.package_name ?? pkg?.file_name ?? "Verification workspace"}
            </h1>
            {!pkg ? (
              <p className="text-[10px] text-muted-foreground">Loading…</p>
            ) : pkg.package_name ? (
              <p className="text-[10px] text-muted-foreground">
                {pkg.file_name}
                {!canEdit ? " · Read-only" : ""}
              </p>
            ) : !canEdit ? (
              <p className="text-[10px] text-muted-foreground">Read-only</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDocumentPreviewVisible((visible) => !visible)}
            aria-label={documentPreviewVisible ? "Hide document preview" : "Show document preview"}
          >
            {documentPreviewVisible ? (
              <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Eye className="mr-1.5 h-3.5 w-3.5" />
            )}
            {documentPreviewVisible ? "Hide preview" : "Show preview"}
          </Button>
          {pkg && !canEdit ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              {isActiveVerification
                ? `Only ${pkg.assignee ?? "assignee"} can edit`
                : "Start verification to edit"}
            </span>
          ) : null}
          {pkg && !canEdit && canUnlock ? (
            <Button size="sm" variant="outline" onClick={handleUnlock} disabled={unlock.isPending}>
              {unlock.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <LockOpen className="mr-1.5 h-3.5 w-3.5" />
              )}
              Unlock package
            </Button>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        {pkgQuery.isLoading || toQuery.isLoading ? (
          <LoadingState label="Loading workspace…" />
        ) : !activeInvoiceTab ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No invoices extracted for this package.
          </div>
        ) : (
          <PanelGroup
            key={documentPreviewVisible ? "with-document-preview" : "without-document-preview"}
            direction="horizontal"
            className="h-full"
          >
            <Panel
              defaultSize={documentPreviewVisible ? 55 : 100}
              minSize={30}
              className="flex min-h-0 flex-col"
            >
              <InvoiceTabs
                items={invoiceTabs}
                value={activeInvoiceTab.key}
                onValueChange={setActiveInvoiceKey}
              />
              <InvoiceHeaderPanel
                order={activeInvoiceTab.order}
                invoice={activeInvoiceTab.invoice}
              />
              <LinesSpreadsheet
                key={activeInvoiceTab.key}
                invoice={activeInvoiceTab.invoice}
                canEdit={canEdit}
                isSaving={updateLines.isPending}
                onSave={handleSaveLines}
              />
            </Panel>
            {documentPreviewVisible ? (
              <>
                <PanelResizeHandle className="w-1 shrink-0 bg-border transition-colors hover:bg-primary/40 data-[resize-handle-active]:bg-primary/50" />
                <Panel defaultSize={45} minSize={30} className="min-h-0 overflow-hidden p-3">
                  <div data-testid="document-preview-panel" className="h-full">
                    <SourceMaterialsPanel packageId={id} />
                  </div>
                </Panel>
              </>
            ) : null}
          </PanelGroup>
        )}
      </div>
    </div>
  )
}

function InvoiceTabs({
  items,
  value,
  onValueChange,
}: {
  items: InvoiceTabItem[]
  value: string
  onValueChange: (value: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener("scroll", updateScrollState, { passive: true })
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => updateScrollState())
    observer?.observe(el)
    return () => {
      el.removeEventListener("scroll", updateScrollState)
      observer?.disconnect()
    }
  }, [updateScrollState, items.length])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const trigger = findInvoiceTabTrigger(el, value)
    scrollInvoiceTabIntoView(trigger)
  }, [value])

  const handleScrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" })
  }

  const handleSelectFromDropdown = (nextValue: string) => {
    onValueChange(nextValue)
    requestAnimationFrame(() => {
      const el = scrollerRef.current
      if (!el) return
      scrollInvoiceTabIntoView(findInvoiceTabTrigger(el, nextValue))
    })
  }

  return (
    <Tabs value={value} onValueChange={onValueChange} className="shrink-0">
      <div className="relative flex items-center gap-1 border-b border-border px-2 pt-2">
        {canScrollLeft ? (
          <button
            type="button"
            onClick={() => handleScrollBy(-200)}
            aria-label="Scroll invoice tabs left"
            className="flex h-8 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        <TabsList
          ref={scrollerRef}
          className="flex h-auto flex-1 justify-start overflow-x-auto rounded-none bg-transparent p-0 text-muted-foreground [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.key}
              value={item.key}
              data-tab-key={item.key}
              title={invoiceTabLabel(item)}
              onClick={() => onValueChange(item.key)}
              className={cn(
                "inline-flex max-w-[220px] shrink-0 items-center gap-1.5 rounded-none rounded-t-md border-x border-t border-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{invoiceTabLabel(item)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {canScrollRight ? (
          <button
            type="button"
            onClick={() => handleScrollBy(200)}
            aria-label="Scroll invoice tabs right"
            className="flex h-8 w-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
        {items.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-label="Show all invoices"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
              {items.map((item) => {
                const isActive = item.key === value
                return (
                  <DropdownMenuItem
                    key={item.key}
                    onSelect={() => handleSelectFromDropdown(item.key)}
                    className={cn("gap-2", isActive && "bg-accent")}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    <span className="max-w-[280px] truncate" title={invoiceTabLabel(item)}>
                      {invoiceTabLabel(item)}
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </Tabs>
  )
}

function invoiceTabLabel(item: InvoiceTabItem): string {
  return item.invoice.invoice_number
    ? `Invoice ${item.invoice.invoice_number}`
    : `Invoice ${item.ordinal}`
}

function findInvoiceTabTrigger(root: HTMLElement, key: string): HTMLElement | null {
  return (
    Array.from(root.querySelectorAll<HTMLElement>("[data-tab-key]")).find(
      (el) => el.dataset.tabKey === key,
    ) ?? null
  )
}

function scrollInvoiceTabIntoView(trigger: HTMLElement | null): void {
  if (typeof trigger?.scrollIntoView !== "function") return
  trigger.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
}
