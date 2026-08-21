"use client"

import { DocumentPreview } from "@/components/classification/document-preview"
import { DocumentTree } from "@/components/classification/document-tree"
import { DraftList } from "@/components/classification/draft-list"
import { DIRTY_STATUS_LABEL } from "@/components/classification/labels"
import {
  toastApiError,
  useAutoClassify,
  useDirtyPackage,
  usePromoteDirtyPackage,
} from "@cortex/api"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  ErrorState,
  LoadingState,
} from "@cortex/ui"
import { useFeatureFlagState } from "@cortex/utils"
import { ArrowLeft, Loader2, Rocket, Sparkles } from "lucide-react"
import Link from "next/link"
import { notFound, useParams, useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { toast } from "sonner"

export default function ClassificationWorkspacePage() {
  const flagState = useFeatureFlagState("idp.classification")
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { data, isLoading, error } = useDirtyPackage(id, {
    enabled: flagState.enabled,
  })
  const autoClassify = useAutoClassify(id)
  const promote = usePromoteDirtyPackage(id)
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [confirmPromote, setConfirmPromote] = useState(false)

  const draftLookup = useMemo(() => {
    const map = new Map<string, string>()
    for (const draft of data?.drafts ?? []) map.set(draft.id, draft.name)
    return map
  }, [data?.drafts])

  if (flagState.isPending) {
    return <LoadingState label="Loading classification…" />
  }
  if (!flagState.enabled) {
    notFound()
  }

  if (isLoading) {
    return <LoadingState label="Loading dirty package…" />
  }

  if (error || !data) {
    return (
      <ErrorState
        title="Could not load classification workspace"
        message="The dirty package may have been removed or never existed."
      />
    )
  }

  const selectedDoc =
    data.documents.find((d) => d.id === selectedDocId) ?? data.documents[0] ?? null
  const totalReviewable = data.documents.filter((d) => d.mode !== "skip").length
  const reviewedCount = data.documents.filter((d) => d.human_reviewed).length
  const promotable =
    data.status !== "promoted" &&
    data.drafts.length > 0 &&
    data.drafts.every((d) => d.document_ids.length > 0)

  const runAutoClassify = () => {
    autoClassify.mutate(undefined, {
      onSuccess: (res) =>
        toast.success(
          `AI classified ${res.documents_updated} doc(s), proposed ${res.drafts_proposed} draft(s)`,
        ),
      onError: (err) => toastApiError(err),
    })
  }

  const runPromote = () => {
    promote.mutate(undefined, {
      onSuccess: (res) => {
        toast.success(
          `Promoted to ${res.clean_package_ids.length} clean package(s)` +
            (res.skipped_documents ? ` · ${res.skipped_documents} doc(s) skipped` : ""),
        )
        setConfirmPromote(false)
        router.push("/idp/packages")
      },
      onError: (err) => {
        toastApiError(err)
        setConfirmPromote(false)
      },
    })
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/idp/classification">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">{data.name}</span>
            <span className="text-[11px] text-muted-foreground">
              {data.id} · {reviewedCount}/{totalReviewable} reviewed
            </span>
          </div>
          <Badge variant="outline">{DIRTY_STATUS_LABEL[data.status]}</Badge>
          {data.customer_tag ? <Badge variant="secondary">{data.customer_tag}</Badge> : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={runAutoClassify}
            disabled={autoClassify.isPending}
          >
            {autoClassify.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Auto-reclassify with AI
          </Button>
          <Button
            size="sm"
            disabled={!promotable || promote.isPending}
            onClick={() => setConfirmPromote(true)}
          >
            {promote.isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Rocket className="mr-1.5 h-3.5 w-3.5" />
            )}
            Promote to processing
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={22} minSize={15} className="border-r border-border">
            <DocumentTree
              documents={data.documents}
              selectedId={selectedDoc?.id ?? null}
              onSelect={setSelectedDocId}
              draftLookup={draftLookup}
            />
          </Panel>
          <PanelResizeHandle className="w-1 shrink-0 bg-border transition-colors hover:bg-primary/40" />
          <Panel defaultSize={50} minSize={30}>
            <DocumentPreview dirtyPackageId={id} document={selectedDoc} drafts={data.drafts} />
          </Panel>
          <PanelResizeHandle className="w-1 shrink-0 bg-border transition-colors hover:bg-primary/40" />
          <Panel defaultSize={28} minSize={20} className="border-l border-border">
            <DraftList dirtyPackageId={id} drafts={data.drafts} documents={data.documents} />
          </Panel>
        </PanelGroup>
      </div>

      <AlertDialog open={confirmPromote} onOpenChange={setConfirmPromote}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Promote to {data.drafts.length} clean package
              {data.drafts.length === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {data.documents.filter((d) => d.mode === "process").length} document(s) will be sent
              to LLM processing, {data.documents.filter((d) => d.mode === "pass_through").length}{" "}
              will be attached as reference, and{" "}
              {data.documents.filter((d) => d.mode === "skip").length} will be dropped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promote.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runPromote} disabled={promote.isPending}>
              {promote.isPending ? "Promoting…" : "Promote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
