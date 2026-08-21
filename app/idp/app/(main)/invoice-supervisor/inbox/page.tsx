"use client"

import { InvoiceSupervisorProposalDetailPanel } from "@/components/invoice-supervisor/proposal-detail-panel"
import { InvoiceSupervisorProposalListItem } from "@/components/invoice-supervisor/proposal-list-item"
import { InvoiceSupervisorStatsStrip } from "@/components/invoice-supervisor/stats-strip"
import {
  useInvoiceSupervisorBulkApproveProposals,
  useInvoiceSupervisorBulkRejectProposals,
  useInvoiceSupervisorGenerateProposals,
  useInvoiceSupervisorPendingProposals,
} from "@/lib/invoice-supervisor/hooks"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
  Checkbox,
  ErrorState,
  Skeleton,
} from "@cortex/ui"
import { CheckCircle2, Inbox as InboxIcon, RefreshCw, XCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

export default function InvoiceSupervisorInboxPage() {
  const { t } = useTranslation(["invoice-supervisor", "common"])
  const { data: proposals, isLoading, isError, refetch } = useInvoiceSupervisorPendingProposals()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeId, setActiveId] = useState<string | null>(null)

  const bulkApprove = useInvoiceSupervisorBulkApproveProposals()
  const bulkReject = useInvoiceSupervisorBulkRejectProposals()
  const generate = useInvoiceSupervisorGenerateProposals()

  const activeProposal = useMemo(
    () => proposals?.find((p) => p.id === activeId) ?? proposals?.[0] ?? null,
    [proposals, activeId],
  )

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const selectedIdsArray = Array.from(selectedIds)

  // ESC-003: payment_demand proposals can never be bulk-selected, so "select all" only targets the rest.
  const selectableProposals =
    proposals?.filter((p) => p.escalation_stage !== "payment_demand") ?? []
  const allSelected =
    selectableProposals.length > 0 && selectableProposals.every((p) => selectedIds.has(p.id))
  const someSelected = selectableProposals.some((p) => selectedIds.has(p.id))

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(selectableProposals.map((p) => p.id)) : new Set())
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-6 py-2.5">
        <h1 className="min-w-0 truncate text-base font-semibold tracking-tight">
          {t("inbox.title")}
        </h1>
        <span className="text-sm text-muted-foreground">
          {t("inbox.subtitle")}
          {proposals ? ` · ${proposals.length}` : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          <RefreshCw className={generate.isPending ? "size-4 animate-spin" : "size-4"} />
          {t("inbox.refresh")}
        </Button>
      </header>

      <InvoiceSupervisorStatsStrip />

      {selectedIdsArray.length > 0 && (
        <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-6 py-2.5">
          <span className="text-sm font-medium">
            {t("inbox.selectedCount", { n: selectedIdsArray.length })}
          </span>
          <div className="ml-auto flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="size-4" />
                  {t("inbox.rejectSelected")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("inbox.rejectConfirmTitle", { count: selectedIdsArray.length })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("inbox.rejectConfirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      bulkReject.mutate(selectedIdsArray, {
                        onSuccess: () => setSelectedIds(new Set()),
                      })
                    }}
                  >
                    {t("inbox.reject")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm">
                  <CheckCircle2 className="size-4" />
                  {t("inbox.approveSelected")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("inbox.approveConfirmTitle", { count: selectedIdsArray.length })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("inbox.approveConfirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      bulkApprove.mutate(selectedIdsArray, {
                        onSuccess: () => setSelectedIds(new Set()),
                      })
                    }}
                  >
                    {t("inbox.approve")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-96 shrink-0 flex-col overflow-hidden border-r border-border">
          {!isLoading && selectableProposals.length > 0 && (
            <label className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-sm">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={(checked) => toggleSelectAll(checked === true)}
                aria-label={t("inbox.selectAllAria")}
              />
              <span className="text-muted-foreground">
                {allSelected ? t("inbox.deselectAll") : t("inbox.selectAll")}
              </span>
            </label>
          )}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-4">
                <ErrorState
                  title={t("inbox.loadErrorTitle")}
                  message={t("errors.backendMessage")}
                  onRetry={() => refetch()}
                />
              </div>
            ) : proposals && proposals.length > 0 ? (
              proposals.map((proposal) => (
                <InvoiceSupervisorProposalListItem
                  key={proposal.id}
                  proposal={proposal}
                  selected={selectedIds.has(proposal.id)}
                  active={activeProposal?.id === proposal.id}
                  onSelectChange={(checked) => toggleSelect(proposal.id, checked)}
                  onClick={() => setActiveId(proposal.id)}
                />
              ))
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <InboxIcon className="size-10" />
                <p className="text-sm">{t("inbox.empty")}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <InvoiceSupervisorProposalDetailPanel proposal={activeProposal} />
        </div>
      </div>
    </div>
  )
}
