"use client"

import { useIntrastatDocumentContent } from "@/lib/intrastat/hooks"
import type { IntrastatDocument } from "@/lib/intrastat/types"
import { Badge, LoadingState, Tabs, TabsList, TabsTrigger } from "@cortex/ui"
import { canPreviewInline, cn, formatFileSizeBytes, getFileTypeIcon } from "@cortex/utils"
import { FileX, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

// Osobny komponent, a nie anonimowa strzałka w `loading`, bo napis jest
// tłumaczony, a hook wolno wołać wyłącznie z ciała komponentu.
function DocumentViewerLoading() {
  const { t } = useTranslation("intrastat")
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("documents.loadingViewer")}
    </div>
  )
}

const DocumentViewer = dynamic(
  () => import("@cortex/ui/components/document-viewer").then((m) => m.DocumentViewer),
  {
    ssr: false,
    loading: () => <DocumentViewerLoading />,
  },
)

interface IntrastatDocumentPreviewPanelProps {
  batchId: string
  documents: IntrastatDocument[]
  selectedSourceFile: string | null
  className?: string
}

export function IntrastatDocumentPreviewPanel({
  batchId,
  documents,
  selectedSourceFile,
  className,
}: IntrastatDocumentPreviewPanelProps) {
  const { t } = useTranslation("intrastat")
  const [activeId, setActiveId] = useState(documents[0]?.id ?? "")
  const selectedFileName = useMemo(
    () => (selectedSourceFile ? baseName(selectedSourceFile) : null),
    [selectedSourceFile],
  )

  useEffect(() => {
    if (!selectedFileName) return
    const matched = documents.find((document) => sameFileName(document.file_name, selectedFileName))
    if (matched) {
      setActiveId(matched.id)
    }
  }, [documents, selectedFileName])

  useEffect(() => {
    setActiveId((current) =>
      documents.some((document) => document.id === current) ? current : (documents[0]?.id ?? ""),
    )
  }, [documents])

  const active = useMemo(
    () => documents.find((document) => document.id === activeId) ?? documents[0] ?? null,
    [activeId, documents],
  )
  const previewable = active
    ? canPreviewInline(active.file_name, active.media_type, active.preview_kind)
    : false
  const content = useIntrastatDocumentContent(
    batchId,
    active?.id ?? "",
    Boolean(batchId && active && previewable),
  )

  if (!batchId) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 items-center justify-center rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {t("documents.chooseBatch")}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-0 items-center justify-center rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {t("documents.emptyBatch")}
      </div>
    )
  }

  return (
    <aside
      data-testid="intrastat-document-preview-panel"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t("documents.title")}</h2>
            <p className="truncate text-xs text-muted-foreground">
              {selectedFileName
                ? t("documents.source", { fileName: selectedFileName })
                : t("documents.selectHint")}
            </p>
          </div>
          <Badge variant="secondary">{documents.length}</Badge>
        </div>
      </div>

      <Tabs value={active?.id ?? ""} onValueChange={setActiveId}>
        <TabsList className="flex h-auto justify-start overflow-x-auto rounded-none border-b border-border bg-transparent p-2 text-muted-foreground [&::-webkit-scrollbar]:hidden">
          {documents.map((document) => {
            const { Icon, toneClass } = getFileTypeIcon(document.file_name, document.media_type)
            const isActive = document.id === active?.id
            const isSourceMatch = selectedFileName
              ? sameFileName(document.file_name, selectedFileName)
              : false

            return (
              <TabsTrigger
                key={document.id}
                value={document.id}
                title={`${document.file_name} · ${formatFileSizeBytes(document.size_bytes)}`}
                className={cn(
                  "h-9 max-w-[190px] shrink-0 gap-1.5 rounded-md border px-3 text-xs shadow-none transition-colors data-[state=active]:shadow-none",
                  isActive
                    ? "border-cortex bg-cortex/5"
                    : "border-transparent hover:border-border hover:bg-muted/50",
                  isSourceMatch && !isActive && "border-cortex/40",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", toneClass)} />
                <span className="min-w-0 truncate">{document.file_name}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      <div className="min-h-0 flex-1 bg-muted/30 p-3">
        {!active ? null : !previewable ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex max-w-sm flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-background/70 px-6 py-10 text-center">
              <FileX className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">{t("documents.noInlinePreview")}</p>
              <p className="text-xs text-muted-foreground">
                {t("documents.noInlinePreviewBody", { mediaType: active.media_type })}
              </p>
            </div>
          </div>
        ) : content.isLoading ? (
          <LoadingState label={t("documents.loadingFile", { fileName: active.file_name })} />
        ) : content.error || !content.data ? (
          <div className="flex h-full items-center justify-center rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {t("documents.loadFailed")}
          </div>
        ) : (
          <DocumentViewer
            source={content.data}
            fileName={active.file_name}
            mediaType={active.media_type}
            className="h-full min-h-[360px]"
          />
        )}
      </div>
    </aside>
  )
}

function baseName(value: string): string {
  return value.split(/[\\/]/).filter(Boolean).pop() ?? value
}

function sameFileName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}
