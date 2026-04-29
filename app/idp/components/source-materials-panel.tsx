"use client"

import {
  endpoints,
  useSetUserPreferences,
  useUserPreferences,
  usePackageSourceFiles,
} from "@cortex/api"
import type { NormalizedHighlightBox, SourceFileReadModel } from "@cortex/types"
import { Button, LoadingState, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { useQuery } from "@tanstack/react-query"
import { FileText, Loader2, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { useSourceMaterialSelectionStore } from "@/lib/stores/source-material-selection"

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
  const activePath = useSourceMaterialSelectionStore((s) => s.activePath)
  const activePage = useSourceMaterialSelectionStore((s) => s.activePage)
  const highlightBoxes = useSourceMaterialSelectionStore((s) => s.highlightBoxes)
  const setActivePath = useSourceMaterialSelectionStore((s) => s.setActivePath)
  const [narrow, setNarrow] = useState(false)

  const ratio = clampRatio(preferences.data?.document_panel_ratio ?? DEFAULT_LIST_RATIO)
  const listPercent = Math.round(ratio * 100)

  useEffect(() => {
    if (!activePath && files.data && files.data.length > 0) {
      setActivePath(files.data[0]?.path ?? null)
    }
  }, [files.data, activePath, setActivePath])

  const handleLayout = (sizes: number[]) => {
    if (narrow) return
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

  const narrowDefault = 6
  const narrowMin = 5
  const narrowMax = 12

  return (
    <PanelGroup
      key={narrow ? "narrow" : "wide"}
      direction="horizontal"
      onLayout={handleLayout}
      className="h-full min-h-[560px] gap-3"
    >
      <Panel
        defaultSize={narrow ? narrowDefault : listPercent}
        minSize={narrow ? narrowMin : MIN_PERCENT}
        maxSize={narrow ? narrowMax : MAX_PERCENT}
        className={narrow ? "min-w-[48px]" : "min-w-[200px]"}
      >
        <div className="flex h-full flex-col gap-1">
          <div
            className={cn(
              "flex shrink-0 items-center",
              narrow ? "justify-center" : "justify-between px-1",
            )}
          >
            {!narrow ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Source files
              </span>
            ) : null}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setNarrow((v) => !v)}
                    aria-label={narrow ? "Expand file list" : "Collapse to narrow list"}
                  >
                    {narrow ? (
                      <PanelLeftOpen className="h-3.5 w-3.5" />
                    ) : (
                      <PanelLeftClose className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {narrow ? "Expand" : "Narrow list"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {narrow ? (
            <ul className="flex flex-col items-stretch gap-1">
              {items.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => setActivePath(f.path)}
                    title={f.file_name}
                    className={cn(
                      "flex w-full flex-col items-center gap-1 rounded-md border border-transparent py-2 text-left",
                      active.path === f.path
                        ? "border-border bg-muted"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span
                      className="truncate font-mono text-[10px] leading-tight"
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        maxHeight: "10rem",
                      }}
                    >
                      {f.file_name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
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
          )}
        </div>
      </Panel>
      <PanelResizeHandle className="w-1 shrink-0 rounded bg-border transition-colors hover:bg-primary/40 data-[resize-handle-active]:bg-primary/50" />
      <Panel minSize={40} className="flex min-h-0 flex-col gap-2">
        {highlightBoxes.length > 0 && active.path === activePath ? (
          <div className="shrink-0 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
            Invoice line selected — page {activePage ?? "—"} · {highlightBoxes.length} highlight
            {highlightBoxes.length > 1 ? "s" : ""}.
          </div>
        ) : null}
        <div className="min-h-0 flex-1">
          <SourceFileBody
            packageId={packageId}
            file={active}
            activePage={active.path === activePath ? activePage : null}
            highlightBoxes={active.path === activePath ? highlightBoxes : []}
          />
        </div>
      </Panel>
    </PanelGroup>
  )
}

function SourceFileBody({
  packageId,
  file,
  activePage,
  highlightBoxes,
}: {
  packageId: string
  file: SourceFileReadModel
  activePage: number | null
  highlightBoxes: NormalizedHighlightBox[]
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
      activePage={activePage}
      highlightBoxes={highlightBoxes}
    />
  )
}
