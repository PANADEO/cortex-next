"use client"

import { useIdpBasicDocumentContent } from "@/lib/idp-basic/hooks"
import type { IdpBasicDocument } from "@/lib/idp-basic/types"
import { Badge, Card, CardContent, LoadingState } from "@cortex/ui"
import { canPreviewInline, cn, formatFileSizeBytes, getFileTypeIcon } from "@cortex/utils"
import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState } from "react"

const DocumentViewer = dynamic(
  () => import("@cortex/ui/components/document-viewer").then((m) => m.DocumentViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-md border border-border bg-muted/30 text-xs text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading viewer…
      </div>
    ),
  },
)

interface DocumentPreviewPanelProps {
  packageId: string
  documents: IdpBasicDocument[]
}

export function DocumentPreviewPanel({ packageId, documents }: DocumentPreviewPanelProps) {
  const [activeId, setActiveId] = useState(documents[0]?.id ?? "")

  useEffect(() => {
    if (!documents.some((doc) => doc.id === activeId)) {
      setActiveId(documents[0]?.id ?? "")
    }
  }, [activeId, documents])

  const active = useMemo(
    () => documents.find((doc) => doc.id === activeId) ?? documents[0] ?? null,
    [activeId, documents],
  )
  const previewable = active
    ? canPreviewInline(active.file_name, active.media_type, active.preview_kind)
    : false
  const content = useIdpBasicDocumentContent(
    packageId,
    active?.id ?? "",
    Boolean(active && previewable),
  )

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No documents in this package.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="min-h-0">
        <CardContent className="flex max-h-[calc(100vh-210px)] min-h-0 flex-col gap-3 overflow-y-auto p-3">
          {documents.map((document) => {
            const { Icon, toneClass } = getFileTypeIcon(document.file_name, document.media_type)
            const isActive = document.id === active?.id
            return (
              <button
                key={document.id}
                type="button"
                onClick={() => setActiveId(document.id)}
                className={cn(
                  "rounded-md border p-3 text-left transition-colors",
                  isActive
                    ? "border-cortex bg-cortex/5"
                    : "border-border hover:border-cortex/60 hover:bg-muted/40",
                )}
              >
                <div className="flex min-w-0 items-start gap-2">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{document.file_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatFileSizeBytes(document.size_bytes)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{document.label ?? "Unclassified"}</Badge>
                  {document.confidence != null ? (
                    <span className="text-xs text-muted-foreground">
                      {Math.round(document.confidence * 100)}%
                    </span>
                  ) : null}
                </div>
                {document.summary ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {document.summary}
                  </p>
                ) : null}
              </button>
            )
          })}
        </CardContent>
      </Card>

      <div className="min-h-[520px]">
        {!active ? null : !previewable ? (
          <Card className="h-full">
            <CardContent className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm font-medium">No inline preview for this file.</p>
              <p className="max-w-md text-xs text-muted-foreground">
                The file is still stored with the package and can be sent to downstream systems
                later.
              </p>
            </CardContent>
          </Card>
        ) : content.isLoading ? (
          <LoadingState label={`Loading ${active.file_name}…`} />
        ) : content.error || !content.data ? (
          <Card className="h-full">
            <CardContent className="flex h-full min-h-[420px] items-center justify-center p-8 text-sm text-destructive">
              Failed to load document preview.
            </CardContent>
          </Card>
        ) : (
          <DocumentViewer
            source={content.data}
            fileName={active.file_name}
            mediaType={active.media_type}
          />
        )}
      </div>
    </div>
  )
}
