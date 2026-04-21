"use client"

import {
  endpoints,
  toastApiError,
  useUpdateDocumentClassification,
} from "@cortex/api"
import {
  DOC_MODE,
  DOC_TYPE,
  type CleanPackageDraft,
  type DirtyDocument,
  type DocMode,
  type DocType,
} from "@cortex/types"
import {
  Badge,
  Button,
  Label,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@cortex/ui"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, FileX, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { DOC_MODE_LABEL, DOC_TYPE_LABEL } from "./labels"

const DocumentViewer = dynamic(
  () => import("@cortex/ui/components/document-viewer").then((m) => m.DocumentViewer),
  { ssr: false, loading: () => <LoadingState label="Loading viewer…" /> },
)

interface DocumentPreviewProps {
  dirtyPackageId: string
  document: DirtyDocument | null
  drafts: CleanPackageDraft[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentPreview({
  dirtyPackageId,
  document,
  drafts,
}: DocumentPreviewProps) {
  const update = useUpdateDocumentClassification(dirtyPackageId)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    setNotes(document?.notes ?? "")
  }, [document?.id, document?.notes])

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a document on the left to preview and edit its classification.
      </div>
    )
  }

  const apply = (body: Parameters<typeof update.mutate>[0]["body"]) => {
    update.mutate(
      { docId: document.id, body },
      { onError: (err) => toastApiError(err) },
    )
  }

  const saveNotes = () => {
    if (notes === (document.notes ?? "")) return
    apply({ notes: notes || null })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-col">
          <span className="font-medium text-sm">{document.file_name}</span>
          <span className="text-xs text-muted-foreground">
            {document.page_count} page{document.page_count > 1 ? "s" : ""} ·{" "}
            {formatBytes(document.size_bytes)}
            {document.confidence !== null
              ? ` · AI confidence ${Math.round(document.confidence * 100)}%`
              : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant={document.human_reviewed ? "default" : "outline"}
          onClick={() => {
            apply({ human_reviewed: !document.human_reviewed })
            if (!document.human_reviewed) toast.success("Marked as reviewed")
          }}
          disabled={update.isPending}
        >
          {update.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {document.human_reviewed ? "Reviewed" : "Mark reviewed"}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-muted/30 p-3">
        <DocumentBody dirtyPackageId={dirtyPackageId} document={document} />
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border bg-background/40 px-4 py-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Type
          </Label>
          <Select
            value={document.doc_type}
            onValueChange={(v) => apply({ doc_type: v as DocType })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPE.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOC_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Mode
          </Label>
          <Select
            value={document.mode}
            onValueChange={(v) => apply({ mode: v as DocMode })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_MODE.map((m) => (
                <SelectItem key={m} value={m}>
                  {DOC_MODE_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Target package
          </Label>
          <Select
            value={document.target_clean_package_id ?? "none"}
            onValueChange={(v) =>
              apply({ target_clean_package_id: v === "none" ? null : v })
            }
            disabled={document.mode === "skip"}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Unassigned —</SelectItem>
              {drafts.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Notes
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Free-text reviewer notes…"
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}

function DocumentBody({
  dirtyPackageId,
  document,
}: {
  dirtyPackageId: string
  document: DirtyDocument
}) {
  const content = useQuery({
    queryKey: ["idp", "classification", "doc-content", dirtyPackageId, document.id],
    queryFn: () => endpoints.classification.documentContent(dirtyPackageId, document.id),
    staleTime: Infinity,
    enabled: document.preview_kind !== "download_only",
  })

  if (document.preview_kind === "download_only") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-background/60 px-6 py-12 text-center">
          <FileX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No inline preview</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {document.media_type} files are attached as references — open
            externally if you need to peek.
          </p>
          <Badge variant="outline" className="text-[10px]">
            {document.media_type}
          </Badge>
        </div>
      </div>
    )
  }

  if (content.isLoading) return <LoadingState label={`Loading ${document.file_name}…`} />

  if (content.error || !content.data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        Failed to load document content.
      </div>
    )
  }

  return (
    <DocumentViewer
      source={content.data}
      fileName={document.file_name}
      mediaType={document.media_type}
    />
  )
}
