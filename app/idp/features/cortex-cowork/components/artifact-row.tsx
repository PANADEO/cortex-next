"use client"

import { Badge, Button } from "@cortex/ui"
import type { LucideIcon } from "lucide-react"
import { Download, FileSpreadsheet, FileText } from "lucide-react"
import type { CoworkArtifact } from "../types"

const ICON_BY_MIME: Record<string, LucideIcon> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "text/csv": FileText,
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

interface ArtifactRowProps {
  artifact: CoworkArtifact
  downloadHref: string
}

export function ArtifactRow({ artifact, downloadHref }: ArtifactRowProps) {
  const Icon = ICON_BY_MIME[artifact.mimeType] ?? FileText
  return (
    <div className="flex items-center gap-3 rounded-md border border-border p-3">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm font-medium">{artifact.filename}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            {artifact.skill}
          </Badge>
          <span>{formatBytes(artifact.sizeBytes)}</span>
        </div>
      </div>
      <Button variant="outline" size="icon" asChild aria-label={`Download ${artifact.filename}`}>
        <a href={downloadHref} download={artifact.filename}>
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  )
}
