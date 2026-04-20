"use client"

import {
  endpoints,
  useSetUserPreferences,
  useUserPreferences,
  usePackageSourceFiles,
} from "@cortex/api"
import type { SourceFileReadModel } from "@cortex/types"
import { LoadingState } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { useQuery } from "@tanstack/react-query"
import { FileText, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

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

interface SourceMaterialsPanelProps {
  packageId: string
}

const DEFAULT_LIST_RATIO = 0.35
const MIN_PERCENT = 25
const MAX_PERCENT = 60

function clampRatio(raw: number | null | undefined): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return DEFAULT_LIST_RATIO
  return Math.min(0.7, Math.max(0.3, raw))
}

export function SourceMaterialsPanel({ packageId }: SourceMaterialsPanelProps) {
  const files = usePackageSourceFiles(packageId)
  const preferences = useUserPreferences()
  const persistPreferences = useSetUserPreferences()
  const [activePath, setActivePath] = useState<string | null>(null)

  const ratio = clampRatio(preferences.data?.document_panel_ratio ?? DEFAULT_LIST_RATIO)
  const listPercent = Math.round(ratio * 100)

  useEffect(() => {
    if (!activePath && files.data && files.data.length > 0) {
      setActivePath(files.data[0]?.path ?? null)
    }
  }, [files.data, activePath])

  const handleLayout = (sizes: number[]) => {
    const next = sizes[0]
    if (typeof next !== "number") return
    const nextRatio = Math.round(next) / 100
    if (Math.abs(nextRatio - ratio) < 0.01) return
    persistPreferences.mutate({ document_panel_ratio: clampRatio(nextRatio) })
  }

  if (files.isLoading) return <LoadingState label="Loading source files…" />
  const items = files.data ?? []
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No source files for this package.</p>
  }

  const active = items.find((f) => f.path === activePath) ?? items[0]!

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={handleLayout}
      className="min-h-[560px] gap-3"
    >
      <Panel
        defaultSize={listPercent}
        minSize={MIN_PERCENT}
        maxSize={MAX_PERCENT}
        className="min-w-[200px]"
      >
        <ul className="space-y-1">
          {items.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setActivePath(f.path)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-md border border-transparent px-2 py-2 text-left text-xs",
                  active.path === f.path
                    ? "border-border bg-muted"
                    : "hover:bg-muted/60",
                )}
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="block truncate font-mono">{f.file_name}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                    {f.preview_kind}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>
      <PanelResizeHandle className="w-1 shrink-0 rounded bg-border transition-colors hover:bg-primary/40 data-[resize-handle-active]:bg-primary/50" />
      <Panel minSize={40}>
        <SourceFileBody packageId={packageId} file={active} />
      </Panel>
    </PanelGroup>
  )
}

function SourceFileBody({
  packageId,
  file,
}: {
  packageId: string
  file: SourceFileReadModel
}) {
  const content = useQuery({
    queryKey: ["idp", "packages", "source-file", packageId, file.path],
    queryFn: () => endpoints.packages.sourceFileContent(packageId, file.path),
    staleTime: Infinity,
    enabled: file.preview_kind !== "download_only",
  })

  if (file.preview_kind === "download_only") {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
        No inline preview. Download via the export actions above.
      </div>
    )
  }

  if (content.isLoading) return <LoadingState label={`Loading ${file.file_name}…`} />
  if (content.error || !content.data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        Failed to load file.
      </div>
    )
  }

  return (
    <DocumentViewer
      source={content.data}
      fileName={file.file_name}
      mediaType={file.media_type}
    />
  )
}
