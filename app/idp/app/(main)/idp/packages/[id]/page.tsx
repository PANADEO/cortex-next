"use client"

import { AiNotificationsChip } from "@/components/ai-notifications-chip"
import { AiNotificationsPanel, useAiNotificationCounts } from "@/components/ai-notifications-panel"
import { AiNotificationsTabTrigger } from "@/components/ai-notifications-tab-trigger"
import { ExportMenu } from "@/components/export-menu"
import { PackageMetadataEditors } from "@/components/package-metadata-editors"
import { PackageTransportSummary } from "@/components/package-transport-summary"
import { ReprocessDialog } from "@/components/reprocess-dialog"
import { PackageRulesPanel } from "@/components/rules/package-rules-panel"
import { SourceMaterialsPanel } from "@/components/source-materials-panel"
import { TransportOrdersPanel } from "@/components/transport-orders/transport-orders-panel"
import { downloadBlob } from "@/lib/download"
import { formatNumber } from "@/lib/i18n/formats"
import { useLocaleStore } from "@/lib/i18n/locale-store"
import { useAiNotificationsReadStore } from "@/lib/stores/ai-notifications-read-store"
import {
  endpoints,
  toastApiError,
  useCancelVerification,
  useFinishVerification,
  useMe,
  usePackage,
  usePackageActions,
  usePackageTransitions,
  useResetVerification,
  useStartVerification,
  useUnlockVerification,
} from "@cortex/api"
import type { PackageTransition } from "@cortex/types"
import {
  ActionLogTimeline,
  AutoRefreshIndicator,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  JsonEditor,
  JsonViewer,
  LoadingState,
  PackageStatusBadges,
  PageHeader,
  Separator,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@cortex/ui"
import { emailsMatch, formatAbsolute, formatFileSizeMb, formatMoney } from "@cortex/utils"
import {
  ArrowLeft,
  Braces,
  ChevronDown,
  ChevronUp,
  FileArchive,
  Loader2,
  Maximize2,
} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

const TAB_PANEL_CLASS =
  "mt-2 data-[state=active]:md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-auto md:pb-4"

const TAB_PANEL_CLASS_SOURCE =
  "mt-2 data-[state=active]:md:flex md:min-h-0 md:flex-1 md:flex-col md:overflow-hidden"

const TRANSITION_LABEL_KEY: Record<PackageTransition, string> = {
  start_verification: "packages.detail.transitions.start_verification",
  cancel_verification: "packages.detail.transitions.cancel_verification",
  unlock_verification: "packages.detail.transitions.unlock_verification",
  finish_verification: "packages.detail.transitions.finish_verification",
  reset_verification: "packages.detail.transitions.reset_verification",
  reprocess: "packages.detail.transitions.reprocess",
}

export default function PackageDetailPage() {
  const { t } = useTranslation("idp")
  const readOnlyActionHelp = t("packages.detail.readOnlyActionHelp")
  const params = useParams<{ id: string }>()
  const locale = useLocaleStore((s) => s.locale)
  const id = params?.id ?? ""
  const me = useMe()

  const [pollingEnabled, setPollingEnabled] = useState(true)

  const [reprocessOpen, setReprocessOpen] = useState(false)
  const [structureOpen, setStructureOpen] = useState(false)
  const [zipDownloading, setZipDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState("transport")
  const [summaryCollapsed, setSummaryCollapsed] = useState(false)

  const detail = usePackage(id, { polling: pollingEnabled })
  const effectivePolling =
    pollingEnabled && detail.data?.verification_state !== "in_progress" && !reprocessOpen

  const actions = usePackageActions(id, { polling: effectivePolling })
  const transitions = usePackageTransitions(id, { polling: effectivePolling })
  const refetchActions = actions.refetch
  const refetchTransitions = transitions.refetch

  const start = useStartVerification(id)
  const cancel = useCancelVerification(id)
  const unlock = useUnlockVerification(id)
  const finish = useFinishVerification(id)
  const reset = useResetVerification(id)

  const pkg = detail.data
  const workflowKey = pkg
    ? `${pkg.processing_state}:${pkg.verification_state}:${pkg.assignee ?? ""}`
    : null
  const previousWorkflowKey = useRef<string | null>(null)
  const isActiveVerification = pkg?.verification_state === "in_progress"
  const canEdit = isActiveVerification && emailsMatch(me.data?.email, pkg?.assignee)
  const showReadOnlyHelp =
    Boolean(pkg && isActiveVerification && !canEdit) &&
    (transitions.data?.transitions.length ?? 0) === 0

  useEffect(() => {
    if (!workflowKey) return
    if (previousWorkflowKey.current === null) {
      previousWorkflowKey.current = workflowKey
      return
    }
    if (previousWorkflowKey.current === workflowKey) return
    previousWorkflowKey.current = workflowKey
    refetchActions()
    refetchTransitions()
  }, [refetchActions, refetchTransitions, workflowKey])

  const aiCounts = useAiNotificationCounts(id)
  const markAiRead = useAiNotificationsReadStore((s) => s.markRead)
  const handleAiNotificationsRead = useCallback(() => {
    if (!id || !aiCounts.isLoaded) return
    markAiRead(id, aiCounts.warning)
  }, [id, aiCounts.isLoaded, aiCounts.warning, markAiRead])

  const userNotesUpdated = useMemo(
    () =>
      actions.data?.actions.find((a) => a.action_type === "user_notes_updated")?.timestamp ?? null,
    [actions.data],
  )

  const handleDownloadZip = async () => {
    if (!pkg) return
    setZipDownloading(true)
    try {
      const blob = await endpoints.packages.download(pkg.id)
      const fileName = pkg.file_name.endsWith(".zip") ? pkg.file_name : `${pkg.file_name}.zip`
      downloadBlob(blob, fileName)
      toast.success(t("packages.detail.zipStarted"))
    } catch (err) {
      toastApiError(err)
    } finally {
      setZipDownloading(false)
    }
  }

  const handleTransition = async (transition: PackageTransition) => {
    if (transition === "reprocess") {
      setReprocessOpen(true)
      return
    }
    try {
      switch (transition) {
        case "start_verification":
          await start.mutateAsync()
          break
        case "cancel_verification":
          await cancel.mutateAsync()
          break
        case "unlock_verification":
          await unlock.mutateAsync()
          break
        case "finish_verification":
          await finish.mutateAsync()
          break
        case "reset_verification":
          await reset.mutateAsync()
          break
      }
      toast.success(
        t("packages.detail.transitionSucceeded", { label: t(TRANSITION_LABEL_KEY[transition]) }),
      )
    } catch (err) {
      toastApiError(err)
    }
  }

  const transitionPending =
    start.isPending || cancel.isPending || unlock.isPending || finish.isPending || reset.isPending

  const renderPackageActions = (layout: "row" | "column") => {
    if (!pkg) return null
    return (
      <>
        <Button asChild variant="outline" size="sm" disabled={!pkg.analysis_result}>
          <Link
            href={`/idp/verify/${pkg.id}`}
            aria-disabled={!pkg.analysis_result}
            className={!pkg.analysis_result ? "pointer-events-none opacity-50" : ""}
          >
            <Maximize2 className="mr-1.5 h-4 w-4" />
            {t("packages.detail.openVerification")}
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadZip} disabled={zipDownloading}>
          {zipDownloading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <FileArchive className="mr-1.5 h-4 w-4" />
          )}
          {t("packages.detail.downloadZip")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStructureOpen(true)}
          disabled={!pkg.analysis_result}
        >
          <Braces className="mr-1.5 h-4 w-4" />
          {t("packages.detail.showStructure")}
        </Button>
        {transitions.isLoading ? (
          <Skeleton className={layout === "row" ? "h-8 w-32" : "h-9 w-full"} />
        ) : transitions.data?.transitions.length === 0 ? (
          showReadOnlyHelp ? (
            <TooltipProvider delayDuration={250}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={
                      layout === "row"
                        ? "px-2 text-xs text-muted-foreground"
                        : "text-xs text-muted-foreground"
                    }
                    title={readOnlyActionHelp}
                  >
                    {t("packages.detail.readOnlyVerification")}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{readOnlyActionHelp}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span
              className={
                layout === "row"
                  ? "px-2 text-xs text-muted-foreground"
                  : "text-xs text-muted-foreground"
              }
            >
              {t("packages.detail.noTransitions")}
            </span>
          )
        ) : (
          transitions.data?.transitions.map((transition) => {
            const isPrimary =
              transition === "finish_verification" || transition === "start_verification"
            const isPending =
              (start.isPending && transition === "start_verification") ||
              (finish.isPending && transition === "finish_verification") ||
              (cancel.isPending && transition === "cancel_verification") ||
              (unlock.isPending && transition === "unlock_verification") ||
              (reset.isPending && transition === "reset_verification")
            return (
              <Button
                key={transition}
                variant={isPrimary ? "default" : "outline"}
                size="sm"
                onClick={() => handleTransition(transition)}
                disabled={transitionPending}
              >
                {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {t(TRANSITION_LABEL_KEY[transition])}
              </Button>
            )
          })
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={pkg?.package_name ?? pkg?.file_name ?? t("packages.detail.loadingTitle")}
        {...(pkg?.package_name ? { description: pkg.file_name } : {})}
        actions={
          <>
            <AutoRefreshIndicator
              enabled={effectivePolling}
              onToggle={setPollingEnabled}
              onRefresh={() => {
                detail.refetch()
                actions.refetch()
                transitions.refetch()
              }}
              isRefreshing={detail.isFetching || actions.isFetching || transitions.isFetching}
            />
            {pkg ? (
              <ExportMenu packageId={pkg.id} fileName={pkg.package_name ?? pkg.file_name} />
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/idp/packages">
                <ArrowLeft className="mr-1 h-4 w-4" /> {t("packages.detail.back")}
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6 md:min-h-0">
        {detail.isLoading ? (
          <LoadingState label={t("packages.detail.loadingDetails")} />
        ) : pkg ? (
          <>
            <section
              className={
                summaryCollapsed ? "md:shrink-0" : "grid gap-4 md:shrink-0 md:grid-cols-[1fr_auto]"
              }
            >
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div
                    className={
                      summaryCollapsed
                        ? "flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"
                        : "flex flex-wrap items-center gap-3"
                    }
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                      <PackageStatusBadges
                        processingState={pkg.processing_state}
                        verificationState={pkg.verification_state}
                        size="md"
                      />
                      {pkg.processing_state === "ready" ? (
                        <AiNotificationsChip
                          packageId={pkg.id}
                          onJumpToTab={() => {
                            setActiveTab("ai-notifications")
                            handleAiNotificationsRead()
                          }}
                        />
                      ) : null}
                      {pkg.assignee ? (
                        <span className="min-w-0 text-xs text-muted-foreground">
                          {t("packages.detail.assignedTo")}{" "}
                          <span className="font-mono">{pkg.assignee}</span>
                        </span>
                      ) : null}
                    </div>

                    {summaryCollapsed ? (
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:max-w-[62%] lg:justify-end">
                        {renderPackageActions("row")}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={t("packages.detail.expandSummary")}
                          title={t("packages.detail.expandSummary")}
                          onClick={() => setSummaryCollapsed(false)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {!summaryCollapsed ? (
                    <>
                      {pkg.processing_state === "ready" ? (
                        <PackageTransportSummary packageId={pkg.id} />
                      ) : null}
                      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          <span className="text-muted-foreground/70">
                            {t("packages.detail.uploadedLabel")}
                          </span>{" "}
                          <span className="text-foreground">
                            {formatAbsolute(pkg.created_date)}
                          </span>
                        </span>
                        {pkg.uploaded_by ? (
                          <span>
                            <span className="text-muted-foreground/70">
                              {t("packages.detail.byLabel")}
                            </span>{" "}
                            <span className="font-mono text-foreground">{pkg.uploaded_by}</span>
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate">
                          <span className="text-muted-foreground/70">
                            {t("packages.detail.hashLabel")}
                          </span>{" "}
                          <span className="font-mono text-foreground">{pkg.file_hash}</span>
                        </span>
                      </p>
                    </>
                  ) : null}
                </CardContent>
              </Card>

              {!summaryCollapsed ? (
                <Card className="min-w-64">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("packages.detail.actionsTitle")}
                      </p>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={t("packages.detail.collapseSummary")}
                        title={t("packages.detail.collapseSummary")}
                        onClick={() => setSummaryCollapsed(true)}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-col gap-1.5">{renderPackageActions("column")}</div>
                  </CardContent>
                </Card>
              ) : null}
            </section>

            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v)
                if (v === "ai-notifications") handleAiNotificationsRead()
              }}
              className="md:flex md:min-h-0 md:flex-1 md:flex-col"
            >
              <TabsList className="md:shrink-0">
                <TabsTrigger value="transport">{t("packages.detail.tabs.transport")}</TabsTrigger>
                <TabsTrigger value="metadata">{t("packages.detail.tabs.metadata")}</TabsTrigger>
                <TabsTrigger value="analysis">{t("packages.detail.tabs.analysis")}</TabsTrigger>
                <AiNotificationsTabTrigger packageId={pkg.id} />
                <TabsTrigger value="rules">{t("packages.detail.tabs.rules")}</TabsTrigger>
                <TabsTrigger value="actions">{t("packages.detail.tabs.actions")}</TabsTrigger>
                <TabsTrigger value="source">{t("packages.detail.tabs.source")}</TabsTrigger>
              </TabsList>
              <TabsContent value="transport" className={TAB_PANEL_CLASS}>
                <TransportOrdersPanel packageId={pkg.id} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="metadata" className={TAB_PANEL_CLASS}>
                <Card>
                  <CardContent className="p-5">
                    <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
                      <dt className="text-muted-foreground">
                        {t("packages.detail.meta.uploadedAt")}
                      </dt>
                      <dd>{formatAbsolute(pkg.created_date)}</dd>
                      <dt className="text-muted-foreground">{t("packages.detail.meta.size")}</dt>
                      <dd>{formatFileSizeMb(pkg.file_size_mb)}</dd>
                      <dt className="text-muted-foreground">{t("packages.detail.meta.tokens")}</dt>
                      <dd>
                        {pkg.total_tokens != null ? formatNumber(pkg.total_tokens, locale) : "—"}
                      </dd>
                      <dt className="text-muted-foreground">{t("packages.detail.meta.llmCost")}</dt>
                      <dd>{formatMoney(pkg.total_cost_usd, { currency: "USD" })}</dd>
                    </dl>
                    <Separator className="my-4" />
                    <PackageMetadataEditors
                      packageId={pkg.id}
                      customStatus={pkg.custom_status}
                      userNotes={pkg.user_notes}
                      additionalAiContext={pkg.last_additional_ai_context}
                      userNotesUpdated={userNotesUpdated}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="analysis" className={TAB_PANEL_CLASS}>
                <div className="space-y-3">
                  {isActiveVerification && !canEdit ? (
                    <p className="text-xs text-muted-foreground">
                      {t("packages.detail.analysisReadOnly", { assignee: pkg.assignee })}
                    </p>
                  ) : null}
                  {pkg.analysis_result ? (
                    canEdit ? (
                      <JsonEditor
                        value={pkg.verified_result ?? pkg.analysis_result}
                        saveLabel={t("packages.detail.analysisSaveLabel")}
                        disabledReason={t("packages.detail.analysisDisabledReason")}
                      />
                    ) : (
                      <JsonViewer
                        data={pkg.verified_result ?? pkg.analysis_result}
                        initialDepth={2}
                      />
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t("packages.detail.analysisNotAvailable")}
                    </p>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="ai-notifications" className={TAB_PANEL_CLASS}>
                <AiNotificationsPanel packageId={pkg.id} />
              </TabsContent>
              <TabsContent value="rules" className={TAB_PANEL_CLASS}>
                <PackageRulesPanel packageId={pkg.id} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="actions" className={TAB_PANEL_CLASS}>
                {actions.isLoading ? (
                  <LoadingState variant="skeleton" rows={5} />
                ) : (
                  <ActionLogTimeline events={actions.data?.actions ?? []} />
                )}
              </TabsContent>
              <TabsContent value="source" className={TAB_PANEL_CLASS_SOURCE}>
                <SourceMaterialsPanel packageId={pkg.id} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("packages.detail.notFound")}</p>
        )}
      </div>
      {pkg ? (
        <ReprocessDialog open={reprocessOpen} onOpenChange={setReprocessOpen} packageId={pkg.id} />
      ) : null}
      <Dialog open={structureOpen} onOpenChange={setStructureOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("packages.detail.structureTitle")}</DialogTitle>
            <DialogDescription>{t("packages.detail.structureDescription")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border border-border bg-muted/20 p-3">
            {pkg?.analysis_result ? (
              <JsonViewer data={pkg.verified_result ?? pkg.analysis_result} initialDepth={3} />
            ) : (
              <p className="text-sm text-muted-foreground">{t("packages.detail.structureEmpty")}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
