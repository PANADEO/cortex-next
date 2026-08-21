"use client"

import { endpoints, toastApiError, useUpdateDocumentClassification } from "@cortex/api"
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
  Checkbox,
  Label,
  LoadingState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@cortex/ui"
import { canPreviewInline, cn, formatFileSizeBytes } from "@cortex/utils"
import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, ChevronDown, FileX, Layers, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DOC_MODE_LABEL_KEY, DOC_TYPE_LABEL_KEY } from "./labels"

/** Osobny komponent, bo `loading` w `dynamic()` stoi poza drzewem Reacta
 *  i nie wolno tam wołać hooka. */
function ViewerLoading() {
  const { t } = useTranslation("idp")
  return <LoadingState label={t("classification.preview.loadingViewer")} />
}

const DocumentViewer = dynamic(
  () => import("@cortex/ui/components/document-viewer").then((m) => m.DocumentViewer),
  { ssr: false, loading: () => <ViewerLoading /> },
)

interface DocumentPreviewProps {
  dirtyPackageId: string
  document: DirtyDocument | null
  drafts: CleanPackageDraft[]
}

export function DocumentPreview({ dirtyPackageId, document, drafts }: DocumentPreviewProps) {
  const { t } = useTranslation("idp")
  const update = useUpdateDocumentClassification(dirtyPackageId)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    setNotes(document?.notes ?? "")
  }, [document?.id, document?.notes])

  if (!document) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("classification.preview.selectPrompt")}
      </div>
    )
  }

  const apply = (body: Parameters<typeof update.mutate>[0]["body"]) => {
    update.mutate({ docId: document.id, body }, { onError: (err) => toastApiError(err) })
  }

  const saveNotes = () => {
    if (notes === (document.notes ?? "")) return
    apply({ notes: notes || null })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{document.file_name}</span>
          <span className="text-xs text-muted-foreground">
            {t("classification.preview.pages", { n: document.page_count })} ·{" "}
            {formatFileSizeBytes(document.size_bytes)}
            {document.confidence !== null
              ? ` · ${t("classification.preview.confidence", {
                  n: Math.round(document.confidence * 100),
                })}`
              : ""}
          </span>
        </div>
        <Button
          size="sm"
          variant={document.human_reviewed ? "default" : "outline"}
          onClick={() => {
            apply({ human_reviewed: !document.human_reviewed })
            if (!document.human_reviewed) toast.success(t("classification.preview.markedReviewed"))
          }}
          disabled={update.isPending}
        >
          {update.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
          )}
          {document.human_reviewed
            ? t("classification.preview.reviewed")
            : t("classification.preview.markReviewed")}
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden bg-muted/30 p-3">
        <DocumentBody dirtyPackageId={dirtyPackageId} document={document} />
      </div>

      <div className="grid grid-cols-3 gap-3 border-t border-border bg-background/40 px-4 py-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("classification.preview.typeLabel")}
          </Label>
          <Select
            value={document.doc_type}
            onValueChange={(v) => apply({ doc_type: v as DocType })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPE.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(DOC_TYPE_LABEL_KEY[type])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("classification.preview.modeLabel")}
          </Label>
          <Select value={document.mode} onValueChange={(v) => apply({ mode: v as DocMode })}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_MODE.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(DOC_MODE_LABEL_KEY[m])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("classification.preview.targetPackagesLabel")}
          </Label>
          <TargetPackagesPicker
            value={document.target_clean_package_ids}
            drafts={drafts}
            disabled={document.mode === "skip"}
            onChange={(next) => apply({ target_clean_package_ids: next })}
          />
        </div>
        <div className="col-span-3 space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {t("classification.preview.notesLabel")}
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder={t("classification.preview.notesPlaceholder")}
            rows={2}
          />
        </div>
      </div>
    </div>
  )
}

function TargetPackagesPicker({
  value,
  drafts,
  disabled,
  onChange,
}: {
  value: string[]
  drafts: CleanPackageDraft[]
  disabled: boolean
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation("idp")
  const selected = new Set(value)
  const selectedDrafts = drafts.filter((d) => selected.has(d.id))

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange([...next])
  }

  const selectAll = () => onChange(drafts.map((d) => d.id))
  const clear = () => onChange([])

  const label =
    selectedDrafts.length === 0
      ? t("classification.target.unassigned")
      : selectedDrafts.length === 1
        ? selectedDrafts[0]!.name
        : selectedDrafts.length === drafts.length
          ? t("classification.target.allPackages", { n: drafts.length })
          : t("classification.target.somePackages", { n: selectedDrafts.length })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-between gap-2 px-3 text-sm font-normal",
            selectedDrafts.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {selectedDrafts.length > 1 ? (
              <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : null}
            <span className="truncate">{label}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("classification.target.heading")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-muted-foreground hover:text-foreground"
              disabled={drafts.length === 0}
            >
              {t("classification.target.selectAll")}
            </button>
            <span className="text-[11px] text-muted-foreground/50">·</span>
            <button
              type="button"
              onClick={clear}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t("classification.target.selectNone")}
            </button>
          </div>
        </div>
        <Separator className="my-1" />
        {drafts.length === 0 ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">
            {t("classification.target.empty")}
          </p>
        ) : (
          <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <label
                  htmlFor={`target-${draft.id}`}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    id={`target-${draft.id}`}
                    checked={selected.has(draft.id)}
                    onCheckedChange={() => toggle(draft.id)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-xs font-medium">{draft.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("classification.drafts.docCount", { n: draft.document_ids.length })}
                      {draft.customer_tag ? ` · ${draft.customer_tag}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

function DocumentBody({
  dirtyPackageId,
  document,
}: {
  dirtyPackageId: string
  document: DirtyDocument
}) {
  const { t } = useTranslation("idp")
  const previewable = canPreviewInline(
    document.file_name,
    document.media_type,
    document.preview_kind,
  )
  const content = useQuery({
    queryKey: ["idp", "classification", "doc-content", dirtyPackageId, document.id],
    queryFn: () => endpoints.classification.documentContent(dirtyPackageId, document.id),
    staleTime: Infinity,
    enabled: previewable,
  })

  if (!previewable) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-background/60 px-6 py-12 text-center">
          <FileX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("classification.preview.noInlineTitle")}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {t("classification.preview.noInlineBody", { type: document.media_type })}
          </p>
          <Badge variant="outline" className="text-[10px]">
            {document.media_type}
          </Badge>
        </div>
      </div>
    )
  }

  if (content.isLoading)
    return (
      <LoadingState label={t("classification.preview.loadingFile", { name: document.file_name })} />
    )

  if (content.error || !content.data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {t("classification.preview.loadFailed")}
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
