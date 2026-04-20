"use client"

import {
  useCancelVerification,
  useFinishVerification,
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
import { ArrowLeft, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { ExportMenu } from "@/components/export-menu"
import { PackageMetadataEditors } from "@/components/package-metadata-editors"
import { ReprocessDialog } from "@/components/reprocess-dialog"
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
  const { data: session } = useSession()

  const [pollingEnabled, setPollingEnabled] = useState(true)

  const [reprocessOpen, setReprocessOpen] = useState(false)

  // Polling pauzuje gdy verification w trakcie (chroni user input) lub gdy
  // otwarty dialog reprocess (pilnuje tekst w additional AI context).
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
  const canEdit = isActiveVerification && emailsMatch(session?.user?.email, pkg?.assignee)

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
        description={pkg ? `ID ${pkg.id}` : "Fetching package details"}
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
              <Link href="/packages">
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

            <Card>
              <CardContent className="p-5">
                <PackageMetadataEditors
                  packageId={pkg.id}
                  customStatus={pkg.custom_status}
                  userNotes={pkg.user_notes}
                  userNotesUpdated={
                    actions.data?.actions.find((a) => a.action_type === "user_notes_updated")
                      ?.timestamp ?? null
                  }
                />
              </CardContent>
            </Card>

            <Tabs defaultValue="transport">
              <TabsList>
                <TabsTrigger value="transport">Transport orders</TabsTrigger>
                <TabsTrigger value="analysis">Analysis result</TabsTrigger>
                <TabsTrigger value="actions">Action log</TabsTrigger>
                <TabsTrigger value="source">Source materials</TabsTrigger>
              </TabsList>
              <TabsContent value="transport">
                <TransportOrdersPanel packageId={pkg.id} canEdit={canEdit} />
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
    </>
  )
}
