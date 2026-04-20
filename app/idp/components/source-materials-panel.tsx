"use client"

import { endpoints, usePackageSourceFiles } from "@cortex/api"
import type { SourceFileReadModel } from "@cortex/types"
import { LoadingState } from "@cortex/ui"
import { cn } from "@cortex/utils"
import { useQuery } from "@tanstack/react-query"
import { FileText, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

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

export function SourceMaterialsPanel({ packageId }: SourceMaterialsPanelProps) {
  const files = usePackageSourceFiles(packageId)
  const [activePath, setActivePath] = useState<string | null>(null)

  useEffect(() => {
    if (!activePath && files.data && files.data.length > 0) {
      setActivePath(files.data[0]?.path ?? null)
    }
  }, [files.data, activePath])

  if (files.isLoading) return <LoadingState label="Loading source files…" />
  const items = files.data ?? []
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No source files for this package.</p>
  }

  const active = items.find((f) => f.path === activePath) ?? items[0]!

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
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
      <SourceFileBody packageId={packageId} file={active} />
    </div>
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
