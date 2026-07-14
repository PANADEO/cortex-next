"use client"

import { EmptyState, ScrollArea } from "@cortex/ui"
import { FolderOpen } from "lucide-react"
import type { CoworkArtifact } from "../types"
import { ArtifactRow } from "./artifact-row"

interface ArtifactsPanelProps {
  sessionId: string | null
  artifacts: CoworkArtifact[]
  downloadHref: (artifactId: string) => string
  /** Present when the project has an export share; drives the export button. */
  onExport?: (artifactId: string) => Promise<{ displayPath: string }>
}

export function ArtifactsPanel({
  sessionId,
  artifacts,
  downloadHref,
  onExport,
}: ArtifactsPanelProps) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Artifacts</h2>
        <p className="text-xs text-muted-foreground">Files generated in this sandbox session.</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-2 p-3">
          {artifacts.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No files yet"
              description={
                sessionId
                  ? "Ask for a report and it will show up here."
                  : "Start a session to begin."
              }
            />
          ) : (
            artifacts.map((artifact) => (
              <ArtifactRow
                key={artifact.id}
                artifact={artifact}
                downloadHref={downloadHref(artifact.id)}
                {...(onExport ? { onExport: () => onExport(artifact.id) } : {})}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
