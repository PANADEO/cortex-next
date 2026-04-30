"use client"

import {
  endpoints,
  useCancelVerification,
  useFinishVerification,
  useMe,
  usePackage,
  usePackageActions,
  usePackageTransitions,
  useResetVerification,
  useStartVerification,
  toastApiError,
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
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cortex/ui"
import { emailsMatch, formatAbsolute, formatFileSizeMb, formatMoney } from "@cortex/utils"
import { ArrowLeft, Braces, FileArchive, Loader2, Maximize2 } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { downloadBlob } from "@/lib/download"
import { AiNotificationsPanel } from "@/components/ai-notifications-panel"
import { ExportMenu } from "@/components/export-menu"
import { PackageMetadataEditors } from "@/components/package-metadata-editors"
import { ReprocessDialog } from "@/components/reprocess-dialog"
import { PackageRulesPanel } from "@/components/rules/package-rules-panel"
import { SourceMaterialsPanel } from "@/components/source-materials-panel"
import { TransportOrdersPanel } from "@/components/transport-orders/transport-orders-panel"

const TRANSITION_LABELS: Record<PackageTransition, string> = {
  start_verification: "Start verification",
  cancel_verification: "Cancel verification",
  finish_verification: "Finish verification",
  reset_verification: "Reset verification",
  reprocess: "Reprocess",
}

export default function PackageDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ""
  const me = useMe()

  const [pollingEnabled, setPollingEnabled] = useState(true)

  const [reprocessOpen, setReprocessOpen] = useState(false)
  const [structureOpen, setStructureOpen] = useState(false)
  const [zipDownloading, setZipDownloading] = useState(false)

  const detail = usePackage(id, { polling: pollingEnabled })
  const effectivePolling =
    pollingEnabled && detail.data?.verification_state !== "in_progress" && !reprocessOpen

  const actions = usePackageActions(id, { polling: effectivePolling })
  const transitions = usePackageTransitions(id)

  const start = useStartVerification(id)
  const cancel = useCancelVerification(id)
  const finish = useFinishVerification(id)
  const reset = useResetVerification(id)

  const pkg = detail.data
  const isActiveVerification = pkg?.verification_state === "in_progress"
  const canEdit = isActiveVerification && emailsMatch(me.data?.email, pkg?.assignee)

  const userNotesUpdated = useMemo(
    () =>
      actions.data?.actions.find((a) => a.action_type === "user_notes_updated")?.timestamp ??
      null,
    [actions.data],
  )

  const handleDownloadZip = async () => {
    if (!pkg) return
    setZipDownloading(true)
    try {
      const blob = await endpoints.packages.download(pkg.id)
      const fileName = pkg.file_name.endsWith(".zip") ? pkg.file_name : `${pkg.file_name}.zip`
      downloadBlob(blob, fileName)
      toast.success("ZIP download started")
    } catch (err) {
      toastApiError(err)
    } finally {
      setZipDownloading(false)
    }
  }

  const handleTransition = async (t: PackageTransition) => {
    if (t === "reprocess") {
      setReprocessOpen(true)
      return
    }
    try {
      switch (t) {
        case "start_verification":
          await start.mutateAsync()
          break
        case "cancel_verification":
          await cancel.mutateAsync()
          break
        case "finish_verification":
          await finish.mutateAsync()
          break
        case "reset_verification":
          await reset.mutateAsync()
          break
      }
      toast.success(TRANSITION_LABELS[t] + " succeeded")
    } catch (err) {
      toastApiError(err)
    }
  }

  return (
    <>
      <PageHeader
        title={pkg?.file_name ?? "Loading…"}
        actions={
          <>
            <AutoRefreshIndicator
              enabled={effectivePolling}
              onToggle={setPollingEnabled}
              onRefresh={() => {
                detail.refetch()
                actions.refetch()
              }}
              isRefreshing={detail.isFetching || actions.isFetching}
            />
            {pkg ? <ExportMenu packageId={pkg.id} fileName={pkg.file_name} /> : null}
            <Button variant="outline" size="sm" asChild>
              <Link href="/idp/packages">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 px-8 py-6">
        {detail.isLoading ? (
          <LoadingState label="Loading package details…" />
        ) : pkg ? (
          <>
            <section className="grid gap-4 md:grid-cols-[1fr_auto]">
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <PackageStatusBadges
                      processingState={pkg.processing_state}
                      verificationState={pkg.verification_state}
                      size="md"
                    />
                    {pkg.assignee ? (
                      <span className="text-xs text-muted-foreground">
                        Assigned to <span className="font-mono">{pkg.assignee}</span>
                      </span>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Imported</dt>
                    <dd>{formatAbsolute(pkg.created_date)}</dd>
                    <dt className="text-muted-foreground">Size</dt>
                    <dd>{formatFileSizeMb(pkg.file_size_mb)}</dd>
                    <dt className="text-muted-foreground">Hash</dt>
                    <dd className="truncate font-mono text-xs">{pkg.file_hash}</dd>
                    <dt className="text-muted-foreground">Tokens</dt>
                    <dd>{pkg.total_tokens?.toLocaleString() ?? "—"}</dd>
                    <dt className="text-muted-foreground">LLM cost</dt>
                    <dd>{formatMoney(pkg.total_cost_usd, { currency: "USD" })}</dd>
                  </dl>
                </CardContent>
              </Card>
              <Card className="min-w-64">
                <CardContent className="space-y-2 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Button asChild variant="outline" size="sm" disabled={!pkg.analysis_result}>
                      <Link
                        href={`/idp/verify/${pkg.id}`}
                        aria-disabled={!pkg.analysis_result}
                        className={!pkg.analysis_result ? "pointer-events-none opacity-50" : ""}
                      >
                        <Maximize2 className="mr-1.5 h-4 w-4" />
                        Open verification workspace
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadZip}
                      disabled={zipDownloading}
                    >
                      {zipDownloading ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <FileArchive className="mr-1.5 h-4 w-4" />
                      )}
                      Download ZIP
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStructureOpen(true)}
                      disabled={!pkg.analysis_result}
                    >
                      <Braces className="mr-1.5 h-4 w-4" />
                      Show structure
                    </Button>
                  </div>
                  {transitions.isLoading ? (
                    <Skeleton className="h-9 w-full" />
                  ) : transitions.data?.transitions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No transitions available.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {transitions.data?.transitions.map((t) => {
                        const isPrimary =
                          t === "finish_verification" || t === "start_verification"
                        return (
                          <Button
                            key={t}
                            variant={isPrimary ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleTransition(t)}
                            disabled={
                              start.isPending ||
                              cancel.isPending ||
                              finish.isPending ||
                              reset.isPending
                            }
                          >
                            {(start.isPending && t === "start_verification") ||
                            (finish.isPending && t === "finish_verification") ||
                            (cancel.isPending && t === "cancel_verification") ||
                            (reset.isPending && t === "reset_verification") ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : null}
                            {TRANSITION_LABELS[t]}
                          </Button>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <Tabs defaultValue="transport">
              <TabsList>
                <TabsTrigger value="transport">Transport orders</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="analysis">Analysis result</TabsTrigger>
                <TabsTrigger value="ai-notifications">AI Notifications</TabsTrigger>
                <TabsTrigger value="rules">Rules</TabsTrigger>
                <TabsTrigger value="actions">Action log</TabsTrigger>
                <TabsTrigger value="source">Source materials</TabsTrigger>
              </TabsList>
              <TabsContent value="transport">
                <TransportOrdersPanel packageId={pkg.id} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="metadata">
                <Card>
                  <CardContent className="p-5">
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
              <TabsContent value="analysis" className="space-y-3">
                {isActiveVerification && !canEdit ? (
                  <p className="text-xs text-muted-foreground">
                    Read-only. Only the current assignee ({pkg.assignee}) can edit.
                  </p>
                ) : null}
                {pkg.analysis_result ? (
                  canEdit ? (
                    <JsonEditor
                      value={pkg.verified_result ?? pkg.analysis_result}
                      saveLabel="Save verified result"
                      disabledReason="Field-level edits go through transport-order endpoints; full-document save is pending backend support."
                    />
                  ) : (
                    <JsonViewer data={pkg.verified_result ?? pkg.analysis_result} initialDepth={2} />
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Analysis result not available yet.
                  </p>
                )}
              </TabsContent>
              <TabsContent value="ai-notifications">
                <AiNotificationsPanel
                  packageId={pkg.id}
                  hasAnalysis={Boolean(pkg.analysis_result)}
                />
              </TabsContent>
              <TabsContent value="rules">
                <PackageRulesPanel packageId={pkg.id} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="actions">
                {actions.isLoading ? (
                  <LoadingState variant="skeleton" rows={5} />
                ) : (
                  <ActionLogTimeline events={actions.data?.actions ?? []} />
                )}
              </TabsContent>
              <TabsContent value="source">
                <SourceMaterialsPanel packageId={pkg.id} />
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Package not found.</p>
        )}
      </div>
      {pkg ? (
        <ReprocessDialog
          open={reprocessOpen}
          onOpenChange={setReprocessOpen}
          packageId={pkg.id}
        />
      ) : null}
      <Dialog open={structureOpen} onOpenChange={setStructureOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Analysis structure</DialogTitle>
            <DialogDescription>
              Raw extracted JSON. Field-level edits happen via the Transport orders tab.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-md border border-border bg-muted/20 p-3">
            {pkg?.analysis_result ? (
              <JsonViewer data={pkg.verified_result ?? pkg.analysis_result} initialDepth={3} />
            ) : (
              <p className="text-sm text-muted-foreground">No analysis result available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
